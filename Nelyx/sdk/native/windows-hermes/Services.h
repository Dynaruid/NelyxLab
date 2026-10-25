// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <winrt/Windows.UI.ViewManagement.h>
#include <string>
#include <vector>
namespace Nelyx::NativeHermes {
inline HCURSOR systemCursor(std::wstring const& kind){
  if(kind==L"none")return nullptr;
  const auto id=kind==L"click"?32649:kind==L"text"||kind==L"verticalText"?32513:kind==L"precise"||kind==L"cell"?32515:kind==L"wait"?32514:kind==L"progress"?32650:kind==L"help"?32651:kind==L"forbidden"||kind==L"noDrop"?32648:kind==L"move"||kind==L"allScroll"?32646:kind==L"resizeLeftRight"||kind==L"resizeColumn"||kind==L"resizeLeft"||kind==L"resizeRight"?32644:kind==L"resizeUpDown"||kind==L"resizeRow"||kind==L"resizeUp"||kind==L"resizeDown"?32645:kind==L"resizeUpLeftDownRight"||kind==L"resizeUpLeft"||kind==L"resizeDownRight"?32642:kind==L"resizeUpRightDownLeft"||kind==L"resizeUpRight"||kind==L"resizeDownLeft"?32643:32512;
  auto cursor=LoadCursorW(nullptr,MAKEINTRESOURCEW(id));if(!cursor)throw std::runtime_error("Windows system cursor unavailable");return cursor;
}
struct Environment {std::vector<std::wstring> locales;bool light=true,visible=true,active=true;double textScale=1;int features=0;};
inline Environment readEnvironment(HWND window){
  Environment value;ULONG count=0,size=0;
  if(!GetUserPreferredUILanguages(MUI_LANGUAGE_NAME,&count,nullptr,&size)||size>32768)throw std::runtime_error("Preferred languages unavailable");
  std::vector<wchar_t> buffer(size);if(!GetUserPreferredUILanguages(MUI_LANGUAGE_NAME,&count,buffer.data(),&size))throw std::runtime_error("Preferred language read failed");
  for(const wchar_t* at=buffer.data();*at;at+=wcslen(at)+1)value.locales.emplace_back(at);
  DWORD light=1,length=sizeof(light);const auto result=RegGetValueW(HKEY_CURRENT_USER,L"Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",L"AppsUseLightTheme",RRF_RT_REG_DWORD,nullptr,&light,&length);if(result!=ERROR_SUCCESS&&result!=ERROR_FILE_NOT_FOUND)throw std::runtime_error("Theme read failed");value.light=light!=0;
  BOOL animation=TRUE;HIGHCONTRASTW contrast{};contrast.cbSize=sizeof(contrast);if(!SystemParametersInfoW(SPI_GETCLIENTAREAANIMATION,0,&animation,0)||!SystemParametersInfoW(SPI_GETHIGHCONTRAST,sizeof(contrast),&contrast,0))throw std::runtime_error("Accessibility snapshot failed");
  value.features=(animation?0:4|16)|((contrast.dwFlags&HCF_HIGHCONTRASTON)?32:0);
  value.textScale=winrt::Windows::UI::ViewManagement::UISettings().TextScaleFactor();value.visible=IsWindowVisible(window)&&!IsIconic(window);value.active=GetForegroundWindow()==window;return value;
}
class Clipboard final {
public:
  explicit Clipboard(HWND window){if(!OpenClipboard(window))throw std::runtime_error("Clipboard is busy");}
  ~Clipboard(){CloseClipboard();}
  std::wstring read(){if(!IsClipboardFormatAvailable(CF_UNICODETEXT))return {};auto data=GetClipboardData(CF_UNICODETEXT);if(!data)throw std::runtime_error("Clipboard read failed");const auto size=GlobalSize(data);if(size>2*1024*1024||size<sizeof(wchar_t))throw std::runtime_error("Clipboard text exceeds2MiB");auto text=static_cast<wchar_t*>(GlobalLock(data));if(!text)throw std::runtime_error("Clipboard lock failed");const auto limit=size/sizeof(wchar_t),length=wcsnlen(text,limit);std::wstring result;if(length<limit)result.assign(text,length);GlobalUnlock(data);if(length==limit)throw std::runtime_error("Clipboard text has no terminator");return result;}
  void write(std::wstring const& text){if(text.size()>1024*1024||text.find(L'\0')!=std::wstring::npos)throw std::runtime_error("Invalid clipboard text");auto data=GlobalAlloc(GMEM_MOVEABLE,(text.size()+1)*sizeof(wchar_t));if(!data)throw std::bad_alloc();auto bytes=GlobalLock(data);if(!bytes){GlobalFree(data);throw std::runtime_error("Clipboard allocation lock failed");}memcpy(bytes,text.c_str(),(text.size()+1)*sizeof(wchar_t));GlobalUnlock(data);if(!EmptyClipboard()||!SetClipboardData(CF_UNICODETEXT,data)){GlobalFree(data);throw std::runtime_error("Clipboard write failed");}}
};
}
