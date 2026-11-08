// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <cstdint>
#include <msctf.h>
#include <textstor.h>
#include <wrl.h>
#include <map>
#include <memory>
#include <stdexcept>

namespace Nelyx::WindowsInput {
class TextInputContext;
class TextInputFailure final : public std::runtime_error {
public:
  TextInputFailure(HRESULT result,char const* operation):std::runtime_error(operation),result(result){}
  HRESULT const result;
};
inline void checkTextInput(HRESULT result,char const* operation){if(FAILED(result))throw TextInputFailure(result,operation);}

/** One activated TSF owner per host UI thread. A context retains this owner;
 * it cannot deactivate while an attached document still exists. COM apartment
 * initialization and the real window/message loop belong to the host. */
class TextInputThread final : public std::enable_shared_from_this<TextInputThread> {
public:
  static std::shared_ptr<TextInputThread> create(){return std::shared_ptr<TextInputThread>(new TextInputThread());}
  ~TextInputThread()noexcept{if(!closed_)try{close();}catch(...){std::terminate();}}
  TextInputThread(TextInputThread const&)=delete;
  TextInputThread& operator=(TextInputThread const&)=delete;
  std::unique_ptr<TextInputContext> attach(HWND window,ITextStoreACP* store);
  TfClientId clientId()const{ui();return client_;}
  ITfThreadMgr* manager()const{ui();return manager_.Get();}
  uint64_t focusEpoch()const{ui();return focusEpoch_;}
  bool ownsFocusedDocument(HWND window)const{
    ui();const auto found=associations_.find(window);if(associating_||found==associations_.end()||!found->second.current||GetFocus()!=window)return false;
    Document focused;checkTextInput(manager_->GetFocus(&focused),"Read TSF character focus");return focused.Get()==found->second.current.Get();
  }
  /** Call before TranslateMessage/DispatchMessage. True means TSF actually
   * consumed this key; a test result alone never consumes an application key. */
  bool filterKeyMessage(MSG const& message){
    ui();const bool down=message.message==WM_KEYDOWN||message.message==WM_SYSKEYDOWN,up=message.message==WM_KEYUP||message.message==WM_SYSKEYUP;if(!down&&!up)return false;
    [[maybe_unused]] auto keep=shared_from_this();auto keys=keys_;const auto association=associations_.find(message.hwnd);if(association==associations_.end()||GetFocus()!=message.hwnd)return false;
    Document focused;checkTextInput(manager_->GetFocus(&focused),"Read TSF key focus");if(focused.Get()!=association->second.current.Get())return false;
    BOOL eaten=FALSE;const auto test=down?keys->TestKeyDown(message.wParam,message.lParam,&eaten):keys->TestKeyUp(message.wParam,message.lParam,&eaten);
    checkTextInput(test,"Test TSF key");if(test!=S_OK||!eaten)return false;
    if(closed_)return false;const auto current=associations_.find(message.hwnd);if(current==associations_.end()||current->second.current.Get()!=focused.Get()||GetFocus()!=message.hwnd)return false;
    Document now;checkTextInput(manager_->GetFocus(&now),"Recheck TSF key focus");if(now.Get()!=focused.Get())return false;
    eaten=FALSE;const auto result=down?keys->KeyDown(message.wParam,message.lParam,&eaten):keys->KeyUp(message.wParam,message.lParam,&eaten);checkTextInput(result,"Dispatch TSF key");return result==S_OK&&eaten;
  }
  void close(){
    if(GetCurrentThreadId()!=thread_)throw std::logic_error("TSF thread owner requires its UI thread");if(closed_)return;
    if(contexts_||!associations_.empty())throw std::logic_error("Retire TSF contexts before their thread owner");
    checkTextInput(manager_->Deactivate(),"Deactivate TSF thread owner");closed_=true;keys_.Reset();disabled_.Reset();manager_.Reset();
  }
private:
  friend class TextInputContext;
  using Document=Microsoft::WRL::ComPtr<ITfDocumentMgr>;
  struct Association {Document original,current;};
  struct FocusOperation {
    explicit FocusOperation(bool& active):active(active){if(active)throw std::logic_error("Reentrant TSF focus association");active=true;}
    ~FocusOperation(){active=false;}
    bool& active;
  };
  TextInputThread():thread_(GetCurrentThreadId()){
    checkTextInput(CoCreateInstance(CLSID_TF_ThreadMgr,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&manager_)),"Create TSF thread owner");
    checkTextInput(manager_->Activate(&client_),"Activate TSF thread owner");
    try{checkTextInput(manager_.As(&keys_),"Query TSF keystroke manager");checkTextInput(manager_->CreateDocumentMgr(&disabled_),"Create inactive TSF document");}
    catch(...){manager_->Deactivate();throw;}
  }
  void ui()const{if(GetCurrentThreadId()!=thread_)throw std::logic_error("TSF thread owner requires its UI thread");if(closed_)throw std::logic_error("TSF thread owner retired");}
  void associate(HWND window,ITfDocumentMgr* document){
    ui();FocusOperation operation(associating_);if(GetWindowThreadProcessId(window,nullptr)!=thread_)throw std::invalid_argument("TSF requires its real UI window");
    advanceFocus();
    auto [found,inserted]=associations_.try_emplace(window);Document previous;const auto result=manager_->AssociateFocus(window,document,&previous);
    if(FAILED(result)){if(inserted)associations_.erase(found);checkTextInput(result,"Associate TSF window focus");}
    if(inserted)found->second={previous,document};
    else if(previous.Get()!=found->second.current.Get()){
      Document ignored;checkTextInput(manager_->AssociateFocus(window,previous.Get(),&ignored),"Restore external TSF association");throw std::logic_error("TSF window association changed outside its owner");
    }else found->second.current=document;
    if(GetFocus()==window)checkTextInput(manager_->SetFocus(document),"Focus TSF document");
  }
  void detach(HWND window,ITfDocumentMgr* document){
    ui();FocusOperation operation(associating_);const auto found=associations_.find(window);if(found==associations_.end()||found->second.current.Get()!=document)return;
    advanceFocus();
    Document restored;
    if(IsWindow(window)){
      Document previous;checkTextInput(manager_->AssociateFocus(window,found->second.original.Get(),&previous),"Restore previous TSF window association");
      restored=found->second.original;
      if(previous.Get()!=document){Document ignored;checkTextInput(manager_->AssociateFocus(window,previous.Get(),&ignored),"Preserve external TSF window association");restored=previous;}
    }
    // AssociateFocus changes the window association but does not guarantee a
    // synchronous thread-focus change. Restore the actual focused window's
    // previous document; a destroyed/unfocused window uses the inactive one.
    // A reentrant external focus transition wins over this retirement.
    Document focused;checkTextInput(manager_->GetFocus(&focused),"Read TSF focus before retirement");if(focused.Get()==document)checkTextInput(manager_->SetFocus(GetFocus()==window&&restored?restored.Get():disabled_.Get()),"Withdraw retired TSF focus");
    associations_.erase(found);
  }
  DWORD const thread_;
  void advanceFocus(){if(focusEpoch_==9007199254740991ULL)throw std::overflow_error("TSF focus epoch exhausted");++focusEpoch_;}
  uint64_t focusEpoch_=0;
  TfClientId client_=TF_CLIENTID_NULL;
  Microsoft::WRL::ComPtr<ITfThreadMgr> manager_;
  Microsoft::WRL::ComPtr<ITfKeystrokeMgr> keys_;
  Document disabled_;
  std::map<HWND,Association> associations_;
  size_t contexts_=0;
  bool closed_=false;
  bool associating_=false;
};

/** Nonvisual TSF document/context attachment. This does not synthesize Core
 * focus or composition completion. Retire the bridge callback generation
 * before closing, then close its TextInputStore after the context is popped. */
class TextInputContext final {
public:
  ~TextInputContext()noexcept{try{close();}catch(...){std::terminate();}}
  TextInputContext(TextInputContext const&)=delete;
  TextInputContext& operator=(TextInputContext const&)=delete;
  ITfContext* context()const{ui();return context_.Get();}
  ITfDocumentMgr* document()const{ui();return document_.Get();}
  void associateFocus(){ui();owner_->associate(window_,document_.Get());}
  void associateFocus(HWND window){ui();if(!window||GetWindowThreadProcessId(window,nullptr)!=owner_->thread_)throw std::invalid_argument("TSF focus requires its real input HWND");if(window_!=window){owner_->detach(window_,document_.Get());window_=window;}owner_->associate(window_,document_.Get());}
  void withdrawFocus(){ui();owner_->detach(window_,document_.Get());}
  bool hasFocus()const{ui();if(GetFocus()!=window_)return false;Microsoft::WRL::ComPtr<ITfDocumentMgr> focused;checkTextInput(owner_->manager_->GetFocus(&focused),"Read actual TSF context focus");return focused.Get()==document_.Get();}
  HRESULT terminateComposition(ITfCompositionView* composition){
    ui();if(!composition)return E_INVALIDARG;Microsoft::WRL::ComPtr<ITfContextOwnerCompositionServices> services;const auto result=context_.As(&services);return FAILED(result)?result:services->TerminateComposition(composition);
  }
  void close(){
    if(closed_)return;owner_->ui();owner_->detach(window_,document_.Get());checkTextInput(document_->Pop(TF_POPF_ALL),"Pop TSF input context");closed_=true;context_.Reset();document_.Reset();--owner_->contexts_;
  }
private:
  friend class TextInputThread;
  TextInputContext(std::shared_ptr<TextInputThread> owner,HWND window,ITextStoreACP* store):owner_(std::move(owner)),window_(window){
    owner_->ui();if(!store||GetWindowThreadProcessId(window_,nullptr)!=owner_->thread_)throw std::invalid_argument("TSF context requires its store and real UI window");
    TsViewCookie view=0;HWND storeWindow=nullptr;checkTextInput(store->GetActiveView(&view),"Read TSF store view");checkTextInput(store->GetWnd(view,&storeWindow),"Read TSF store window");if(storeWindow!=window_)throw std::invalid_argument("TSF context and text store require the same window");
    checkTextInput(owner_->manager_->CreateDocumentMgr(&document_),"Create TSF input document");TfEditCookie cookie=0;
    checkTextInput(document_->CreateContext(owner_->client_,0,store,&context_,&cookie),"Create TSF input context");checkTextInput(document_->Push(context_.Get()),"Push TSF input context");++owner_->contexts_;
  }
  void ui()const{owner_->ui();if(closed_)throw std::logic_error("TSF input context retired");}
  std::shared_ptr<TextInputThread> owner_;
  HWND window_;
  Microsoft::WRL::ComPtr<ITfDocumentMgr> document_;
  Microsoft::WRL::ComPtr<ITfContext> context_;
  bool closed_=false;
};
inline std::unique_ptr<TextInputContext> TextInputThread::attach(HWND window,ITextStoreACP* store){ui();return std::unique_ptr<TextInputContext>(new TextInputContext(shared_from_this(),window,store));}
}
