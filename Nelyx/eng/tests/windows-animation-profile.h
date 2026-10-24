// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <cstdio>
namespace NelyxAnimationProfile {
inline void thread()noexcept{if(IsDebuggerPresent()){char message[96]{};std::snprintf(message,sizeof(message),"ANIMATION_PROFILE_THREAD %lu\n",GetCurrentThreadId());OutputDebugStringA(message);}}
inline void begin(const char* phase)noexcept{if(IsDebuggerPresent()){char message[160]{};std::snprintf(message,sizeof(message),"ANIMATION_PROFILE_BEGIN %s\n",phase);OutputDebugStringA(message);}}
inline void end()noexcept{if(IsDebuggerPresent())OutputDebugStringA("ANIMATION_PROFILE_END\n");}
}
