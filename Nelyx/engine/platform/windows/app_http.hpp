// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <winhttp.h>
#include <shlwapi.h>
#include "../../core/memory.hpp"
#include <array>
#include <mutex>
#include <string>
#include <vector>
#include <set>
#include <cstring>
#pragma comment(lib,"winhttp.lib")
#pragma comment(lib,"shlwapi.lib")

namespace nelyx::v2::windows {
/** Only owned bytes and WinHTTP handles reach callbacks. No Runtime, JSI
 * values, AppParagraphs or UI/Content objects are accessed from this owner. */
class AppHttpRequest:public std::enable_shared_from_this<AppHttpRequest> {
 public:
  static constexpr uint64_t creditBytes=512*1024;
  struct State {uint32_t phase=0,status=0,error=0;int64_t size=-1;uint64_t bytes=0,requests=0;bool closed=false;};
 private:
  // Declared first, and thus destroyed after buffers and OS handles.
  std::unique_ptr<ExternalLease> memory;
  std::recursive_mutex gate;
  HINTERNET session=nullptr,connection=nullptr,request=nullptr;
  std::shared_ptr<AppHttpRequest> callbacks;
  std::array<uint8_t,65536> storage{};
  State state;
  uint32_t chunkBytes=0;
  bool closing=false,borrowed=false;
  std::wstring originHost;
  INTERNET_PORT originPort=0;INTERNET_SCHEME originScheme{};
  std::array<bool,5> sensitive{};bool stripped=false;
  static constexpr const wchar_t* sensitiveNames[5]={L"Authorization:",L"Proxy-Authorization:",L"Cookie:",L"Cookie2:",L"Host:"};
  std::wstring requestHeaders(const std::string& headers){
    if(headers.size()>16384||headers.find('\0')!=std::string::npos)throw std::runtime_error("Invalid HTTP header bytes");
    size_t at=0,count=0;std::set<std::string> names;
    while(at<headers.size()){
      const auto end=headers.find("\r\n",at),colon=headers.find(':',at);
      if(end==std::string::npos||colon==std::string::npos||colon<=at||colon>=end||++count>32)throw std::runtime_error("Invalid HTTP header line");
      auto name=headers.substr(at,colon-at);
      for(auto& value:name){const auto c=static_cast<unsigned char>(value);if(!((c>='0'&&c<='9')||(c>='a'&&c<='z')||(c>='A'&&c<='Z')||std::strchr("!#$%&'*+-.^_`|~",c)))throw std::runtime_error("Invalid HTTP header name");if(c>='A'&&c<='Z')value=char(c+32);}
      if(!names.insert(name).second)throw std::runtime_error("Duplicate HTTP header name");
      const std::array<const char*,5> keys{"authorization","proxy-authorization","cookie","cookie2","host"};for(size_t i=0;i<keys.size();++i)if(name==keys[i])sensitive[i]=true;
      for(size_t i=colon+1;i<end;++i){const auto c=static_cast<unsigned char>(headers[i]);if((c<32&&c!='\t')||c==127)throw std::runtime_error("Invalid HTTP header value");}
      at=end+2;
    }
    const int size=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,headers.data(),int(headers.size()),nullptr,0);
    if(!headers.empty()&&!size)throw std::runtime_error("Invalid HTTP header UTF-8");
    std::wstring result(size,L'\0');if(size)MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,headers.data(),int(headers.size()),result.data(),size);return result;
  }
  void redirect(const void* bytes,DWORD length){
    std::lock_guard lock(gate);if(closing||stripped||std::none_of(sensitive.begin(),sensitive.end(),[](bool value){return value;}))return;
    // REDIRECT is the callback exception: length counts wchar_t characters,
    // not bytes. See WINHTTP_STATUS_CALLBACK's dwStatusInformationLength.
    if(!bytes||!length||length>4097)throw std::runtime_error("Invalid HTTP redirect");
    const auto* value=static_cast<const wchar_t*>(bytes);size_t size=length;if(value[size-1]==0)--size;
    URL_COMPONENTS target{};target.dwStructSize=sizeof(target);target.dwSchemeLength=target.dwHostNameLength=DWORD(-1);
    if(!WinHttpCrackUrl(value,DWORD(size),0,&target))throw std::runtime_error("Invalid HTTP redirect URL");
    const std::wstring host(target.lpszHostName,target.dwHostNameLength);
    if(target.nScheme==originScheme&&target.nPort==originPort&&_wcsicmp(host.c_str(),originHost.c_str())==0)return;
    // WinHTTP otherwise carries caller headers unchanged across redirects.
    // https://learn.microsoft.com/windows/win32/winhttp/winhttp-security-considerations
    for(size_t i=0;i<sensitive.size();++i)if(sensitive[i]&&!WinHttpAddRequestHeaders(request,sensitiveNames[i],DWORD(-1),WINHTTP_ADDREQ_FLAG_REPLACE))throw std::runtime_error("HTTP redirect header removal failed");
    stripped=true;
  }
  static std::wstring wide(const std::string& value){
    if(value.size()>4096||value.find('\0')!=std::string::npos)throw std::runtime_error("Invalid network URL");
    for(unsigned char c:value)if(c<32||c==127)throw std::runtime_error("Invalid network URL control character");
    const int size=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,value.data(),int(value.size()),nullptr,0);
    if(!value.empty()&&!size)throw std::runtime_error("Invalid network URL UTF-8");
    std::wstring result(size,L'\0');if(size)MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,value.data(),int(value.size()),result.data(),size);return result;
  }
  void fail(DWORD error){state.error=error?error:ERROR_INVALID_DATA;state.phase=5;}
  void headers(){
    DWORD size=sizeof(DWORD),status=0;
    if(!WinHttpQueryHeaders(request,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,WINHTTP_HEADER_NAME_BY_INDEX,&status,&size,WINHTTP_NO_HEADER_INDEX))
      return fail(GetLastError());
    state.status=status;state.size=-1;
    if(status!=200){state.size=0;state.phase=1;return;}
    wchar_t encoding[1024]{};size=sizeof(encoding);
    const bool encoded=WinHttpQueryHeaders(request,WINHTTP_QUERY_CONTENT_ENCODING,WINHTTP_HEADER_NAME_BY_INDEX,encoding,&size,WINHTTP_NO_HEADER_INDEX)&&
      encoding[0]&&_wcsicmp(encoding,L"identity");
    wchar_t length[64]{};size=sizeof(length);
    if(!encoded&&WinHttpQueryHeaders(request,WINHTTP_QUERY_CONTENT_LENGTH,WINHTTP_HEADER_NAME_BY_INDEX,length,&size,WINHTTP_NO_HEADER_INDEX)){
      uint64_t number=0;const auto count=wcslen(length);
      if(!count)return fail(ERROR_INVALID_DATA);
      for(size_t i=0;i<count;++i){if(length[i]<L'0'||length[i]>L'9')return fail(ERROR_INVALID_DATA);
        const auto digit=length[i]-L'0';if(number>(wire::limits::resourceBytes-digit)/10)return fail(ERROR_FILE_TOO_LARGE);number=number*10+digit;}
      if(number>wire::limits::resourceBytes)return fail(ERROR_FILE_TOO_LARGE);
      state.size=int64_t(number);
    }else if(!encoded&&GetLastError()!=ERROR_WINHTTP_HEADER_NOT_FOUND)return fail(GetLastError());
    state.phase=1;
  }
  static void CALLBACK callback(HINTERNET,DWORD_PTR context,DWORD event,void* info,DWORD length)noexcept{
    if(!context)return;
    auto* raw=reinterpret_cast<AppHttpRequest*>(context);
    // callbacks retains the context through HANDLE_CLOSING; this local owner
    // also prevents retirement while the final callback is still on its stack.
    auto self=raw->shared_from_this();
    if(event==WINHTTP_CALLBACK_STATUS_REDIRECT){
      try{self->redirect(info,length);}catch(...){
        {std::lock_guard lock(self->gate);self->fail(ERROR_INVALID_DATA);}
        try{self->cancel();}catch(...){std::lock_guard lock(self->gate);self->fail(ERROR_OPERATION_ABORTED);}
      }
      return;
    }
    std::lock_guard lock(self->gate);
    if(event==WINHTTP_CALLBACK_STATUS_HANDLE_CLOSING){self->state.closed=true;self->callbacks.reset();return;}
    if(self->closing)return;
    try{
      if(event==WINHTTP_CALLBACK_STATUS_REQUEST_SENT)++self->state.requests;
      else if(event==WINHTTP_CALLBACK_STATUS_SENDREQUEST_COMPLETE){
        if(!WinHttpReceiveResponse(self->request,nullptr)&&GetLastError()!=ERROR_IO_PENDING)self->fail(GetLastError());
      }else if(event==WINHTTP_CALLBACK_STATUS_HEADERS_AVAILABLE)self->headers();
      else if(event==WINHTTP_CALLBACK_STATUS_DATA_AVAILABLE){
        if(self->state.phase!=2||length!=sizeof(DWORD)||!info){self->fail(ERROR_INVALID_DATA);return;}
        const auto available=*static_cast<DWORD*>(info);
        // Confirm EOF with ReadData too. QueryDataAvailable alone is not an
        // EOF contract, and a full 64 KiB read can wait on a short live stream.
        const DWORD count=available?std::min<DWORD>(available,DWORD(self->storage.size())):1;
        if(!WinHttpReadData(self->request,self->storage.data(),count,nullptr)&&GetLastError()!=ERROR_IO_PENDING)self->fail(GetLastError());
      }
      else if(event==WINHTTP_CALLBACK_STATUS_REQUEST_ERROR){
        if(length==sizeof(WINHTTP_ASYNC_RESULT)&&info)self->fail(static_cast<WINHTTP_ASYNC_RESULT*>(info)->dwError);else self->fail(ERROR_INVALID_DATA);
      }else if(event==WINHTTP_CALLBACK_STATUS_READ_COMPLETE){
        if(self->state.phase!=2||length>self->storage.size()||(length&&info!=self->storage.data())){self->fail(ERROR_INVALID_DATA);return;}
        self->state.bytes+=length;
        if(self->state.bytes>wire::limits::resourceBytes){self->fail(ERROR_FILE_TOO_LARGE);return;}
        self->chunkBytes=length;self->state.phase=length?3:4;
      }
    }catch(...){self->fail(ERROR_NOT_ENOUGH_MEMORY);}
  }
 public:
  explicit AppHttpRequest(std::shared_ptr<Ledger> ledger):memory(std::make_unique<ExternalLease>(std::move(ledger),6,4,creditBytes)){}
  ~AppHttpRequest(){
    // Once a callback is installed, cancel/retire owns request destruction.
    // Pre-send construction failures have no callbacks and close here instead.
    if(request)WinHttpCloseHandle(request);
    if(connection)WinHttpCloseHandle(connection);
    if(session)WinHttpCloseHandle(session);
  }
  void start(const std::string& base,const std::string& key,const std::string& headers={}){
    const auto additional=requestHeaders(headers);
    const auto baseUrl=wide(base),relative=wide(key);wchar_t combined[4097]{};DWORD count=4097;
    // UrlCombineW(base, L"") drops the last path component. ImageProvider
    // requests an exact URL with an empty key, including its query string.
    if(key.empty())std::copy(baseUrl.begin(),baseUrl.end(),combined);
    else if(FAILED(UrlCombineW(baseUrl.c_str(),relative.c_str(),combined,&count,URL_ESCAPE_SPACES_ONLY|URL_ESCAPE_AS_UTF8)))
      throw std::runtime_error("NetworkAssetBundle URL resolution failed");
    URL_COMPONENTS parts{};parts.dwStructSize=sizeof(parts);parts.dwSchemeLength=parts.dwHostNameLength=parts.dwUrlPathLength=parts.dwExtraInfoLength=DWORD(-1);
    if(!WinHttpCrackUrl(combined,0,0,&parts)||(parts.nScheme!=INTERNET_SCHEME_HTTP&&parts.nScheme!=INTERNET_SCHEME_HTTPS)||!parts.dwHostNameLength)
      throw std::runtime_error("NetworkAssetBundle requires an HTTP(S) URL");
    const std::wstring host(parts.lpszHostName,parts.dwHostNameLength);
    originHost=host;originPort=parts.nPort;originScheme=parts.nScheme;
    std::wstring target(parts.lpszUrlPath,parts.dwUrlPathLength);target.append(parts.lpszExtraInfo,parts.dwExtraInfoLength);
    if(const auto fragment=target.find(L'#');fragment!=std::wstring::npos)target.resize(fragment);
    if(target.empty())target=L"/";
    session=WinHttpOpen(L"Nelyx/2",WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,WINHTTP_FLAG_ASYNC);
    if(!session||!WinHttpSetTimeouts(session,30000,30000,30000,30000))throw std::runtime_error("WinHTTP session initialization failed");
    connection=WinHttpConnect(session,host.c_str(),parts.nPort,0);
    if(!connection)throw std::runtime_error("WinHTTP connection initialization failed");
    request=WinHttpOpenRequest(connection,L"GET",target.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,
      parts.nScheme==INTERNET_SCHEME_HTTPS?WINHTTP_FLAG_SECURE:0);
    DWORD decompress=WINHTTP_DECOMPRESSION_FLAG_GZIP|WINHTTP_DECOMPRESSION_FLAG_DEFLATE,redirects=5;
    if(!request||!WinHttpSetOption(request,WINHTTP_OPTION_DECOMPRESSION,&decompress,sizeof(decompress))||
        !WinHttpSetOption(request,WINHTTP_OPTION_MAX_HTTP_AUTOMATIC_REDIRECTS,&redirects,sizeof(redirects)))
      throw std::runtime_error("WinHTTP request initialization failed");
    if(!additional.empty()&&!WinHttpAddRequestHeaders(request,additional.c_str(),DWORD(additional.size()),WINHTTP_ADDREQ_FLAG_ADD))throw std::runtime_error("WinHTTP request headers failed");
    callbacks=shared_from_this();auto context=reinterpret_cast<DWORD_PTR>(this);
    if(!WinHttpSetOption(request,WINHTTP_OPTION_CONTEXT_VALUE,&context,sizeof(context))||
        WinHttpSetStatusCallback(request,callback,WINHTTP_CALLBACK_FLAG_ALL_NOTIFICATIONS,0)==WINHTTP_INVALID_STATUS_CALLBACK){
      callbacks.reset();throw std::runtime_error("WinHTTP callback initialization failed");
    }
    std::lock_guard lock(gate);
    if(!WinHttpSendRequest(request,WINHTTP_NO_ADDITIONAL_HEADERS,0,WINHTTP_NO_REQUEST_DATA,0,0,context)&&GetLastError()!=ERROR_IO_PENDING)fail(GetLastError());
  }
  State snapshot(){std::lock_guard lock(gate);return state;}
  void read(){
    std::lock_guard lock(gate);
    if(closing||state.phase!=1||borrowed)throw std::runtime_error("Network read is pending/borrowed/closed");
    state.phase=2;
    if(!WinHttpQueryDataAvailable(request,nullptr)&&GetLastError()!=ERROR_IO_PENDING)fail(GetLastError());
  }
  struct Chunk {
    std::shared_ptr<AppHttpRequest> owner;std::vector<uint8_t> bytes;
    Chunk(std::shared_ptr<AppHttpRequest> owner,std::vector<uint8_t> bytes):owner(std::move(owner)),bytes(std::move(bytes)){}
    Chunk(Chunk&&)=default;Chunk(const Chunk&)=delete;
    ~Chunk(){if(owner){std::lock_guard lock(owner->gate);owner->borrowed=false;}}
  };
  Chunk chunk(){
    std::lock_guard lock(gate);
    if(closing||state.phase!=3||borrowed)throw std::runtime_error("Network chunk is unavailable/borrowed/closed");
    std::vector<uint8_t> bytes(storage.begin(),storage.begin()+chunkBytes);state.phase=1;chunkBytes=0;borrowed=true;
    return Chunk(shared_from_this(),std::move(bytes));
  }
  void cancel(){
    HINTERNET handle;
    {std::lock_guard lock(gate);if(closing)return;closing=true;handle=request;request=nullptr;
      if(!handle&&!callbacks)state.closed=true;}
    if(handle){if(!WinHttpCloseHandle(handle))throw std::runtime_error("WinHTTP cancellation failed");}
  }
};
}
