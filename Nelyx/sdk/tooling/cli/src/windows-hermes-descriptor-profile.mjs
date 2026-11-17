// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';

export function descriptorProfileEnabled() {
  const enabled = process.env.NELYX_HERMES_DESCRIPTOR_PROFILE;
  if (enabled !== undefined && enabled !== '0' && enabled !== '1')
    throw Error('Hermes descriptor profile requires 0 or 1');
  if (enabled !== '1') return false;
  if (
    process.env.NELYX_NATIVE_CPU_PROFILE !== '1' ||
    process.env.NELYX_JANK_REPRESENTATION_PROFILE !== '1'
  )
    throw Error(
      'Hermes descriptor instrumentation requires the explicit representation CPU diagnostic',
    );
  return true;
}

// This is instrumentation, not a descriptor cache. No object inspection,
// handles, callbacks or retained JS values are added. A nested builtin is timed
// only by its outermost call, so callback/GC time is a conservative upper bound.
const support = `
#include <chrono>
namespace nelyx_descriptor_profile {
static double now() {
  return std::chrono::duration<double, std::milli>(
    std::chrono::steady_clock::now().time_since_epoch()).count();
}
struct State {
  bool enabled = false;
  unsigned depth = 0;
  double calls = 0, failed = 0, conversion = 0, application = 0;
};
static thread_local State state;
struct Scope {
  bool active = state.enabled, outer = false, applied = false, succeeded = false;
  double start = 0, applying = 0;
  Scope() {
    if (!active) return;
    ++state.calls;
    outer = state.depth++ == 0;
    if (outer) start = now();
  }
  void apply() {
    if (!outer) return;
    applying = now();
    state.conversion += applying - start;
    applied = true;
  }
  ~Scope() {
    if (!active) return;
    if (outer) {
      const auto end = now();
      if (applied) state.application += end - applying;
      else state.conversion += end - start;
    }
    state.failed += !succeeded;
    --state.depth;
  }
};
}
extern "C" __declspec(dllexport) void nelyx_descriptor_profile_v1(unsigned command, double* result) {
  using namespace nelyx_descriptor_profile;
  for (unsigned i = 0; i < 6; ++i) result[i] = 0;
  if (state.depth || (command == 0 && !state.enabled) ||
      (command != 0 && state.enabled) || command > 2) {
    result[0] = -1; return;
  }
  if (command == 1) { state = {}; state.enabled = true; return; }
  if (command == 2) {
    for (unsigned i = 0; i < 128; ++i) {
      const auto began = now(), elapsed = now() - began;
      result[4] += elapsed / 128.;
      if (elapsed > result[5]) result[5] = elapsed;
    }
    return;
  }
  state.enabled = false;
  result[0] = state.calls; result[1] = state.failed;
  result[2] = state.conversion; result[3] = state.application;
}
`;
const begin = '// NELYX_DESCRIPTOR_PROFILE_BEGIN\n',
  end = '// NELYX_DESCRIPTOR_PROFILE_END\n';
export function patchDescriptorProfile(source, enabled) {
  const file = path.join(source, 'lib/VM/JSLib/Object.cpp'),
    original = fs.readFileSync(file, 'utf8');
  let text = original.replaceAll(
    /\/\/ NELYX_DESCRIPTOR_PROFILE_BEGIN\n[\s\S]*?\/\/ NELYX_DESCRIPTOR_PROFILE_END\n/g,
    '',
  );
  if (enabled) {
    for (const [needle, added] of [
      ['#include "hermes/VM/StringBuilder.h"\n', support],
      [
        'objectDefinePropertiesInternal(Runtime &runtime, Handle<> obj, Handle<> props) {\n',
        '  nelyx_descriptor_profile::Scope nelyxDescriptorScope;\n',
      ],
      [
        '  // For each descriptor in the list, add it to the object.\n',
        '  nelyxDescriptorScope.apply();\n',
      ],
    ]) {
      if (text.split(needle).length !== 2)
        throw Error('Pinned Hermes descriptor profile anchor differs');
      text = text.replace(needle, needle + begin + added + end);
    }
    const success =
      '  return lv.objHandle.getHermesValue();\n}\n\nCallResult<HermesValue> objectCreate';
    if (text.split(success).length !== 2)
      throw Error('Pinned Hermes descriptor result anchor differs');
    text = text.replace(
      success,
      begin + '  nelyxDescriptorScope.succeeded = true;\n' + end + success,
    );
  }
  if (text !== original) fs.writeFileSync(file, text);
}
