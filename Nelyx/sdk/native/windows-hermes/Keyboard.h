// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "Editors.h"
#include "windows/WindowsKeyboardInput.h"
#include "windows/ObservedKeyboardState.h"
#include "windows/WindowsMonotonic.h"
namespace Nelyx::NativeHermes {
class Keyboard final {
public:
  struct Event{std::string kind;uint64_t sequence=0;double timestamp=0;bool focused=false;RNSkia::WindowsKeyPacket key;Editors::Token editor;};
  using Sink=std::function<void(Event)>;
  Keyboard(HWND window,std::shared_ptr<Editors> editors,Sink sink):window(window),editors(std::move(editors)),sink(std::move(sink)),owner(state.newOwner()),input([this](auto const& key){state.observe(owner,key.keyCode,key.scanCode,key.up);send("native-key",key);},[this](uint32_t point,auto const& observation){RNSkia::WindowsKeyPacket key;key.characterCodePoint=point;key.repeatCount=observation.repeatCount;key.focusEpoch=observation.focusEpoch;send("native-text",key);}){}
  void focus(bool value){input.flush();if(value)state.focus(owner);else{state.blur(owner);input.reset();}Event e;e.kind="native-keyboard-focus";e.focused=value;e.sequence=++sequence;e.timestamp=RNSkia::windowsMonotonicMilliseconds();sink(std::move(e));}
  void key(UINT key,LPARAM data,bool up){
    input.flush();keyTimestamp=RNSkia::windowsMonotonicMilliseconds();const auto scan=scanCode(data);if(key==VK_SHIFT)key=MapVirtualKeyW(scan,MAPVK_VSC_TO_VK_EX);else if(key==VK_CONTROL)key=(data&(1LL<<24))?VK_RCONTROL:VK_LCONTROL;else if(key==VK_MENU)key=(data&(1LL<<24))?VK_RMENU:VK_LMENU;
    RNSkia::WindowsKeyPacket packet;packet.keyCode=key;packet.scanCode=scan;packet.up=up;packet.repeat=!up&&bool(data&(1LL<<30));packet.repeatCount=LOWORD(data);packet.focusEpoch=epoch();
    const auto held=[](int key){return GetKeyState(key)<0;};packet.modifiers=(held(VK_SHIFT)?1:0)|(held(VK_LSHIFT)?2:0)|(held(VK_RSHIFT)?4:0)|(held(VK_CONTROL)?8:0)|(held(VK_LCONTROL)?16:0)|(held(VK_RCONTROL)?32:0)|(held(VK_MENU)?64:0)|(held(VK_LMENU)?128:0)|(held(VK_RMENU)?256:0)|(held(VK_LWIN)?512:0)|(held(VK_RWIN)?1024:0);packet.capsLock=(GetKeyState(VK_CAPITAL)&1)!=0;packet.numLock=(GetKeyState(VK_NUMLOCK)&1)!=0;packet.scrollLock=(GetKeyState(VK_SCROLL)&1)!=0;
    MSG next{};const bool character=!up&&PeekMessageW(&next,window,WM_CHAR,WM_DEADCHAR,PM_NOREMOVE)&&scanCode(next.lParam)==scan;packet.dead=character&&next.message==WM_DEADCHAR;
    input.key(packet,character&&!packet.dead);
  }
  void character(uint32_t unit,LPARAM data){const auto focus=state.focusStamp();if(!focus)return;input.character(unit,scanCode(data),RNSkia::WindowsCharacterObservation{uint32_t(LOWORD(data)),focus->generation});}
  void consumed(MSG const& message){input.flush();if(message.message!=WM_KEYUP&&message.message!=WM_SYSKEYUP)return;auto pressed=state.pressed(owner,UINT(message.wParam),scanCode(message.lParam));if(!pressed)return;keyTimestamp=RNSkia::windowsMonotonicMilliseconds();RNSkia::WindowsKeyPacket packet;packet.keyCode=pressed->keyCode;packet.scanCode=pressed->scanCode;packet.up=true;packet.repeatCount=LOWORD(message.lParam);packet.focusEpoch=epoch();input.key(packet,false);}
  void flush(){input.flush();}
  auto snapshot()const{return state.snapshot();}
  uint64_t epoch()const{const auto focus=state.focusStamp();return focus?focus->generation:0;}
private:
  static uint32_t scanCode(LPARAM data){return uint32_t((data>>16)&0xff)|((data&(1LL<<24))?0xe000u:0);}
  void send(std::string kind,RNSkia::WindowsKeyPacket const& key){Event e;e.timestamp=kind=="native-key"?keyTimestamp:RNSkia::windowsMonotonicMilliseconds();e.kind=std::move(kind);e.sequence=++sequence;e.key=key;e.editor=editors->focusToken();sink(std::move(e));}
  HWND window;std::shared_ptr<Editors> editors;Sink sink;RNSkia::ObservedKeyboardState state;uint64_t owner,sequence=0;double keyTimestamp=0;RNSkia::WindowsKeyboardInput input;
};
}
