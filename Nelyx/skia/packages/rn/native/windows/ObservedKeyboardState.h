// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "WindowsCharacterObservation.h"
#include <cstdint>
#include <deque>
#include <functional>
#include <optional>
#include <map>
#include <mutex>
#include <stdexcept>
#include <utility>
#include <vector>

namespace RNSkia {
struct ObservedNativeKey {uint32_t keyCode,scanCode;};
/** App-local native observations, not a query of globally held OS keys.
 * The SDK applies its qualified modern identity maps to these actual fields.
 * Focus transfer/retirement invalidates the previous canvas owner's records. */
class ObservedKeyboardState final {
 public:
  using Owner=uint64_t;
  struct FocusStamp {Owner owner;uint64_t generation;bool operator==(FocusStamp const&)const=default;};
  using ConsumedKeyUp=std::function<void(FocusStamp const&,uint32_t,uint32_t,uint32_t)>;
  Owner newOwner(){std::lock_guard lock(mutex_);if(closed_||nextOwner_>=9007199254740991ULL)throw std::runtime_error("Native keyboard owner unavailable");return ++nextOwner_;}
  void focus(Owner owner,ConsumedKeyUp consumed={}){std::lock_guard lock(mutex_);if(closed_)return;if(owner_!=owner){advanceFocus();keys_.clear();characters_.clear();overflow_=false;owner_=owner;}consumedKeyUp_=std::move(consumed);}
  void blur(Owner owner){std::lock_guard lock(mutex_);if(owner&&owner_==owner){advanceFocus();keys_.clear();characters_.clear();overflow_=false;owner_=0;consumedKeyUp_={};}}
  bool focused(Owner owner)const{std::lock_guard lock(mutex_);return !closed_&&owner&&owner_==owner;}
  bool focused(FocusStamp const& stamp)const{std::lock_guard lock(mutex_);return !closed_&&stamp.owner&&owner_==stamp.owner&&focusGeneration_==stamp.generation;}
  std::optional<FocusStamp> focusStamp()const{std::lock_guard lock(mutex_);return closed_||!owner_?std::nullopt:std::optional<FocusStamp>({owner_,focusGeneration_});}
  /** Only the host's successful TSF KeyUp result calls this ingress. Invoke
   * outside the mutex: the canvas first flushes older pending keys, then reads
   * the matching observed down and emits its actual release in native order. */
  void consumedKeyUp(FocusStamp const& stamp,uint32_t keyCode,uint32_t scanCode,uint32_t repeatCount){
    ConsumedKeyUp callback;
    {std::lock_guard lock(mutex_);if(closed_||!stamp.owner||owner_!=stamp.owner||focusGeneration_!=stamp.generation||!consumedKeyUp_)return;callback=consumedKeyUp_;}
    callback(stamp,keyCode,scanCode,repeatCount);
  }
  std::optional<ObservedNativeKey> pressed(Owner owner,uint32_t keyCode,uint32_t scanCode)const{
    std::lock_guard lock(mutex_);if(closed_||owner_!=owner)return {};
    const uint64_t id=scanCode?scanCode:0x100000000ULL+keyCode;const auto found=keys_.find(id);return found==keys_.end()?std::nullopt:std::optional<ObservedNativeKey>(found->second);
  }
  /** Host admission is restricted to actual queued WM_CHAR from its own TSF
   * document. The routed event consumes this token once on the same canvas. */
  void character(uint32_t unit,uint32_t scan,uint32_t repeat,uint64_t focusEpoch){
    std::lock_guard lock(mutex_);if(closed_||!owner_)return;if(unit>0xffff||!repeat||repeat>0xffff||!focusEpoch||focusEpoch>9007199254740991ULL)throw std::invalid_argument("Invalid native character observation");
    if(!characters_.empty()&&characters_.back().focusEpoch!=focusEpoch)characters_.clear();
    if(characters_.size()>=64)throw std::overflow_error("Native character observation queue overflow");characters_.push_back({unit,scan,repeat,focusEpoch});
  }
  std::optional<WindowsCharacterObservation> takeCharacter(Owner owner,uint32_t point,uint32_t scan){
    std::lock_guard lock(mutex_);if(closed_||owner_!=owner||characters_.empty())return {};
    const auto first=characters_.front();
    if(point<=0xffff){if(first.unit!=point||first.scan!=scan)return {};characters_.pop_front();return WindowsCharacterObservation{first.repeat,first.focusEpoch};}
    if(point>0x10ffff||characters_.size()<2)return {};const auto second=characters_[1];const auto value=point-0x10000;
    if(first.unit!=0xd800+(value>>10)||second.unit!=0xdc00+(value&0x3ff)||(first.scan!=scan&&second.scan!=scan)||second.repeat!=first.repeat||second.focusEpoch!=first.focusEpoch)return {};
    characters_.pop_front();characters_.pop_front();return WindowsCharacterObservation{first.repeat,first.focusEpoch};
  }
  void observe(Owner owner,uint32_t keyCode,uint32_t scanCode,bool up){
    std::lock_guard lock(mutex_);if(closed_||owner_!=owner)return;
    const uint64_t id=scanCode?scanCode:0x100000000ULL+keyCode;
    if(up){keys_.erase(id);return;}
    if(keys_.count(id))return; // Keep the first press's layout identity on repeat.
    if(keys_.size()>=1024){overflow_=true;return;}
    keys_.emplace(id,ObservedNativeKey{keyCode,scanCode});
  }
  std::vector<ObservedNativeKey> snapshot() const{
    std::lock_guard lock(mutex_);if(closed_||overflow_)throw std::runtime_error("Native observed keyboard snapshot unavailable");
    std::vector<ObservedNativeKey> result;result.reserve(keys_.size());for(const auto& [id,key]:keys_)result.push_back(key);return result;
  }
  void close(){std::lock_guard lock(mutex_);closed_=true;keys_.clear();characters_.clear();owner_=0;consumedKeyUp_={};}
 private:
  void advanceFocus(){if(focusGeneration_>=9007199254740991ULL)throw std::overflow_error("Native keyboard focus generation exhausted");++focusGeneration_;}
  mutable std::mutex mutex_;std::map<uint64_t,ObservedNativeKey> keys_;
  struct Character {uint32_t unit,scan,repeat;uint64_t focusEpoch;};std::deque<Character> characters_;
  Owner owner_=0,nextOwner_=0;bool closed_=false,overflow_=false;
  uint64_t focusGeneration_=0;
  ConsumedKeyUp consumedKeyUp_;
};
} // namespace RNSkia
