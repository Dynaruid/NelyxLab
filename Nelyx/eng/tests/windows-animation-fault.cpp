// SPDX-License-Identifier: BSD-3-Clause
#include "windows-animation-fault.h"
#include "windows-animation-profile.h"
#include <cstdlib>
__declspec(noinline) void faultProbe(volatile int* target){*target=7;}
__declspec(noinline) void faultCaller(volatile int* target){faultProbe(target);volatile int after=1;(void)after;}
__declspec(noinline) void profileWork(){volatile unsigned value=1;const auto end=GetTickCount64()+250;while(GetTickCount64()<end)for(unsigned i=0;i<10000;i++)value=value*1664525+1013904223;}
int main(int argc,char** argv){NelyxAnimationFault::install();if(argc==2&&(std::strcmp(argv[1],"profile")==0||std::strstr(argv[1],"Bundle"))){std::puts("FAULT_PROBE_STDOUT");std::fflush(stdout);std::fputs("FAULT_PROBE_STDERR\n",stderr);NelyxAnimationProfile::thread();NelyxAnimationProfile::begin("probe");profileWork();NelyxAnimationProfile::end();}faultCaller(reinterpret_cast<volatile int*>(argc==2?std::strtoull(argv[1],nullptr,0):0));return 0;}
