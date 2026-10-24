// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "AppleStreamState.h"
#include <cerrno>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace RNSkia {
inline bool readAppleStreamFile(const char *path, AppleStreamState &state,
                               uint64_t id, AppleStreamBuffer &buffer) {
  if (!path || !state.valid(id)) return false;
  const int descriptor = open(path, O_RDONLY | O_NONBLOCK | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) return false;
  struct FileOwner { int descriptor; ~FileOwner() { ::close(descriptor); } } owner{descriptor};
  struct stat info;
  if (fstat(descriptor, &info) != 0 || !S_ISREG(info.st_mode) || info.st_size < 0 ||
      !state.expectedLength(id, info.st_size)) return false;
  unsigned char bytes[AppleStreamState::Chunk];
  while (state.valid(id)) {
    const ssize_t count = read(descriptor, bytes, sizeof(bytes));
    if (!count) return true;
    if (count < 0) { if (errno == EINTR) continue; return false; }
    if (!buffer.append(bytes, static_cast<size_t>(count))) return false;
  }
  return false;
}
} // namespace RNSkia
