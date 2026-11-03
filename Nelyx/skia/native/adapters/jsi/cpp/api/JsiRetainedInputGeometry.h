// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "nelyx_skia/input_geometry.h"
#include <chrono>
#include <cstdio>
#include <cstring>
#include <jsi/jsi.h>
#include <memory>
#include <thread>
#if defined(_WIN32)
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <Windows.h>
#endif

namespace RNSkia {
class JsiRetainedInputGeometry final : public facebook::jsi::HostObject,
  public std::enable_shared_from_this<JsiRetainedInputGeometry> {
  using Runtime = facebook::jsi::Runtime;
  using Value = facebook::jsi::Value;
  nelyx::input_geometry::RetainedSession session_;
  const std::thread::id thread_ = std::this_thread::get_id();
  bool executing_ = false;
  nelyx::input_geometry::Owner owner_;
  std::uint64_t prepares_=0, commits_=0, editorQueries_=0, pendingEditors_=0;
  bool reported_=false;
  static void log(const char* message) {
#if defined(_WIN32)
    // GUI hosts have no CRT console. Use the same inherited stderr HANDLE as
    // native input/frame diagnostics so ordinary launchers can verify usage.
    DWORD written=0;
    WriteFile(GetStdHandle(STD_ERROR_HANDLE),message,static_cast<DWORD>(std::strlen(message)),&written,nullptr);
#else
    std::fputs(message,stderr);
#endif
  }
  void close() {
    session_.close();
    if (reported_) return;
    reported_=true;
    char message[512];
    std::snprintf(message,sizeof(message),"NELYX_RETAINED_GEOMETRY_NATIVE {\"schema\":1,\"session\":%.0f,\"ownerGeneration\":%.0f,\"prepares\":%llu,\"commits\":%llu,\"editorQueries\":%llu,\"closed\":true,\"retainedBytes\":%llu}\n",
      owner_.session,owner_.generation,static_cast<unsigned long long>(prepares_),static_cast<unsigned long long>(commits_),
      static_cast<unsigned long long>(editorQueries_),static_cast<unsigned long long>(session_.retainedBytes()));
    log(message);
  }
public:
  static void report(const std::string& json) { log(("NELYX_INPUT_GEOMETRY_STATUS "+json+"\n").c_str()); }
  explicit JsiRetainedInputGeometry(nelyx::input_geometry::Owner owner) : session_(owner), owner_(owner) {}
  Value get(Runtime& runtime, const facebook::jsi::PropNameID& property) override {
    namespace jsi = facebook::jsi;
    const auto name=property.utf8(runtime);
    if (name!="prepare" && name!="commit" && name!="discard" && name!="stats" && name!="close") return Value::undefined();
    auto self=shared_from_this();
    return jsi::Function::createFromHostFunction(runtime,property,1,
      [self,name](Runtime& rt,const Value&,const Value* arguments,size_t count)->Value {
        namespace geometry = nelyx::input_geometry;
        if (self->thread_!=std::this_thread::get_id()) throw jsi::JSError(rt,"Retained geometry requires its owner thread");
        if (name=="close") { self->close(); return Value::undefined(); }
        if (self->executing_) throw jsi::JSError(rt,"Reentrant retained geometry operation");
        self->executing_=true;
        struct Operation { bool& active; ~Operation() { active=false; } } operation{self->executing_};
        if (name=="commit" || name=="discard") {
          if (count!=1 || !arguments[0].isNumber()) throw jsi::JSError(rt,"Retained geometry requires a revision");
          if (name=="commit") {
            self->session_.commit(arguments[0].getNumber());
            ++self->commits_; self->editorQueries_+=self->pendingEditors_;
          } else self->session_.discard(arguments[0].getNumber());
          self->pendingEditors_=0;
          return Value::undefined();
        }
        std::vector<double> output;
        double revision=0;
        if (name=="stats") output=self->session_.stats();
        else {
          if (count!=1 || !arguments[0].isObject()) throw jsi::JSError(rt,"Retained geometry requires one ArrayBuffer");
          auto input=arguments[0].getObject(rt).getArrayBuffer(rt);
          const auto bytes=input.size(rt);
          if (bytes<geometry::retained::headerWords*8 || bytes>geometry::maxBytes/2 || bytes%8)
            throw jsi::JSError(rt,"Retained geometry byte budget/alignment");
          const auto began=std::chrono::steady_clock::now();
          std::vector<double> owned(bytes/8);
          std::memcpy(owned.data(),input.data(rt),bytes); revision=owned[4];
          const auto copied=std::chrono::steady_clock::now();
          output=self->session_.prepare(owned);
          ++self->prepares_; self->pendingEditors_=static_cast<std::uint64_t>(owned[11]);
          if (owned[14]==1) output[14]+=std::chrono::duration<double,std::milli>(copied-began).count();
        }
        try {
          auto array=rt.global().getPropertyAsFunction(rt,"Float64Array")
            .callAsConstructor(rt,double(output.size())).getObject(rt);
          auto result=array.getPropertyAsObject(rt,"buffer").getArrayBuffer(rt);
          if (result.size(rt)!=output.size()*8 || (name=="prepare" && !self->session_.current(revision)))
            throw jsi::JSError(rt,"Retained geometry allocation changed its owner/revision/buffer");
          std::memcpy(result.data(rt),output.data(),output.size()*8);
          return result;
        } catch (...) {
          if (name=="prepare" && self->session_.current(revision)) self->session_.discard(revision);
          throw;
        }
      });
  }
};
}
