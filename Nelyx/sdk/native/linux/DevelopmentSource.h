// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <glib.h>
#include <cstdlib>
#include <cstring>
#include <optional>
#include <stdexcept>
#include <string>
struct NelyxDevelopmentSource {std::string bundle,origin;};
inline std::optional<NelyxDevelopmentSource> nelyxDevelopmentSource(const char* value) {
  if(!value)return std::nullopt;
#ifdef NDEBUG
  throw std::runtime_error("Linux development source requires a Debug executable");
#else
  if(std::strlen(value)>4096)throw std::runtime_error("Linux development URL too long");
  GError* error{};auto* uri=g_uri_parse(value,G_URI_FLAGS_NONE,&error);
  const auto* host=uri?g_uri_get_host(uri):nullptr;const auto* scheme=uri?g_uri_get_scheme(uri):nullptr;const auto* query=uri?g_uri_get_query(uri):nullptr;
  const bool valid=uri&&scheme&&std::strcmp(scheme,"http")==0&&host&&(std::strcmp(host,"127.0.0.1")==0||std::strcmp(host,"localhost")==0)&&
    g_uri_get_port(uri)>0&&g_uri_get_port(uri)<=65535&&!g_uri_get_userinfo(uri)&&!g_uri_get_fragment(uri)&&std::strcmp(g_uri_get_path(uri),"/main.bundle")==0&&
    query&&std::strcmp(query,"platform=linux&dev=true&hot=true&minify=false&runModule=true")==0;
  std::string origin;if(valid)origin=std::string("http://")+host+":"+std::to_string(g_uri_get_port(uri));
  if(uri)g_uri_unref(uri);if(error)g_error_free(error);if(!valid)throw std::runtime_error("Linux development URL requires the owning loopback main bundle");
  return NelyxDevelopmentSource{value,std::move(origin)};
#endif
}
