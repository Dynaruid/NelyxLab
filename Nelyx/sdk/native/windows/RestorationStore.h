// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <Windows.h>
#include <atomic>
#include <filesystem>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>

namespace Nelyx {
/** Versioned bounded app data; reads use an open snapshot and writes replace atomically. */
class RestorationStore final {
  static constexpr size_t encodedLimit=((4*1024*1024+2)/3)*4;
  static inline std::mutex mutex;
  static inline std::atomic<unsigned long> sequence{0};
  struct Handle {
    HANDLE value;
    explicit Handle(HANDLE handle):value(handle){if(value==INVALID_HANDLE_VALUE)throw std::runtime_error("Restoration file open failed: "+std::to_string(GetLastError()));}
    ~Handle(){if(value!=INVALID_HANDLE_VALUE)CloseHandle(value);}
    Handle(Handle const&)=delete;Handle& operator=(Handle const&)=delete;
    void close(){if(!CloseHandle(value))throw std::runtime_error("Restoration file close failed");value=INVALID_HANDLE_VALUE;}
  };
  std::filesystem::path root;
  static std::filesystem::path defaultRoot(){
    const auto length=GetEnvironmentVariableW(L"LOCALAPPDATA",nullptr,0);if(!length||length>32768)throw std::runtime_error("Local app data directory unavailable");
    std::wstring value(length,L'\0');const auto copied=GetEnvironmentVariableW(L"LOCALAPPDATA",value.data(),length);if(!copied||copied>=length)throw std::runtime_error("Local app data directory changed");value.resize(copied);
    return std::filesystem::path(value)/L"Nelyx"/L"Restoration";
  }
  std::filesystem::path file(std::string const& key)const{
    if(key.size()!=64||key.find_first_not_of("0123456789abcdef")!=std::string::npos)throw std::invalid_argument("Invalid restoration application key");return root/(key+".bin");
  }
  static void validate(std::string const& value){
    if(value.size()>encodedLimit||value.size()%4)throw std::invalid_argument("Restoration value exceeds base64 budget");
    size_t padding=0;while(padding<2&&padding<value.size()&&value[value.size()-padding-1]=='=')++padding;
    if(value.size()/4*3-padding>4*1024*1024)throw std::invalid_argument("Restoration data exceeds 4 MiB");
    for(size_t index=0;index<value.size()-padding;++index){const auto c=value[index];if(!((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='+'||c=='/'))throw std::invalid_argument("Malformed restoration base64");}
  }
public:
  RestorationStore():root(defaultRoot()){}
  explicit RestorationStore(std::filesystem::path directory):root(std::move(directory)){}
  std::optional<std::string> read(std::string const& key)const{
    std::lock_guard<std::mutex> guard(mutex);const auto path=file(key);
    HANDLE raw=CreateFileW(path.c_str(),GENERIC_READ,FILE_SHARE_READ|FILE_SHARE_DELETE,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);
    if(raw==INVALID_HANDLE_VALUE){const auto error=GetLastError();if(error==ERROR_FILE_NOT_FOUND||error==ERROR_PATH_NOT_FOUND)return std::nullopt;throw std::runtime_error("Restoration read failed: "+std::to_string(error));}
    Handle handle(raw);LARGE_INTEGER size{};if(!GetFileSizeEx(handle.value,&size)||size.QuadPart<5||size.QuadPart>static_cast<LONGLONG>(encodedLimit+5))throw std::runtime_error("Invalid restoration file size");
    std::string bytes(static_cast<size_t>(size.QuadPart),'\0');DWORD count=0;if(!ReadFile(handle.value,bytes.data(),static_cast<DWORD>(bytes.size()),&count,nullptr)||count!=bytes.size())throw std::runtime_error("Incomplete restoration read");
    if(bytes.compare(0,5,"OZR1\n"))throw std::runtime_error("Restoration storage version mismatch");auto value=bytes.substr(5);validate(value);return value;
  }
  void write(std::string const& key,std::string const& value)const{
    std::lock_guard<std::mutex> guard(mutex);const auto destination=file(key);validate(value);std::filesystem::create_directories(root);
    const auto temporary=root/(key+".tmp-"+std::to_string(GetCurrentProcessId())+"-"+std::to_string(++sequence));
    try{
      Handle handle(CreateFileW(temporary.c_str(),GENERIC_WRITE,0,nullptr,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,nullptr));const auto bytes=std::string("OZR1\n")+value;DWORD count=0;
      if(!WriteFile(handle.value,bytes.data(),static_cast<DWORD>(bytes.size()),&count,nullptr)||count!=bytes.size()||!FlushFileBuffers(handle.value))throw std::runtime_error("Restoration write/flush failed");handle.close();
      if(!MoveFileExW(temporary.c_str(),destination.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH))throw std::runtime_error("Restoration replacement failed: "+std::to_string(GetLastError()));
    }catch(...){DeleteFileW(temporary.c_str());throw;}
  }
};
}
