// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <functional>
#include <memory>
#include <utility>
#include <type_traits>
#include <jsi/jsi.h>

namespace nelyx::host {
using RuntimeTask=std::function<void(facebook::jsi::Runtime&)>;
// Platform-neutral scheduling port. JSI captures are created, executed and
// destroyed on the runtime owner. Workers may only post native completion IDs.
class RuntimeScheduler {
public:
  virtual ~RuntimeScheduler()=default;
  virtual void invokeAsync(RuntimeTask&&)=0;
  virtual void invokeSync(RuntimeTask&&)=0;
  void invokeAsync(std::function<void()>&& task){invokeAsync(RuntimeTask([task=std::move(task)](auto&){task();}));}
  template<class T> static std::shared_ptr<RuntimeScheduler> adapt(std::shared_ptr<T> port){
    if constexpr(std::is_base_of_v<RuntimeScheduler,T>)return port;
    else {
      class Adapter final:public RuntimeScheduler {
        std::shared_ptr<T> port;
      public:
        explicit Adapter(std::shared_ptr<T> value):port(std::move(value)){}
        void invokeAsync(RuntimeTask&& task) override {port->invokeAsync(std::move(task));}
        void invokeSync(RuntimeTask&& task) override {port->invokeSync(std::move(task));}
      };
      return std::make_shared<Adapter>(std::move(port));
    }
  }
};
}
