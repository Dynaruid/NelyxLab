// SPDX-License-Identifier: BSD-3-Clause
#include "../platform/windows/clipboard.hpp"
using namespace nelyx::v2::windows;
// Deterministic failure injection; this executable never opens the OS clipboard.
struct FailureApi {
  static inline int closed=0,freed=0,emptied=0;
  static bool open(HWND){return true;}
  static void close(){++closed;}
  static HGLOBAL allocate(size_t){return reinterpret_cast<HGLOBAL>(1);}
  static void* lock(HGLOBAL){return nullptr;}
  static void unlock(HGLOBAL){}
  static void free(HGLOBAL){++freed;}
  static bool empty(){++emptied;return false;}
  static bool set(HGLOBAL){return false;}
  static HGLOBAL get(){return nullptr;}
  static size_t size(HGLOBAL){return 0;}
};
struct BusyApi:FailureApi { static bool open(HWND){return false;} };
struct AllocationFailure:FailureApi { static HGLOBAL allocate(size_t){return nullptr;} };
int main() {
  const auto window=reinterpret_cast<HWND>(1);
  if(copyClipboard<BusyApi>(window,u"keep")||pasteClipboard<BusyApi>(window,65536)||FailureApi::closed)return 1;
  if(copyClipboard<AllocationFailure>(window,u"keep")||FailureApi::closed!=1||FailureApi::freed)return 2;
  if(copyClipboard<FailureApi>(window,u"keep")||FailureApi::closed!=2||FailureApi::freed!=1)return 3;
  if(pasteClipboard<FailureApi>(window,65536)||FailureApi::closed!=3||FailureApi::emptied)return 4;
  return 0;
}
