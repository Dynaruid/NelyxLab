// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <wrl.h>
#include <Microsoft.UI.Input.InputPreTranslateSource.Interop.h>
#include <winrt/Microsoft.UI.Content.h>
#include <winrt/Microsoft.UI.Input.h>
#include <winrt/Microsoft.UI.Dispatching.h>
#include <functional>
#include <memory>
#include <string>
#include <stdexcept>

namespace Nelyx::WindowsInput {
namespace InputAbi=ABI::Microsoft::UI::Input;
/** One pre-translation owner for a host ContentIsland. The supplied filter
 * decides from the currently focused TSF context; a positive result alone
 * consumes the key. Native framework routing retains all other messages. */
class TextInputIsland final : public std::enable_shared_from_this<TextInputIsland> {
public:
  using Filter=std::function<bool(MSG const&)>;
  using Failed=std::function<void(std::string const&)>;
  static std::shared_ptr<TextInputIsland> create(winrt::Microsoft::UI::Content::ContentIsland const& island,Filter filter,Failed failed){
    if(!island||!filter||!failed)throw std::invalid_argument("Text input island requires its real island and transports");
    auto self=std::shared_ptr<TextInputIsland>(new TextInputIsland(std::move(filter),std::move(failed)));
    self->source_=winrt::Microsoft::UI::Input::InputPreTranslateKeyboardSource::GetForIsland(island);
    if(!self->source_.DispatcherQueue().HasThreadAccess())throw std::logic_error("Text input island requires its UI dispatcher");
    self->interop_=self->source_.as<InputAbi::IInputPreTranslateKeyboardSourceInterop>();
    self->handler_=Microsoft::WRL::Make<Handler>(self);
    winrt::check_hresult(self->interop_->SetPreTranslateHandler(self->handler_.Get()));self->attached_=true;return self;
  }
  ~TextInputIsland()noexcept{try{close();}catch(...){std::terminate();}}
  TextInputIsland(TextInputIsland const&)=delete;
  TextInputIsland& operator=(TextInputIsland const&)=delete;
  void close(){
    if(GetCurrentThreadId()!=thread_)throw std::logic_error("Text input island requires its UI thread");
    if(attached_){stopped_=true;winrt::check_hresult(interop_->SetPreTranslateHandler(nullptr));attached_=false;}
    stopped_=true;handler_.Reset();interop_=nullptr;source_=nullptr;filter_={};failed_={};
  }
private:
  struct Handler final : Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,InputAbi::IInputPreTranslateKeyboardSourceHandler> {
    explicit Handler(std::weak_ptr<TextInputIsland> owner):owner(std::move(owner)){}
    HRESULT STDMETHODCALLTYPE OnDirectMessage(InputAbi::IInputPreTranslateKeyboardSourceInterop*,MSG const* message,UINT,bool* handled)noexcept override{
      if(!message||!handled)return E_INVALIDARG;if(*handled)return S_OK;
      auto current=owner.lock();if(!current||current->stopped_)return S_OK;
      if(GetCurrentThreadId()!=current->thread_)return RPC_E_WRONG_THREAD;
      try{
        // Keep a copy across a callback that can close the native owner.
        auto filter=current->filter_;const bool consumed=filter(*message);
        if(consumed)*handled=true;return S_OK;
      }catch(std::exception const& error){current->fail(error.what());return E_UNEXPECTED;}
      catch(...){current->fail("Text input pre-translation failed");return E_UNEXPECTED;}
    }
    HRESULT STDMETHODCALLTYPE OnTreeMessage(InputAbi::IInputPreTranslateKeyboardSourceInterop*,MSG const* message,UINT,bool* handled)noexcept override{
      // A child island or external PlatformView owns its own input. Never run
      // the focused document's filter a second time on the bubbling route.
      return message&&handled?S_OK:E_INVALIDARG;
    }
    std::weak_ptr<TextInputIsland> owner;
  };
  TextInputIsland(Filter filter,Failed failed):thread_(GetCurrentThreadId()),filter_(std::move(filter)),failed_(std::move(failed)){}
  void fail(std::string const& message)noexcept{
    if(stopped_)return;stopped_=true;try{auto notify=failed_;notify(message);}catch(...){}
  }
  DWORD const thread_;
  Filter filter_;
  Failed failed_;
  winrt::Microsoft::UI::Input::InputPreTranslateKeyboardSource source_{nullptr};
  winrt::com_ptr<InputAbi::IInputPreTranslateKeyboardSourceInterop> interop_;
  Microsoft::WRL::ComPtr<Handler> handler_;
  bool attached_=false,stopped_=false;
};
}
