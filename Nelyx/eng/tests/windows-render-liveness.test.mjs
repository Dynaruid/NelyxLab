// SPDX-License-Identifier: BSD-3-Clause
// Fixed-scope redraws plus real OS wheel input and owned desktop pixel receipts.
Object.assign(process.env,{
  NELYX_ANIMATION_MODE:'render-liveness',NELYX_ANIMATION_ENGINE:'hermes',NELYX_ANIMATION_HERMES_MODE:'bytecode',
  NELYX_ANIMATION_SOURCE:'0',NELYX_ANIMATION_VIEWPORT:'fixed',NELYX_ANIMATION_WHEEL_INPUT:'1',NELYX_ANIMATION_RESIZE:'0',
  NELYX_ANIMATION_TRACE:'0',NELYX_ANIMATION_DIAGNOSTIC:'0',NELYX_ANIMATION_NATIVE_TRACE:'0',NELYX_ANIMATION_NATIVE_CORE_TRACE:'0',
});
await import('./windows-animation.test.mjs');
