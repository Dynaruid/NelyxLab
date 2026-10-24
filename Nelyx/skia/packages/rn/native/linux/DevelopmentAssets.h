// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <libsoup/soup.h>
#include <chrono>
#include <condition_variable>
#include <cstring>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace RNSkia {
inline bool linuxDevelopmentOrigin(const std::string& origin) {
  if(origin.size()>4096)return false;
  GError* error{};auto* uri=g_uri_parse(origin.c_str(),G_URI_FLAGS_NONE,&error);
  const auto* host=uri?g_uri_get_host(uri):nullptr;const auto* scheme=uri?g_uri_get_scheme(uri):nullptr;
  const bool valid=uri&&scheme&&std::strcmp(scheme,"http")==0&&host&&
    (std::strcmp(host,"127.0.0.1")==0||std::strcmp(host,"localhost")==0)&&g_uri_get_port(uri)>0&&g_uri_get_port(uri)<=65535&&
    !g_uri_get_userinfo(uri)&&!g_uri_get_query(uri)&&!g_uri_get_fragment(uri)&&std::string(g_uri_get_path(uri)).empty();
  if(uri)g_uri_unref(uri);if(error)g_error_free(error);return valid;
}
inline std::string checkedLinuxDevelopmentOrigin(std::string origin) {
  if(!origin.empty()&&!linuxDevelopmentOrigin(origin))throw std::runtime_error("Explicit Linux loopback development origin required");return origin;
}
inline bool linuxDevelopmentAssetUri(const std::string& url,const std::string& origin) {
  if(url.size()>4096||!linuxDevelopmentOrigin(origin)||!url.starts_with(origin+"/assets/"))return false;
  GError* error{};auto* uri=g_uri_parse(url.c_str(),G_URI_FLAGS_NONE,&error);bool valid=uri&&!g_uri_get_userinfo(uri)&&!g_uri_get_fragment(uri);
  if(valid){const std::string path=g_uri_get_path(uri);valid=path.starts_with("/assets/")&&path.size()>8&&path.find('\\')==std::string::npos;
    for(size_t start=1;valid&&start<=path.size();){const auto end=path.find('/',start);const auto part=path.substr(start,end==std::string::npos?end:end-start);if(part.empty()||part=="."||part=="..")valid=false;if(end==std::string::npos)break;start=end+1;}}
  if(uri)g_uri_unref(uri);if(error)g_error_free(error);return valid;
}
/** Bounded synchronous read on the calling native owner. Only the deadline
 * thread sees GCancellable; no JSI/callback/runtime values cross threads. */
inline std::vector<unsigned char> readLinuxDevelopmentAsset(const std::string& url,const std::string& origin,
    std::chrono::milliseconds limit=std::chrono::seconds(10)) {
  if(!linuxDevelopmentAssetUri(url,origin)||limit.count()<=0)throw std::runtime_error("Linux development asset URI rejected");
  struct Request {
    SoupSession* session=soup_session_new();SoupMessage* message{};GCancellable* cancel=g_cancellable_new();GInputStream* stream{};GError* error{};
    ~Request(){if(stream){g_input_stream_close(stream,nullptr,nullptr);g_object_unref(stream);}if(error)g_error_free(error);if(message)g_object_unref(message);soup_session_abort(session);g_object_unref(session);g_object_unref(cancel);}
  } request;
  soup_session_set_timeout(request.session,5);soup_session_set_proxy_resolver(request.session,nullptr);
  request.message=soup_message_new("GET",url.c_str());if(!request.message)throw std::runtime_error("Invalid Linux asset URL");
  soup_message_set_flags(request.message,static_cast<SoupMessageFlags>(soup_message_get_flags(request.message)|SOUP_MESSAGE_NO_REDIRECT));
  struct Deadline {
    std::mutex mutex;std::condition_variable cv;bool done=false;std::thread thread;
    Deadline(GCancellable* cancel,std::chrono::milliseconds limit):thread([this,cancel,limit]{std::unique_lock lock(mutex);if(!cv.wait_for(lock,limit,[this]{return done;}))g_cancellable_cancel(cancel);}){}
    ~Deadline(){{std::lock_guard lock(mutex);done=true;}cv.notify_one();thread.join();}
  } deadline(request.cancel,limit);
  request.stream=soup_session_send(request.session,request.message,request.cancel,&request.error);
  if(!request.stream||soup_message_get_status(request.message)!=200)throw std::runtime_error("Linux development asset HTTP request failed");
  constexpr size_t maximum=16u*1024u*1024u;
  if(soup_message_headers_get_content_length(soup_message_get_response_headers(request.message))>static_cast<goffset>(maximum))throw std::runtime_error("Linux development asset exceeds16MiB");
  std::vector<unsigned char> bytes;unsigned char buffer[65536];
  for(;;){const auto count=g_input_stream_read(request.stream,buffer,sizeof(buffer),request.cancel,&request.error);
    if(count<0)throw std::runtime_error("Linux development asset read failed");if(!count)break;
    if(bytes.size()+static_cast<size_t>(count)>maximum)throw std::runtime_error("Linux development asset exceeds16MiB");bytes.insert(bytes.end(),buffer,buffer+count);}
  if(bytes.empty())throw std::runtime_error("Linux development asset is empty");return bytes;
}
}
