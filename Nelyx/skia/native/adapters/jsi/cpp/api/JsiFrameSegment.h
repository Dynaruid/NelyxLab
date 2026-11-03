// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "JsiDisplayList.h"
#include <mutex>
namespace RNSkia {
struct FrameSegmentBudget {
  std::mutex mutex;
  uint64_t sealed=0,admitted=0,retired=0,live=0,bytes=0,peak=0,peakBytes=0;
  bool closed=false,reported=false;
};
struct NativeFrameSegment {
  std::shared_ptr<FrameSegmentBudget> budget;
  size_t charge;
  bool admitted=false;
  std::shared_ptr<DisplayListProgram> program;
  NativeFrameSegment(std::shared_ptr<FrameSegmentBudget> state,std::shared_ptr<DisplayListProgram> value)
    :budget(std::move(state)),charge(value->bytes+value->commands.size()*256+value->handles*64),program(std::move(value)){
    std::lock_guard lock(budget->mutex);
    if(budget->closed||budget->live>=3||charge>2*1024*1024||budget->bytes>6*1024*1024-charge)throw std::runtime_error("Native frame segment metadata admission budget");
    ++budget->sealed;++budget->live;budget->bytes+=charge;budget->peak=std::max(budget->peak,budget->live);budget->peakBytes=std::max(budget->peakBytes,budget->bytes);
  }
  ~NativeFrameSegment(){program.reset();std::lock_guard lock(budget->mutex);--budget->live;budget->bytes-=charge;++budget->retired;}
};
class JsiFrameSegment final : public JsiSkWrappingSharedPtrNativeObject<JsiFrameSegment,NativeFrameSegment> {
public:
  static constexpr const char* CLASS_NAME="FrameSegment";
  JsiFrameSegment(std::shared_ptr<RNSkPlatformContext> owner,std::shared_ptr<NativeFrameSegment> value)
    :JsiSkWrappingSharedPtrNativeObject<JsiFrameSegment,NativeFrameSegment>(std::move(owner),std::move(value)){}
  static void definePrototype(jsi::Runtime& runtime,jsi::Object& prototype){installCommon(runtime,prototype);}
  size_t getMemoryPressure() override {return isDisposed()?kMinMemoryPressure:getObject()->charge;}
};
}
