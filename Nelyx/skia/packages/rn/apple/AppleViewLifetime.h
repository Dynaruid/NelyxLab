// SPDX-License-Identifier: BSD-3-Clause
#pragma once

namespace RNSkia {
// Main-owner policy; no native handles. Recycle during the runtime GPU fence
// is deferred until confirmation, and failure remains sticky for this view.
class AppleViewLifetime final {
public:
  bool closing() const {return _stage!=Stage::active;}
  bool failed() const {return _stage==Stage::failed;}
  bool drainConfirmed() const {return _stage==Stage::drained;}
  bool recycleRequested() const {return _recycle;}
  bool beginShutdown() {
    if(_stage==Stage::active)_stage=Stage::draining;
    return !failed();
  }
  bool confirmDrain() {
    if(_stage==Stage::draining)_stage=Stage::drained;
    return drainConfirmed();
  }
  void requestRecycle() {_recycle=true;}
  void fail() {_stage=Stage::failed;}
  bool resetAfterRecycle() {
    if(_stage==Stage::draining || failed())return false;
    _stage=Stage::active;_recycle=false;return true;
  }
private:
  enum class Stage {active,draining,drained,failed};
  Stage _stage=Stage::active;
  bool _recycle=false;
};
} // namespace RNSkia
