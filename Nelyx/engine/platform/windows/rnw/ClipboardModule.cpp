// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Adapted from RNW 0.83.2 Microsoft.ReactNative/Modules/ClipboardModule.cpp.
// Nelyx changes: owned App SDK queue, copied replies, bounded text, cancellation,
// terminal tracking and exception handling. No React/Fabric/bridge dependency.
#include "ClipboardModule.h"
#include <vector>

using namespace winrt::Windows::Foundation;
using namespace winrt::Windows::ApplicationModel;

namespace nelyx::v2::windows::rnw {
Clipboard::Clipboard():state(std::make_shared<State>()) {
  state->dispatcher=winrt::Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread();
  if(!state->dispatcher)throw std::runtime_error("Clipboard requires the App SDK UI dispatcher");
}
void Clipboard::finish(const std::shared_ptr<State>& state,uint64_t id,std::string text,std::string error) {
  Completion result;
  {
    std::lock_guard lock(state->gate);
    const auto found=state->requests.find(id);
    if(found==state->requests.end()||found->second.finishing)return;
    if(state->closed){text.clear();error="Windows clipboard operation canceled";}
    result=std::move(found->second.result);
    found->second.finishing=true;
  }
  result(std::move(text),std::move(error));
  result={}; // Retire the completion's port credit before reporting terminal.
  {std::lock_guard lock(state->gate);state->requests.erase(id);}
}
void Clipboard::post(Completion result,std::function<void(const std::shared_ptr<State>&,uint64_t)> work,bool immediate) {
  uint64_t id=0;
  {
    std::lock_guard lock(state->gate);
    if(!state->closed&&state->requests.size()<32){
      id=++state->sequence;state->requests.emplace(id,Request{std::move(result)});
    }
  }
  if(!id){result({},"Windows clipboard is closed or full");return;}
  try {
    auto execute=[state=state,id,work=std::move(work)]{
      bool closed;{std::lock_guard lock(state->gate);closed=state->closed;}
      if(closed){finish(state,id,{},"Windows clipboard operation canceled before execution");return;}
      try{work(state,id);}
      catch(const winrt::hresult_error& error){finish(state,id,{},winrt::to_string(error.message()));}
      catch(const std::exception& error){finish(state,id,{},error.what());}
    };
    if(immediate){
      if(!state->dispatcher.HasThreadAccess())throw std::runtime_error("Input clipboard capture requires its UI owner");
      execute();return;
    }
    if(state->dispatcher.TryEnqueue(std::move(execute)))return;
  }catch(const winrt::hresult_error& error){finish(state,id,{},winrt::to_string(error.message()));return;}
  catch(const std::exception& error){finish(state,id,{},error.what());return;}
  finish(state,id,{},"App SDK dispatcher rejected clipboard operation");
}

void Clipboard::getString(Completion result) {
  readString(std::move(result),false);
}
void Clipboard::captureString(Completion result) {
  readString(std::move(result),true);
}
void Clipboard::readString(Completion result,bool immediate) {
  post(std::move(result),[](const auto& state,uint64_t id){
    auto data=DataTransfer::Clipboard::GetContent();
    if(!data.Contains(DataTransfer::StandardDataFormats::Text())){finish(state,id,{},{});return;}
    auto asyncOp=data.GetTextAsync();
    bool canceled;
    {std::lock_guard lock(state->gate);state->requests.at(id).operation=asyncOp;canceled=state->closed;}
    // RNW explicitly uses Completed: lambda captures and fire_and_forget do not
    // safely compose here. Keep the operation/port credit until its terminal.
    asyncOp.Completed([state,id](const IAsyncOperation<winrt::hstring>& asyncOp,AsyncStatus status){
      try{
        switch(status){
          case AsyncStatus::Completed:{
            const auto text=asyncOp.GetResults();
            if(text.size()>65536)throw std::runtime_error("Windows clipboard exceeds65536 UTF-16 units");
            finish(state,id,winrt::to_string(text),{});break;
          }
          case AsyncStatus::Canceled:finish(state,id,{},"Windows clipboard read canceled");break;
          case AsyncStatus::Error:finish(state,id,{},winrt::to_string(winrt::hresult_error(asyncOp.ErrorCode()).message()));break;
          case AsyncStatus::Started:finish(state,id,{},"Invalid clipboard completion status");break;
        }
      }catch(const winrt::hresult_error& error){finish(state,id,{},winrt::to_string(error.message()));}
      catch(const std::exception& error){finish(state,id,{},error.what());}
    });
    // stop can race GetTextAsync before cancel() can see this operation.
    // Register terminal delivery first, then cancel the newly published handle.
    if(canceled)asyncOp.Cancel();
  },immediate);
}
void Clipboard::setString(winrt::hstring content,Completion result) {
  if(content.size()>65536){result({},"Windows clipboard exceeds65536 UTF-16 units");return;}
  post(std::move(result),[content=std::move(content)](const auto& state,uint64_t id){
    DataTransfer::DataPackage data;
    data.SetText(content);
    DataTransfer::Clipboard::SetContent(data);
    finish(state,id,{},{});
  });
}
void Clipboard::cancel() {
  std::vector<IAsyncOperation<winrt::hstring>> operations;
  {std::lock_guard lock(state->gate);state->closed=true;
    for(const auto& [id,request]:state->requests)if(request.operation)operations.push_back(request.operation);}
  for(const auto& operation:operations)try{operation.Cancel();}catch(const winrt::hresult_error&){}
}
size_t Clipboard::pending()const{std::lock_guard lock(state->gate);return state->requests.size();}
}
