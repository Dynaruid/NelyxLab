// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
#pragma once
#include "WindowsCharacterObservation.h"
#include <cstdint>
#include <functional>
#include <optional>
#include <utility>

namespace RNSkia {
struct WindowsKeyPacket {
  uint32_t keyCode=0,scanCode=0,characterCodePoint=0,modifiers=0,repeatCount=0;
  uint64_t focusEpoch=0;
  bool up=false,repeat=false,dead=false,capsLock=false,numLock=false,scrollLock=false;
};
/** Pair an observed key with its actual character, like the pinned Win32
 * KeyboardManager session. No key-code-to-character guess is used here.
 * The owning RNW adapter supplies the actual queued-char/dead-key observation. */
class WindowsKeyboardInput final {
 public:
  using Sink=std::function<void(const WindowsKeyPacket&)>;
  using TextSink=std::function<void(uint32_t,WindowsCharacterObservation const&)>;
  explicit WindowsKeyboardInput(Sink sink,TextSink text={}):sink_(std::move(sink)),text_(std::move(text)){}
  void key(WindowsKeyPacket packet,bool expectCharacter){
    flush();unpairedHigh_=0;
    if(packet.up||!expectCharacter){sink_(packet);return;}
    pending_=packet;
  }
  void character(uint32_t codePoint,uint32_t scanCode,std::optional<WindowsCharacterObservation> admitted={}){
    if(!pending_||pending_->scanCode!=scanCode){
      if(!admitted||!text_){unpairedHigh_=0;return;}flush();
      if(codePoint>=0xd800&&codePoint<=0xdbff){unpairedHigh_=codePoint;unpairedObservation_=*admitted;return;}
      if(codePoint>=0xdc00&&codePoint<=0xdfff){const auto high=std::exchange(unpairedHigh_,0u);if(!high||unpairedObservation_.repeatCount!=admitted->repeatCount||unpairedObservation_.focusEpoch!=admitted->focusEpoch)return;codePoint=0x10000+((high-0xd800)<<10)+(codePoint-0xdc00);}else unpairedHigh_=0;
      if(codePoint>=0x20&&codePoint<=0x10ffff&&codePoint!=0x7f)text_(codePoint,*admitted);return;
    }
    if(high_&&admitted&&(pending_->focusEpoch!=admitted->focusEpoch||pending_->repeatCount!=admitted->repeatCount)){finish(0);return;}if(admitted){pending_->focusEpoch=admitted->focusEpoch;pending_->repeatCount=admitted->repeatCount;}
    if(codePoint>=0xd800&&codePoint<=0xdbff){high_=codePoint;return;}
    if(codePoint>=0xdc00&&codePoint<=0xdfff){
      if(!high_)return;
      codePoint=0x10000+((high_-0xd800)<<10)+(codePoint-0xdc00);
    }else if(high_){high_=0;}
    if(codePoint>0x10ffff)return;
    // Pinned native IsPrintable excludes low control codes and DEL.
    finish(codePoint>=0x20&&codePoint!=0x7f?codePoint:0);
  }
  void flush(){if(pending_)finish(0);}
  void reset(){pending_.reset();high_=0;unpairedHigh_=0;}
  bool pending() const{return pending_.has_value();}
 private:
  void finish(uint32_t character){auto packet=*pending_;pending_.reset();high_=0;packet.characterCodePoint=character;sink_(packet);}
  Sink sink_;
  TextSink text_;
  std::optional<WindowsKeyPacket> pending_;
  uint32_t high_=0;
  uint32_t unpairedHigh_=0;WindowsCharacterObservation unpairedObservation_{};
};
} // namespace RNSkia
