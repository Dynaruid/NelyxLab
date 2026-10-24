// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <algorithm>
#include <cstdint>
#include "TextInputContext.h"
#include "TextInputIsland.h"
#include <map>
#include <optional>
#include <vector>
#include <winrt/Microsoft.UI.Windowing.h>

namespace Nelyx::WindowsInput {
/** The host owns one root for its ContentIsland and desktop site. Providers
 * register a retirement callback and remove it after clearing their event
 * generation, popping their context and closing their shadow document. */
class TextInputRoot final : public std::enable_shared_from_this<TextInputRoot> {
public:
  using ClientId=uint64_t;
  using Retire=std::function<void(std::string const&)>;
  static std::shared_ptr<TextInputRoot> create(winrt::Microsoft::UI::Content::ContentIsland const& island,HWND inputWindow,TextInputIsland::Failed failed){
    if(!island||!failed||GetWindowThreadProcessId(inputWindow,nullptr)!=GetCurrentThreadId())throw std::invalid_argument("Text input root requires its actual UI island/window");
    auto self=std::shared_ptr<TextInputRoot>(new TextInputRoot(island,inputWindow,std::move(failed)));
    self->thread_=TextInputThread::create();
    self->transport_=TextInputIsland::create(island,[weak=std::weak_ptr<TextInputRoot>(self)](MSG const& message){
      auto current=weak.lock();if(!current||current->closing_||!current->focusedWindow_||message.hwnd!=current->focusedWindow_||!winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(current->island_).HasFocus())return false;
      // Only a real queued WM_CHAR for our focused TSF document can admit an
      // unpaired character. Dead/system/legacy IME messages are not text proof.
      if(message.message==WM_CHAR&&current->characters_&&current->thread_->ownsFocusedDocument(message.hwnd)){
        const auto observe=current->characters_;const auto bits=static_cast<uintptr_t>(message.lParam);observe(static_cast<uint32_t>(message.wParam),static_cast<uint32_t>((bits>>16)&0xff)|((bits&(uintptr_t{1}<<24))?0xe000:0),std::max(1u,static_cast<uint32_t>(bits&0xffff)),current->thread_->focusEpoch());
      }
      // Capture the canvas lease before TSF: KeyUp can reenter focus changes.
      // A successful result cannot release a new press after blur/refocus.
      std::function<void()> release;
      if(current->consumedKeyUps_&&(message.message==WM_KEYUP||message.message==WM_SYSKEYUP)){
        const auto observe=current->consumedKeyUps_;const auto bits=static_cast<uintptr_t>(message.lParam);release=observe(static_cast<uint32_t>(message.wParam),static_cast<uint32_t>((bits>>16)&0xff)|((bits&(uintptr_t{1}<<24))?0xe000:0),std::max(1u,static_cast<uint32_t>(bits&0xffff)));
      }
      const bool consumed=!current->closing_&&current->thread_->filterKeyMessage(message);
      if(consumed&&!current->closing_&&release)release();
      return consumed;
    },[weak=std::weak_ptr<TextInputRoot>(self)](std::string const& message){if(auto current=weak.lock())current->fail(message);});
    self->islandChanged_=island.StateChanged([weak=std::weak_ptr<TextInputRoot>(self)](auto const&,auto const&){if(auto current=weak.lock())current->screenCoordinatesChanged();});
    return self;
  }
  // RNW can release the property bag on a worker after UI retirement. Only a
  // live root needs owner-thread close; a fully closed root owns no UI handles.
  ~TextInputRoot()noexcept{if(!closed_)try{close();}catch(...){std::terminate();}}
  TextInputRoot(TextInputRoot const&)=delete;
  TextInputRoot& operator=(TextInputRoot const&)=delete;
  HWND window()const{live();return window_;}
  /** The desktop bridge hosts an additional InputSite HWND. Read that actual
   * focused child only after this island has accepted focus; the bridge HWND
   * alone does not receive keyboard input or select the active TSF document. */
  HWND focusedInputWindow(){
    live();const auto focus=winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(island_);const auto window=GetFocus();
    if(!focus.HasFocus()||!window||GetWindowThreadProcessId(window,nullptr)!=uiThread_||(window!=window_&&!IsChild(window_,window)))throw std::logic_error("The owning ContentIsland has no actual focused input HWND");
    focusedWindow_=window;return window;
  }
  winrt::Microsoft::UI::Content::ContentIsland island()const{live();return island_;}
  std::shared_ptr<TextInputThread> thread()const{live();return thread_;}
  void observeCharacters(std::function<void(uint32_t,uint32_t,uint32_t,uint64_t)> observer){live();if(!observer||characters_)throw std::logic_error("Native character observer already installed or absent");characters_=std::move(observer);}
  void observeConsumedKeyUps(std::function<std::function<void()>(uint32_t,uint32_t,uint32_t)> observer){live();if(!observer||consumedKeyUps_)throw std::logic_error("Native consumed key-up observer already installed or absent");consumedKeyUps_=std::move(observer);}
  ClientId registerClient(Retire retire,std::function<void()> geometryChanged={}){
    live();if(!retire)throw std::invalid_argument("Text input client requires retirement");if(nextClient_==9007199254740991ULL)throw std::overflow_error("Text input client identity exhausted");const auto id=++nextClient_;clients_.emplace(id,Client{std::move(retire),std::move(geometryChanged)});return id;
  }
  void unregisterClient(ClientId id){ui();clients_.erase(id);}
  void watchWindow(winrt::Microsoft::UI::Windowing::AppWindow const& window){
    live();if(observedWindow_)throw std::logic_error("Text input root already observes a window");
    observedWindow_=window;windowChanged_=window.Changed([weak=weak_from_this()](auto const&,auto const& args){if(args.DidPositionChange()||args.DidSizeChange()||args.DidVisibilityChange())if(auto current=weak.lock())current->screenCoordinatesChanged();});
  }
  void screenCoordinatesChanged(){
    ui();if(closing_||closed_)return;
    if(coordinateRevision_==9007199254740991ULL){fail("Native coordinate revision exhausted");return;}++coordinateRevision_;
    std::vector<std::pair<ClientId,std::function<void()>>> callbacks;for(auto const& [id,client]:clients_)if(client.geometryChanged)callbacks.emplace_back(id,client.geometryChanged);
    for(auto const& [id,callback]:callbacks){if(closing_||closed_)return;if(clients_.contains(id))try{callback();}catch(std::exception const& error){fail(error.what());return;}catch(...){fail("Text input coordinate notification failed");return;}}
  }
  std::optional<uint64_t> coordinateRevision()const{ui();if(closing_||closed_)return std::nullopt;return coordinateRevision_;}
  void close(){
    ui();if(closed_)return;if(retiring_)throw std::logic_error("Reentrant text input root retirement");closing_=true;retiring_=true;revokeCoordinates();
    try{
      while(!clients_.empty()){
        const auto id=clients_.begin()->first;auto retire=clients_.begin()->second.retire;retire(failure_);
        if(clients_.contains(id))throw std::logic_error("Text input provider did not acknowledge retirement");
      }
      if(transport_)transport_->close();if(thread_)thread_->close();transport_.reset();thread_.reset();characters_={};consumedKeyUps_={};focusedWindow_=nullptr;island_=nullptr;failed_={};closed_=true;retiring_=false;
    }catch(...){retiring_=false;throw;}
  }
private:
  TextInputRoot(winrt::Microsoft::UI::Content::ContentIsland island,HWND window,TextInputIsland::Failed failed):uiThread_(GetCurrentThreadId()),window_(window),island_(std::move(island)),failed_(std::move(failed)){}
  // ContentIsland does not implement IWeakReferenceSource. An auto_revoker
  // would dereference a null weak-reference source in the pinned C++/WinRT.
  // Retain the actual sources and explicitly remove their event tokens.
  void revokeCoordinates(){
    if(windowChanged_){observedWindow_.Changed(*windowChanged_);windowChanged_.reset();}observedWindow_=nullptr;
    if(islandChanged_){island_.StateChanged(*islandChanged_);islandChanged_.reset();}
  }
  void ui()const{if(GetCurrentThreadId()!=uiThread_)throw std::logic_error("Text input root requires its UI thread");}
  void live()const{ui();if(closing_||closed_)throw std::logic_error("Text input root retired");}
  void fail(std::string const& message)noexcept{
    if(closing_||closed_)return;
    try{auto failed=failed_;failure_=message;try{close();}catch(...){closing_=true;failure_+="; input retirement incomplete";}try{failed(failure_);}catch(...){} }catch(...){closing_=true;}
  }
  DWORD const uiThread_;
  HWND const window_;
  HWND focusedWindow_=nullptr;
  winrt::Microsoft::UI::Content::ContentIsland island_{nullptr};
  TextInputIsland::Failed failed_;
  std::function<void(uint32_t,uint32_t,uint32_t,uint64_t)> characters_;
  std::function<std::function<void()>(uint32_t,uint32_t,uint32_t)> consumedKeyUps_;
  struct Client {Retire retire;std::function<void()> geometryChanged;};
  std::shared_ptr<TextInputThread> thread_;
  std::shared_ptr<TextInputIsland> transport_;
  std::map<ClientId,Client> clients_;
  winrt::Microsoft::UI::Windowing::AppWindow observedWindow_{nullptr};
  std::optional<winrt::event_token> windowChanged_,islandChanged_;
  std::string failure_;
  ClientId nextClient_=0;
  uint64_t coordinateRevision_=0;
  bool closing_=false,retiring_=false,closed_=false;
};
}
