// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "RNSkVulkanPlatformContext.h"
#include <ReactCommon/CallInvoker.h>
#include "rnskia/RNSkOwnerAsyncQueue.h"
#include "WindowsResizeCoordinator.h"
#include "include/ports/SkTypeface_win.h"
#include <ReactContext.h>
#include <windows.h>
#include <shlwapi.h>
#include <filesystem>
#include <algorithm>
#include <atomic>
#include <unordered_map>

extern "C" void C_SetICU(const void*);

namespace RNSkia {
// RN owns both dispatchers. This service owns bounded local-file inputs,
// owner-affine completion captures and native-only queued UI tasks.
class WindowsRuntimeServices final : public std::enable_shared_from_this<WindowsRuntimeServices> {
public:
  WindowsRuntimeServices(winrt::Microsoft::ReactNative::ReactContext context,
      std::shared_ptr<facebook::react::CallInvoker> invoker,std::vector<std::wstring> roots,
      std::shared_ptr<WindowsResizeCoordinator> resize={})
      : context(std::move(context)),owner(std::this_thread::get_id()),
        resize(std::move(resize)),async(std::make_shared<RNSkOwnerAsyncQueue<RNSkAsyncResult>>(
          [invoker](auto job){invoker->invokeAsync(std::move(job));})) {
    if(!this->context || !invoker || roots.empty() || roots.size()>8)
      throw std::runtime_error("Windows services require actual RN context/invoker and 1..8 asset roots");
    for(const auto &root:roots) {
      const std::filesystem::path path(root);
      if(!path.is_absolute() || path==path.root_path() || GetDriveTypeW(path.root_path().c_str())!=DRIVE_FIXED)
        throw std::runtime_error("Windows assets require an explicit local fixed-drive directory");
      Handle handle(CreateFileW(root.c_str(),FILE_READ_ATTRIBUTES,FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,
          nullptr,OPEN_EXISTING,FILE_FLAG_BACKUP_SEMANTICS|FILE_FLAG_OPEN_REPARSE_POINT,nullptr));
      BY_HANDLE_FILE_INFORMATION info{};
      if(!handle.valid() || !GetFileInformationByHandle(handle.value,&info) ||
          !(info.dwFileAttributes&FILE_ATTRIBUTE_DIRECTORY) || (info.dwFileAttributes&FILE_ATTRIBUTE_REPARSE_POINT))
        throw std::runtime_error("Windows asset root must be a real directory");
      auto canonical=finalPath(handle.value);if(canonical.back()!=L'\\')canonical+=L'\\';
      assetRoots.push_back(std::move(canonical));
    }
  }
  VulkanPlatformServices ports(std::function<std::shared_ptr<nelyx::vulkan::Device>()> createDevice,
      std::function<sk_sp<SkImage>(size_t)> screenshot,std::function<void(const std::exception&)> reportError) {
    auto self=shared_from_this();VulkanPlatformServices result;
    result.dispatchToMain=[self](auto job){self->postUi(std::move(job));};
    result.stream=[self](const std::string &uri,const auto &complete){
      self->requireOwner();if(self->sealed.load()){complete(nullptr);return;}
      sk_sp<SkData> data;try{data=self->readFile(uri);}catch(const std::exception&){}
      complete(data?std::make_unique<SkMemoryStream>(std::move(data)):nullptr);
    };
    result.fontManager=[](){return SkFontMgr_New_DirectWrite();};
    result.screenshot=std::move(screenshot);result.reportError=std::move(reportError);result.createDevice=std::move(createDevice);
    result.makeAsyncCompletion=[self](auto callback){return self->async->begin(std::move(callback));};
    return result;
  }
  void seal() {sealed.store(true);async->seal();}
  void initializeIcu(const std::string &uri) {
    requireOwner();auto data=readFile(uri);static std::mutex icuMutex;static sk_sp<SkData> processIcu;
    std::lock_guard lock(icuMutex);
    if(processIcu && !processIcu->equals(data.get()))throw std::runtime_error("Windows ICU bytes differ from the process owner");
    if(!processIcu){processIcu=std::move(data);C_SetICU(processIcu->data());}
  }
  void close() {
    requireOwner();seal();async->close();
    std::unordered_map<uint64_t,std::function<void()>> cancelled;
    {std::lock_guard lock(mutex);if(failed.load())throw std::runtime_error("Windows UI task failed: "+uiFailure);if(inFlight)throw std::runtime_error("Windows UI work is in flight");cancelled.swap(jobs);}
    cancelled.clear();
  }
  size_t pendingAsync() const {return async->pending();}
  std::string uiFailureReason(){std::lock_guard lock(mutex);return uiFailure;}
private:
  struct Handle {
    HANDLE value;
    explicit Handle(HANDLE value):value(value){}
    ~Handle(){if(valid())CloseHandle(value);}
    bool valid() const{return value!=INVALID_HANDLE_VALUE && value!=nullptr;}
    Handle(const Handle&)=delete;Handle& operator=(const Handle&)=delete;
  };
  static std::wstring finalPath(HANDLE file) {
    std::wstring value(32768,L'\0');const auto size=GetFinalPathNameByHandleW(file,value.data(),static_cast<DWORD>(value.size()),FILE_NAME_NORMALIZED|VOLUME_NAME_DOS);
    if(!size || size>=value.size())throw std::runtime_error("Windows file identity unavailable");
    value.resize(size);return value;
  }
  sk_sp<SkData> readFile(const std::string &uri) {
    auto path=winrt::to_hstring(uri);std::wstring local(path);
    if(local.starts_with(L"file:")) {
      std::wstring decoded(32768,L'\0');DWORD size=static_cast<DWORD>(decoded.size());
      if(FAILED(PathCreateFromUrlW(local.c_str(),decoded.data(),&size,0)))throw std::runtime_error("Invalid Windows asset file URI");
      decoded.resize(wcslen(decoded.c_str()));local=std::move(decoded);
    }
    const std::filesystem::path native(local);
    if(!native.is_absolute() || native.root_name().wstring().size()!=2 || local.starts_with(L"\\\\"))
      throw std::runtime_error("Windows stream supports local absolute file assets only");
    Handle file(CreateFileW(local.c_str(),GENERIC_READ,FILE_SHARE_READ,nullptr,OPEN_EXISTING,
        FILE_FLAG_OPEN_REPARSE_POINT|FILE_FLAG_SEQUENTIAL_SCAN,nullptr));
    BY_HANDLE_FILE_INFORMATION info{};
    if(!file.valid() || GetFileType(file.value)!=FILE_TYPE_DISK || !GetFileInformationByHandle(file.value,&info) ||
        (info.dwFileAttributes&(FILE_ATTRIBUTE_DIRECTORY|FILE_ATTRIBUTE_REPARSE_POINT)))throw std::runtime_error("Windows asset is not a regular file");
    const auto canonical=finalPath(file.value);bool allowed=false;
    for(const auto &root:assetRoots)if(canonical.size()>root.size() &&
        CompareStringOrdinal(canonical.data(),static_cast<int>(root.size()),root.data(),static_cast<int>(root.size()),TRUE)==CSTR_EQUAL){allowed=true;break;}
    const auto bytes=(static_cast<uint64_t>(info.nFileSizeHigh)<<32)|info.nFileSizeLow;
    if(!allowed || !bytes || bytes>16*1024*1024)throw std::runtime_error("Windows asset root or 16MiB byte budget rejected");
    auto data=SkData::MakeUninitialized(static_cast<size_t>(bytes));if(!data)throw std::runtime_error("Windows asset allocation failed");
    size_t offset=0;
    while(offset<bytes) {
      DWORD count=0;const auto request=static_cast<DWORD>(std::min<uint64_t>(65536,bytes-offset));
      if(!ReadFile(file.value,static_cast<char*>(data->writable_data())+offset,request,&count,nullptr) || count!=request)
        throw std::runtime_error("Windows asset changed or read failed");
      offset+=count;
    }
    return data;
  }
  void recordUiFailure(std::string reason) {
    std::lock_guard lock(mutex);if(!failed.load())uiFailure=reason.substr(0,1024);failed.store(true);sealed.store(true);
    OutputDebugStringA(("Windows UI task failed: "+uiFailure+"\n").c_str());
  }
  void postUi(std::function<void()> job) {
    uint64_t id;
    {std::lock_guard lock(mutex);if(failed.load())throw std::runtime_error("Windows UI task failed: "+uiFailure);if(sealed.load())throw std::runtime_error("Windows UI admission closed");if(jobs.size()>=64)throw std::runtime_error("Windows UI queue full (64 pending jobs)");id=++next;jobs.emplace(id,std::move(job));}
    auto run=[weak=weak_from_this(),id]() {
      auto self=weak.lock();if(!self)return;std::function<void()> task;
      {std::lock_guard lock(self->mutex);auto found=self->jobs.find(id);if(self->sealed.load() || found==self->jobs.end())return;task=std::move(found->second);self->jobs.erase(found);++self->inFlight;}
      try{task();}catch(const winrt::hresult_error& error){self->recordUiFailure("HRESULT="+std::to_string(error.code().value)+" "+winrt::to_string(error.message()));}
      catch(const std::exception& error){self->recordUiFailure(error.what());}catch(...){self->recordUiFailure("unknown native exception");}
      task=nullptr;{std::lock_guard lock(self->mutex);--self->inFlight;}
    };
    auto dispatcher=context.UIDispatcher();
    if(resize)resize->post(std::move(run),[dispatcher](auto job){dispatcher.Post(std::move(job));});
    else dispatcher.Post(std::move(run));
  }
  void requireOwner() const {if(owner!=std::this_thread::get_id())throw std::runtime_error("Windows services require their JS owner");}
  winrt::Microsoft::ReactNative::ReactContext context;
  const std::thread::id owner;
  std::vector<std::wstring> assetRoots;
  std::shared_ptr<WindowsResizeCoordinator> resize;
  std::shared_ptr<RNSkOwnerAsyncQueue<RNSkAsyncResult>> async;
  std::atomic<bool> sealed{false},failed{false};
  std::mutex mutex;
  std::unordered_map<uint64_t,std::function<void()>> jobs;
  std::string uiFailure;
  uint64_t next=0;
  size_t inFlight=0;
};
} // namespace RNSkia
