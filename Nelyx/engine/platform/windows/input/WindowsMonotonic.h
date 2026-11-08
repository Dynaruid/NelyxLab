// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <stdexcept>
namespace RNSkia {
inline double windowsMonotonicMilliseconds(){
  LARGE_INTEGER now{},frequency{};
  if(!QueryPerformanceCounter(&now)||!QueryPerformanceFrequency(&frequency))throw std::runtime_error("Windows monotonic clock unavailable");
  return double(now.QuadPart)*1000.0/double(frequency.QuadPart);
}
}
