// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>
namespace NelyxDevelopment {
struct Source {std::wstring host;uint16_t port;};
inline std::optional<Source> parse(const std::optional<std::wstring>& host,const std::optional<std::wstring>& port,bool enabled){
  if(!host&&!port)return {};
  if(!enabled)throw std::runtime_error("Release does not accept Windows development source");
  if(!host||!port||(*host!=L"127.0.0.1"&&*host!=L"localhost")||port->empty()||port->size()>5)throw std::runtime_error("Explicit Windows loopback host/port required");
  unsigned value=0;for(auto digit:*port){if(digit<L'0'||digit>L'9')throw std::runtime_error("Invalid Windows development port");value=value*10+digit-L'0';}
  if(!value||value>65535)throw std::runtime_error("Invalid Windows development port");return Source{*host,static_cast<uint16_t>(value)};
}
inline std::optional<std::wstring> environment(const wchar_t* name){
  wchar_t buffer[64]{};SetLastError(ERROR_SUCCESS);const auto size=GetEnvironmentVariableW(name,buffer,64);
  if(!size&&GetLastError()==ERROR_ENVVAR_NOT_FOUND)return {};
  if(!size||size>=64)throw std::runtime_error("Invalid Windows development environment value");return std::wstring(buffer,size);
}
inline std::optional<Source> read(bool enabled){return parse(environment(L"NELYX_WINDOWS_DEV_HOST"),environment(L"NELYX_WINDOWS_DEV_PORT"),enabled);}
}
