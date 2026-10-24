// SPDX-License-Identifier: BSD-3-Clause
#include "../../skia/packages/rn/native/windows/ObservedKeyboardState.h"
#include "../../skia/packages/rn/native/windows/WindowsKeyboardInput.h"
#include <iostream>
#include <tuple>
void check(bool,char const*);
void keyboardSourceChecks(){
  using namespace RNSkia;ObservedKeyboardState source;const auto owner=source.newOwner(),other=source.newOwner();
  source.character('x',0,1,1);check(!source.takeCharacter(owner,'x',0),"Unfocused native character was admitted");source.focus(owner);
  source.character('A',30,2,7);check(!source.takeCharacter(other,'A',30)&&!source.takeCharacter(owner,'B',30),"A foreign/mismatched routed character consumed WM_CHAR proof");
  auto observed=source.takeCharacter(owner,'A',30);check(observed&&observed->repeatCount==2&&observed->focusEpoch==7&&!source.takeCharacter(owner,'A',30),"A native character token was replayed or lost its actual repeat/focus data");
  std::vector<WindowsKeyPacket> keys;std::vector<std::tuple<uint32_t,uint32_t,uint64_t>> text;std::vector<char> order;
  WindowsKeyboardInput input([&](WindowsKeyPacket const& packet){keys.push_back(packet);order.push_back('k');},[&](uint32_t point,WindowsCharacterObservation const& value){text.emplace_back(point,value.repeatCount,value.focusEpoch);order.push_back('t');});
  WindowsKeyPacket a;a.keyCode=65;a.scanCode=30;a.repeatCount=2;input.key(a,true);input.character('A',30,observed);check(keys.size()==1&&keys.back().characterCodePoint=='A'&&keys.back().focusEpoch==7&&text.empty(),"A paired key became duplicate standalone text");
  input.character('x',0);check(text.empty(),"Dead/system/unobserved text was manufactured");
  source.character(0xd55c,0,2,7);input.character(0xd55c,0,source.takeCharacter(owner,0xd55c,0));check(text.size()==1&&text.back()==std::tuple<uint32_t,uint32_t,uint64_t>{0xd55c,2,7},"An admitted standalone UTF-16 character was dropped");
  source.character(0xd83d,0,1,7);input.character(0xd83d,0,source.takeCharacter(owner,0xd83d,0));source.character(0xde00,0,1,8);input.character(0xde00,0,source.takeCharacter(owner,0xde00,0));check(text.size()==1,"Surrogates crossed a TSF document focus boundary");
  for(uint32_t unit:{0xd83du,0xde00u}){source.character(unit,0,3,8);input.character(unit,0,source.takeCharacter(owner,unit,0));}check(text.size()==2&&text.back()==std::tuple<uint32_t,uint32_t,uint64_t>{0x1f600,3,8},"A standalone surrogate pair lost its scalar or repeat count");
  source.character(0xd83d,0x3d,1,8);source.character(0xde00,0,1,8);const auto scalar=source.takeCharacter(owner,0x1f600,0);check(scalar&&!source.takeCharacter(owner,0xde00,0),"An already combined routed scalar failed to consume both UTF-16 packet tokens");
  input.key(a,true);source.character('z',44,1,8);input.character('z',44,source.takeCharacter(owner,'z',44));check(order.size()>=2&&order[order.size()-2]=='k'&&order.back()=='t'&&keys.back().characterCodePoint==0,"Unpaired text overtook an earlier unmatched key");
  for(uint32_t unit:{0u,13u,0x7fu}){source.character(unit,0,1,8);input.character(unit,0,source.takeCharacter(owner,unit,0));}check(text.size()==3,"A control character became standalone text");
  source.character('q',0,1,8);source.focus(other);check(!source.takeCharacter(owner,'q',0)&&!source.takeCharacter(other,'q',0),"A native canvas replacement inherited an old character token");
  check(source.snapshot().empty(),"Standalone text synthesized a physical key state");input.reset();
  // The host reports an actual consumed up. Reentering the observation owner
  // must be safe, and an earlier pending down must precede its matched release.
  std::vector<WindowsKeyPacket> released;WindowsKeyboardInput releaseInput([&](WindowsKeyPacket const& packet){released.push_back(packet);source.observe(other,packet.keyCode,packet.scanCode,packet.up);});
  unsigned consumed=0;const auto receive=[&](ObservedKeyboardState::FocusStamp const& focus,uint32_t key,uint32_t scan,uint32_t repeat){check(source.focused(focus),"Consumed up reached a retired owner");++consumed;releaseInput.flush();if(const auto pressed=source.pressed(focus.owner,key,scan)){WindowsKeyPacket up;up.keyCode=pressed->keyCode;up.scanCode=pressed->scanCode;up.up=true;up.repeatCount=repeat;releaseInput.key(up,false);}};
  source.focus(other,receive);const auto lease=*source.focusStamp();releaseInput.key(a,true);source.consumedKeyUp(lease,a.keyCode,a.scanCode,1);
  check(consumed==1&&released.size()==2&&!released[0].up&&released[1].up&&released[1].keyCode==a.keyCode&&source.snapshot().empty(),"A TSF-consumed up lost its earlier pending down or left a held physical key");
  source.consumedKeyUp(lease,82,19,1);check(released.size()==2,"A consumed up manufactured an unobserved physical down/up");
  source.observe(other,65,30,false);check(!source.pressed(owner,65,30)&&source.pressed(other,90,30)->keyCode==65,"Consumed release lost its original observed layout identity or owner guard");
  source.blur(owner);check(source.focused(other),"A foreign blur removed the current release observer");source.blur(other);source.consumedKeyUp(lease,65,30,1);check(consumed==2,"A blurred canvas received a consumed key release");
  source.focus(other,receive);source.observe(other,65,30,false);source.consumedKeyUp(lease,65,30,1);check(consumed==2&&source.snapshot().size()==1,"A consumed up crossed blur/refocus to release a new press on the same canvas");source.observe(other,65,30,true);source.focus(owner,[&](auto const&,uint32_t,uint32_t,uint32_t){source.focus(other);});const auto reentrant=*source.focusStamp();source.consumedKeyUp(reentrant,65,30,1);check(source.focused(other),"Consumed-up observer could not replace its own owner");source.close();source.consumedKeyUp(reentrant,65,30,1);
  std::cout<<"PASS-keyboard-source: paired key/text exclusion, owned once-only WM_CHAR proof, standalone UTF-16/scalar/repeat, same-focus surrogate assembly, old key ordering, controls, consumed-up ordering/owner retirement and unobserved-key exclusion. Actual RNW routing is a separate surface check.\n";
}
