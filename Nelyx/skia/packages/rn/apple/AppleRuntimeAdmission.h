// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstdint>
#include <limits>
#include <mutex>

namespace RNSkia {
// One reservation covers construction, publication and checked retirement.
// A stale owner can neither release nor poison a replacement runtime.
class AppleRuntimeAdmission final {
public:
  using Owner=uint64_t;
  Owner reserve() {
    std::lock_guard lock(_mutex);
    if(_owner || _poisoned || _next==std::numeric_limits<Owner>::max())return 0;
    _owner=++_next;_active=false;return _owner;
  }
  bool publish(Owner owner) {
    std::lock_guard lock(_mutex);
    if(!owner || owner!=_owner || _active || _poisoned)return false;
    _active=true;return true;
  }
  bool releaseChecked(Owner owner) {
    std::lock_guard lock(_mutex);
    if(!owner || owner!=_owner || _poisoned)return false;
    _owner=0;_active=false;return true;
  }
  bool poison(Owner owner) {
    std::lock_guard lock(_mutex);
    if(!owner || owner!=_owner)return false;
    _poisoned=true;return true;
  }
  bool blocked() const {std::lock_guard lock(_mutex);return _owner || _poisoned;}
  bool poisoned() const {std::lock_guard lock(_mutex);return _poisoned;}
private:
  mutable std::mutex _mutex;
  Owner _owner=0,_next=0;
  bool _active=false,_poisoned=false;
};
} // namespace RNSkia
