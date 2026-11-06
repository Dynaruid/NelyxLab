// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <stdexcept>
namespace nelyx::v2::windows {
// Poll the system-wide level on the existing UI control timer. No additional
// thread or continuously-signaled wait callback is retained during shutdown.
class MemoryPressureMonitor {
  HANDLE notification=CreateMemoryResourceNotification(LowMemoryResourceNotification);
  double nextSample=0;
  bool low=false;
 public:
  MemoryPressureMonitor(){if(!notification)throw std::runtime_error("Windows memory resource notification unavailable");}
  MemoryPressureMonitor(const MemoryPressureMonitor&)=delete;
  MemoryPressureMonitor& operator=(const MemoryPressureMonitor&)=delete;
  bool sample(double at) {
    if(at<nextSample)return low;
    BOOL value=FALSE;
    if(!QueryMemoryResourceNotification(notification,&value))throw std::runtime_error("Windows memory resource query failed");
    nextSample=at+1;low=value!=FALSE;return low;
  }
  ~MemoryPressureMonitor(){if(notification)CloseHandle(notification);}
};
}
