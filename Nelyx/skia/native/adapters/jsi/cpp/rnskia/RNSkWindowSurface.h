// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>
#include "RNSkSurface.h"

namespace RNSkia {
class RNSkGraphiteRecording;
// Native view attachment/layout contract. Implementations own their backend
// window/import strategy; generic recording and JSI code never sees Dawn.
class RNSkWindowSurface : public RNSkSurface {
public:
  using Releaser = std::function<void(void*)>;
  virtual void attach(void*, int, int, bool, bool, Releaser) = 0;
  virtual void resize(int, int) = 0;
  virtual void detach() = 0;
  virtual bool isAttached() const = 0;
  virtual void setLayoutSize(int, int) = 0;
  virtual bool getLayoutSize(int*, int*) = 0;
  virtual void setRequestRedraw(std::function<void()>) = 0;
  virtual void setCanPresent(std::function<bool()>) = 0;
  using FrameCompletion=std::function<void(std::optional<size_t>,std::string)>;
  virtual bool hasAsyncPresentation() const{return false;}
  virtual bool presentAsync(const std::vector<std::shared_ptr<RNSkGraphiteRecording>>&,FrameCompletion){return false;}
};
}
