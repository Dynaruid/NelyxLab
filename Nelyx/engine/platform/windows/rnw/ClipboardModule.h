// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Modified for Nelyx: ReactContext/ReactPromise -> App SDK dispatcher/value port.
// See upstream/ and provenance.json for the unmodified RNW 0.83.2 source.
#pragma once
#include <winrt/Microsoft.UI.Dispatching.h>
#include <winrt/Windows.ApplicationModel.DataTransfer.h>
#include <winrt/Windows.Foundation.h>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>

namespace nelyx::v2::windows::rnw {
class Clipboard final {
 public:
  using Completion=std::function<void(std::string,std::string)>;
  Clipboard();
  void getString(Completion result);
  // Nelyx input carrier captures GetContent on this UI turn, before App keys
  // can run. RNW's async text retrieval/cancellation still owns completion.
  void captureString(Completion result);
  void setString(winrt::hstring content,Completion result);
  void cancel();
  size_t pending()const;
 private:
  struct Request {
    Completion result;
    winrt::Windows::Foundation::IAsyncOperation<winrt::hstring> operation{nullptr};
    bool finishing=false;
  };
  struct State {
    winrt::Microsoft::UI::Dispatching::DispatcherQueue dispatcher{nullptr};
    mutable std::mutex gate;
    std::map<uint64_t,Request> requests;
    uint64_t sequence=0;
    bool closed=false;
  };
  std::shared_ptr<State> state;
  void post(Completion result,std::function<void(const std::shared_ptr<State>&,uint64_t)> work,bool immediate=false);
  void readString(Completion result,bool immediate);
  static void finish(const std::shared_ptr<State>& state,uint64_t id,std::string text,std::string error);
};
}
