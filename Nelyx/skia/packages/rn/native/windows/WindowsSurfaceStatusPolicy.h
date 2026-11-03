// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstdint>
#include <optional>
#include <utility>

namespace RNSkia {
// UI-owned delivery metadata only. Presentation, native observers, input and
// resize coordination run independently of the Fabric notification policy.
class WindowsSurfaceStatusPolicy final {
public:
  bool lifecycle() const noexcept {return lifecycleMode;}
  bool mode(bool lifecycle) noexcept {
    if(lifecycleMode==lifecycle)return false;
    lifecycleMode=lifecycle;resetConsumer();return true;
  }
  void resetConsumer() noexcept {delivered.reset();}
  bool frame(uint64_t view,uint64_t surface,bool ready) noexcept {
    if(!ready)return !lifecycleMode;
    const auto epoch=std::make_pair(view,surface);
    if(lifecycleMode&&delivered==epoch)return false;
    delivered=epoch;return true;
  }
private:
  bool lifecycleMode=false;
  std::optional<std::pair<uint64_t,uint64_t>> delivered;
};
}
