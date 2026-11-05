// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <cstring>
#include <optional>
#include <string>
#include <string_view>

namespace nelyx::v2::windows {
struct ClipboardApi {
  static bool open(HWND window){return OpenClipboard(window)!=0;}
  static void close(){CloseClipboard();}
  static HGLOBAL allocate(size_t bytes){return GlobalAlloc(GMEM_MOVEABLE,bytes);}
  static void* lock(HGLOBAL memory){return GlobalLock(memory);}
  static void unlock(HGLOBAL memory){GlobalUnlock(memory);}
  static void free(HGLOBAL memory){GlobalFree(memory);}
  static bool empty(){return EmptyClipboard()!=0;}
  static bool set(HGLOBAL memory){return SetClipboardData(CF_UNICODETEXT,memory)!=nullptr;}
  static HGLOBAL get(){return GetClipboardData(CF_UNICODETEXT);}
  static size_t size(HGLOBAL memory){return GlobalSize(memory);}
};
// Clipboard failure is a failed edit command, never an empty replacement.
template<class Api=ClipboardApi>
inline bool copyClipboard(HWND window,std::u16string_view text) {
  if(!window||text.size()>65536)return false;
  if(!Api::open(window))return false;
  struct Close { ~Close(){Api::close();} } close;
  const auto bytes=(text.size()+1)*sizeof(char16_t);
  const auto memory=Api::allocate(bytes);
  if(!memory)return false;
  auto target=Api::lock(memory);
  if(!target){Api::free(memory);return false;}
  std::memcpy(target,text.data(),text.size()*sizeof(char16_t));
  static_cast<char16_t*>(target)[text.size()]=0;Api::unlock(memory);
  if(!Api::empty()||!Api::set(memory)){Api::free(memory);return false;}
  return true; // Win32 owns memory after SetClipboardData succeeds.
}
template<class Api=ClipboardApi>
inline std::optional<std::u16string> pasteClipboard(HWND window,size_t maximum) {
  if(!Api::open(window))return {};
  struct Close { ~Close(){Api::close();} } close;
  const auto memory=Api::get();
  if(!memory)return {};
  const auto units=Api::size(memory)/sizeof(char16_t);
  if(!units)return {};
  const auto source=static_cast<const char16_t*>(Api::lock(memory));
  if(!source)return {};
  struct Unlock { HGLOBAL memory;~Unlock(){Api::unlock(memory);} } unlock{memory};
  size_t length=0;
  while(length<units&&length<=maximum&&source[length])++length;
  if(length==units||length>maximum)return {};
  return std::u16string(source,length);
}
}
