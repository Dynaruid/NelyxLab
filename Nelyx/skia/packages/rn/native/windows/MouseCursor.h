// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
#pragma once
#include <Windows.h>
#include <inspectable.h>
#include <map>
#include <string>
#include <winrt/Microsoft.UI.Input.h>
namespace ABI::Microsoft::UI::Input {struct IInputCursor;}
#include <Microsoft.UI.Input.InputCursor.Interop.h>
namespace RNSkia {
inline winrt::Microsoft::UI::Input::InputCursor windowsMouseCursor(const std::string& kind) {
static const std::map<std::string,const wchar_t*> cursors={
      {"allScroll", IDC_SIZEALL},
      {"basic", IDC_ARROW},
      {"click", IDC_HAND},
      {"forbidden", IDC_NO},
      {"help", IDC_HELP},
      {"move", IDC_SIZEALL},
      {"none", nullptr},
      {"noDrop", IDC_NO},
      {"precise", IDC_CROSS},
      {"progress", IDC_APPSTARTING},
      {"text", IDC_IBEAM},
      {"resizeColumn", IDC_SIZEWE},
      {"resizeDown", IDC_SIZENS},
      {"resizeDownLeft", IDC_SIZENESW},
      {"resizeDownRight", IDC_SIZENWSE},
      {"resizeLeft", IDC_SIZEWE},
      {"resizeLeftRight", IDC_SIZEWE},
      {"resizeRight", IDC_SIZEWE},
      {"resizeRow", IDC_SIZENS},
      {"resizeUp", IDC_SIZENS},
      {"resizeUpDown", IDC_SIZENS},
      {"resizeUpLeft", IDC_SIZENWSE},
      {"resizeUpRight", IDC_SIZENESW},
      {"resizeUpLeftDownRight", IDC_SIZENWSE},
      {"resizeUpRightDownLeft", IDC_SIZENESW},
      {"wait", IDC_WAIT},
  };
  auto found=cursors.find(kind);const auto name=found==cursors.end()?IDC_ARROW:found->second;
  if(!name)return nullptr;
  auto handle=::LoadCursorW(nullptr,name);if(!handle)winrt::throw_last_error();
  auto factory=winrt::get_activation_factory<winrt::Microsoft::UI::Input::InputCursor,ABI::Microsoft::UI::Input::IInputCursorStaticsInterop>();
  winrt::com_ptr<IUnknown> result;
  winrt::check_hresult(factory->CreateFromHCursor(handle,reinterpret_cast<ABI::Microsoft::UI::Input::IInputCursor**>(result.put_void())));
  return result.as<winrt::Microsoft::UI::Input::InputCursor>();
}
/** A mounted canvas borrows its island cursor only while actually hovered. */
class WindowsMouseCursor {
public:
  void bind(winrt::Microsoft::UI::Input::InputPointerSource const& value){release();source=value;}
  void kind(std::string value){requested=std::move(value);}
  void apply(){if(!source)return;auto current=source.Cursor();if(!owned||current!=applied)previous=current;applied=windowsMouseCursor(requested);owned=true;source.Cursor(applied);}
  void release(){if(source&&owned&&source.Cursor()==applied)source.Cursor(previous);owned=false;applied=nullptr;previous=nullptr;}
  void detach(){release();source=nullptr;}
private:
  std::string requested="basic";bool owned=false;
  winrt::Microsoft::UI::Input::InputPointerSource source{nullptr};
  winrt::Microsoft::UI::Input::InputCursor previous{nullptr},applied{nullptr};
};
}
