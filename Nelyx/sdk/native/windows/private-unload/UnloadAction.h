// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <winrt/Windows.Foundation.h>
#include <mutex>

namespace RNSkia {
class WindowsUnloadAction : public winrt::implements<WindowsUnloadAction,
    winrt::Windows::Foundation::IAsyncAction,winrt::Windows::Foundation::IAsyncInfo> {
  using StatusType=winrt::Windows::Foundation::AsyncStatus;
  using Handler=winrt::Windows::Foundation::AsyncActionCompletedHandler;
public:
  void finish(HRESULT value=S_OK) noexcept {
    Handler call;StatusType done;
    {std::lock_guard lock(mutex);if(status!=StatusType::Started)return;error=value;status=FAILED(value)?StatusType::Error:StatusType::Completed;done=status;call=std::move(handler);}
    if(call)try{call(*this,done);}catch(...){}
  }
  void Completed(Handler const &value) {
    StatusType current;
    {std::lock_guard lock(mutex);if(assigned)throw winrt::hresult_illegal_delegate_assignment();assigned=true;current=status;
      if(current==StatusType::Started){handler=winrt::impl::make_agile_delegate([keep=get_strong(),value](auto const& action,auto state){value(action,state);});return;}}
    if(value)value(*this,current);
  }
  Handler Completed(){std::lock_guard lock(mutex);return handler;}
  uint32_t Id()const noexcept{return 1;}
  StatusType Status(){std::lock_guard lock(mutex);return status;}
  winrt::hresult ErrorCode(){std::lock_guard lock(mutex);return error;}
  void Cancel()noexcept{finish(E_ABORT);}
  void Close()noexcept{}
  void GetResults(){std::lock_guard lock(mutex);if(status==StatusType::Started)throw winrt::hresult_illegal_method_call();winrt::check_hresult(error);}
private:
  std::mutex mutex;StatusType status=StatusType::Started;HRESULT error=S_OK;Handler handler{nullptr};bool assigned=false;
};
} // namespace RNSkia
