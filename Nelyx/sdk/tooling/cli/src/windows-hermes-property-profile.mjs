// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';

export function propertyProfileEnabled() {
  const enabled = process.env.NELYX_HERMES_PROPERTY_PROFILE;
  if (enabled !== undefined && enabled !== '0' && enabled !== '1')
    throw Error('Hermes property profile requires 0 or 1');
  if (enabled !== '1') return false;
  if (
    process.env.NELYX_NATIVE_CPU_PROFILE !== '1' ||
    process.env.NELYX_JANK_REPRESENTATION_PROFILE !== '1' ||
    process.env.NELYX_HERMES_DESCRIPTOR_PROFILE === '1'
  )
    throw Error('Hermes property instrumentation requires its own representation CPU diagnostic');
  return true;
}

// No JS values are stored here. Getter scopes form a native-stack list. A
// nested interpreter marks its loop interval, including all JS/native callees
// and GC, so that interval is excluded from the getter gateway measurement.
// The remaining wall time is still an upper bound, including instrumentation,
// scheduling, register-stack allocation and GC outside the loop.
const support = `
#include <chrono>
namespace nelyx_property_profile {
static double now() {
  return std::chrono::duration<double, std::milli>(
    std::chrono::steady_clock::now().time_since_epoch()).count();
}
struct Getter;
struct State {
  bool enabled = false;
  Getter *current = nullptr;
  double lookups = 0, eligible = 0, resolution = 0, gateway = 0;
  double getters = 0, interpreted = 0, allResolution = 0;
};
static thread_local State state;
struct Lookup {
  bool active = state.enabled;
  double start = 0;
  Lookup() { if (active) { ++state.lookups; start = now(); } }
  double finish() { return active ? now() - start : 0; }
};
struct Getter {
  Getter *previous = nullptr;
  bool active = state.enabled, waiting = true, entered = false, ended = false;
  double start = 0, bodyStart = 0, body = 0;
  Getter() {
    if (!active) return;
    previous = state.current;
    state.current = this;
    ++state.getters;
    start = now();
  }
  ~Getter() {
    if (!active) return;
    if (entered && ended) {
      state.gateway += now() - start - body;
      ++state.interpreted;
    }
    state.current = previous;
  }
};
}
extern "C" void *nelyx_property_body_begin() {
  auto *current = nelyx_property_profile::state.current;
  if (!current || !current->waiting) return nullptr;
  current->waiting = false;
  return current;
}
extern "C" void nelyx_property_body_enter(void *value) {
  if (!value) return;
  auto *scope = static_cast<nelyx_property_profile::Getter *>(value);
  if (!scope->entered) {
    scope->entered = true;
    scope->bodyStart = nelyx_property_profile::now();
  }
}
extern "C" void nelyx_property_body_end(void *value) {
  if (!value) return;
  auto *scope = static_cast<nelyx_property_profile::Getter *>(value);
  if (scope->entered) {
    scope->body = nelyx_property_profile::now() - scope->bodyStart;
    scope->ended = true;
  }
}
extern "C" __declspec(dllexport) void nelyx_property_profile_v1(unsigned command, double* result) {
  using namespace nelyx_property_profile;
  for (unsigned i = 0; i < 9; ++i) result[i] = 0;
  if (state.current || command > 2 || (command == 0 && !state.enabled) ||
      (command != 0 && state.enabled)) { result[0] = -1; return; }
  if (command == 1) { state = {}; state.enabled = true; return; }
  if (command == 2) {
    for (unsigned i = 0; i < 128; ++i) {
      const auto start = now(), elapsed = now() - start;
      result[7] += elapsed / 128.;
      if (elapsed > result[8]) result[8] = elapsed;
    }
    return;
  }
  result[0] = state.lookups; result[1] = state.eligible;
  result[2] = state.resolution; result[3] = state.gateway;
  result[4] = state.getters; result[5] = state.interpreted;
  result[6] = state.allResolution;
  state = {};
}
`;
const observer = `
extern "C" void *nelyx_property_body_begin();
extern "C" void nelyx_property_body_enter(void *);
extern "C" void nelyx_property_body_end(void *);
struct NelyxPropertyBody {
  void *scope = nelyx_property_body_begin();
  void enter() { nelyx_property_body_enter(scope); }
  ~NelyxPropertyBody() { nelyx_property_body_end(scope); }
};
`;
const begin = '// NELYX_PROPERTY_PROFILE_BEGIN\n',
  end = '// NELYX_PROPERTY_PROFILE_END\n';

export function patchPropertyProfile(source, enabled) {
  for (const [relative, additions] of [
    [
      'lib/VM/JSObject.cpp',
      [
        ['#include "llvh/ADT/ScopeExit.h"\n', support],
        [
          '  JSObject *propObj = getNamedDescriptorUnsafe(selfHandle, runtime, name, desc);\n',
          `  const auto nelyxResolution = nelyxLookup.finish();
  if (nelyxLookup.active) {
    nelyx_property_profile::state.allResolution += nelyxResolution;
    if (propObj && desc.flags.accessor && cacheEntry &&
        desc.slot <= ReadPropertyCacheEntry::kMaxSlot &&
        !propObj->getClass(runtime)->isDictionaryNoCache() &&
        (selfHandle.get() == propObj ||
         (selfHandle->getParent(runtime) == propObj && !selfHandle->getClass(runtime)->isDictionary()))) {
      ++nelyx_property_profile::state.eligible;
      nelyx_property_profile::state.resolution += nelyxResolution;
    }
  }
`,
          'getNamedWithReceiver_RJS',
        ],
        [
          '  // Locate the descriptor. propObj contains the object which may be anywhere\n',
          '  nelyx_property_profile::Lookup nelyxLookup;\n',
          'getNamedWithReceiver_RJS',
          true,
        ],
        [
          '    // Execute the accessor on this object.\n',
          '    nelyx_property_profile::Getter nelyxGetter;\n',
          'getNamedWithReceiver_RJS',
        ],
      ],
    ],
    [
      'lib/VM/Interpreter.cpp',
      [
        ['#include "Interpreter-internal.h"\n', observer],
        ['  INIT_OPCODE_PROFILER;\n', '  NelyxPropertyBody nelyxPropertyBody;\n'],
        ['tailCall:\n', '  nelyxPropertyBody.enter();\n'],
      ],
    ],
  ]) {
    const file = path.join(source, relative),
      original = fs.readFileSync(file, 'utf8');
    let text = original.replaceAll(
      /\/\/ NELYX_PROPERTY_PROFILE_BEGIN\n[\s\S]*?\/\/ NELYX_PROPERTY_PROFILE_END\n/g,
      '',
    );
    if (enabled)
      for (const [needle, added, region, before] of additions) {
        const start = region ? text.indexOf(`JSObject::${region}(`) : 0;
        if (start < 0) throw Error('Pinned Hermes property region differs');
        const at = text.indexOf(needle, start);
        // A scoped anchor is confined to its function, rather than matching
        // the same descriptor lookup in delete/set operations.
        const boundary = region ? text.indexOf('\n}\n', start) : text.length;
        if (at < 0 || at >= boundary || (!region && text.split(needle).length !== 2))
          throw Error('Pinned Hermes property profile anchor differs: ' + needle.trim());
        const insertion = before ? at : at + needle.length;
        text = text.slice(0, insertion) + begin + added + end + text.slice(insertion);
      }
    if (text !== original) fs.writeFileSync(file, text);
  }
}
