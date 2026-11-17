// SPDX-License-Identifier: BSD-3-Clause
import { patchJscMicrotasks } from './windows-jsc.mjs';

/** Compile the pinned RN adapter with the direct host's JSI. Keep the VM's
 * API lock across calls so jobs run at explicit host checkpoints. */
export function patchNativeJscAdapter(source) {
  source = patchJscMicrotasks(source);
  const once = (before, after) => {
    if (source.split(before).length !== 2)
      throw Error('Pinned direct JSC adapter anchor changed: ' + before.slice(0, 55));
    source = source.replace(before, after);
  };
  once(
    '#include "JSCRuntime.h"',
    `#include <jsc/JSCRuntime.h>
#include <windows.h>
#include <JavaScriptCore/JavaScript.h>
extern "C" void JSLock(JSContextRef);
extern "C" void JSUnlock(JSContextRef);
extern "C" void JSGlobalContextSetUnhandledRejectionCallback(JSGlobalContextRef, JSObjectRef, JSValueRef*);
extern "C" void JSGlobalContextSetEvalEnabled(JSGlobalContextRef, bool, JSStringRef);`,
  );
  once(
    '  JSGlobalContextRef getContext() {',
    `  void nelyxTrackRejections(const jsi::Function& handler) {
    JSValueRef exception = nullptr;
    JSGlobalContextSetUnhandledRejectionCallback(ctx_, objectRef(handler), &exception);
    if (exception) throw jsi::JSError(*this, createValue(exception));
  }
  JSGlobalContextRef getContext() {`,
  );
  once(
    '  std::unique_ptr<jsi::Function> enqueueMicrotask_;',
    '  std::unique_ptr<jsi::Function> enqueueMicrotask_;\n  bool nelyxLockHeld_ = false;',
  );
  once(
    'evaluateJavaScript(std::make_shared<jsi::StringBuffer>("void 0"), "nelyx:jsc-checkpoint");',
    `if (!nelyxLockHeld_) throw std::runtime_error("Nested JSC checkpoint");
  nelyxLockHeld_ = false;
  JSUnlock(ctx_);
  JSLock(ctx_);
  nelyxLockHeld_ = true;`,
  );
  once(
    '#ifndef NDEBUG\n#ifdef _JSC_HAS_INSPECTABLE',
    `JSLock(ctx_);
  nelyxLockHeld_ = true;
#ifndef NDEBUG
#ifdef _JSC_HAS_INSPECTABLE`,
  );
  once(
    '  ctxInvalid_ = true;',
    `  if (nelyxLockHeld_) { nelyxLockHeld_ = false; JSUnlock(ctx_); }
  ctxInvalid_ = true;`,
  );
  return (
    source +
    `
namespace Nelyx::NativeJsc {
void trackRejections(facebook::jsi::Runtime& runtime, const facebook::jsi::Function& handler) {
  static_cast<facebook::jsc::JSCRuntime&>(runtime).nelyxTrackRejections(handler);
}
void disableEval(facebook::jsi::Runtime& runtime) {
  auto context = static_cast<facebook::jsc::JSCRuntime&>(runtime).getContext();
  auto message = JSStringCreateWithUTF8CString("Dynamic eval is disabled in the native host");
  JSGlobalContextSetEvalEnabled(context, false, message);
  JSStringRelease(message);
}
}
`
  );
}
