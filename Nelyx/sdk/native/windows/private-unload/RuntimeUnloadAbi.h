// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <Unknwn.h>
// COM-only boundary between the app and framework DLL. The returned pointer
// owns one IAsyncAction reference; no STL, JSI value or callback crosses it.
struct __declspec(uuid("d2472b31-61ab-4d29-8760-b479145bf48e")) __declspec(novtable) INelyxRnwUnloadGate : IUnknown {
  virtual HRESULT __stdcall Begin(UINT32 reason, UINT64 generation, IUnknown **action) noexcept = 0;
};
