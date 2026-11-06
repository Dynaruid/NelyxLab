// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "schema.hpp"
#include <cmath>
#include <cstring>
#include <limits>
#include <exception>
#include <vector>

namespace nelyx::v2 {
struct Error : std::exception {
  uint32_t status;
  explicit Error(uint32_t value):status(value){}
  const char* what()const noexcept override{return "Engine protocol/layout error";}
};
inline void require(bool test, uint32_t status = wire::statuses::malformed) {
  if (!test) throw Error{status};
}
inline uint64_t next(uint64_t value) {
  require(value != UINT64_MAX, wire::statuses::exhausted);
  return value + 1;
}
struct Reader {
  const uint8_t* data;
  size_t length;
  void range(size_t offset, size_t count) const {
    require(offset <= length && count <= length - offset);
  }
  uint16_t u16(size_t p) const {
    range(p, 2); return uint16_t(data[p]) | uint16_t(data[p + 1]) << 8;
  }
  uint32_t u32(size_t p) const {
    range(p, 4); uint32_t value = 0;
    for (unsigned i = 0; i < 4; ++i) value |= uint32_t(data[p + i]) << (i * 8);
    return value;
  }
  uint64_t u64(size_t p) const {
    range(p, 8); uint64_t value = 0;
    for (unsigned i = 0; i < 8; ++i) value |= uint64_t(data[p + i]) << (i * 8);
    return value;
  }
  int32_t i32(size_t p)const {const auto bits=u32(p);int32_t value;std::memcpy(&value,&bits,4);return value;}
  double finiteF64(size_t p) const {
    const auto bits = u64(p); double value;
    static_assert(sizeof(value) == sizeof(bits) && std::numeric_limits<double>::is_iec559);
    std::memcpy(&value, &bits, 8);
    require(std::isfinite(value), wire::statuses::invalidValue);
    return value;
  }
  double f64(size_t p) const {
    const auto value=finiteF64(p);
    require(std::abs(value)<=1e12,wire::statuses::invalidValue);return value;
  }
  Reader slice(size_t p, size_t n) const { range(p, n); return {data + p, n}; }
};
struct Writer {
  std::vector<uint8_t> bytes;
  explicit Writer(size_t size) : bytes(size, 0) {}
  void u16(size_t p, uint16_t value) {
    for (unsigned i = 0; i < 2; ++i) bytes.at(p + i) = uint8_t(value >> (i * 8));
  }
  void u32(size_t p, uint32_t value) {
    for (unsigned i = 0; i < 4; ++i) bytes.at(p + i) = uint8_t(value >> (i * 8));
  }
  void u64(size_t p, uint64_t value) {
    for (unsigned i = 0; i < 8; ++i) bytes.at(p + i) = uint8_t(value >> (i * 8));
  }
  void f64(size_t p, double value) {
    uint64_t bits; std::memcpy(&bits, &value, 8); u64(p, bits);
  }
};
struct Handle {
  uint32_t slot = 0, generation = 0;
  bool operator==(const Handle& other) const {
    return slot == other.slot && generation == other.generation;
  }
  bool operator!=(const Handle& other) const { return !(*this == other); }
  explicit operator bool() const { return slot != 0; }
  uint64_t key() const { return uint64_t(generation) << 32 | slot; }
};
inline Handle handle(Reader r, size_t p) { return {r.u32(p), r.u32(p + 4)}; }
inline void writeHandle(Writer& w, size_t p, Handle h) {
  w.u32(p, h.slot); w.u32(p + 4, h.generation);
}
struct Axis {
  uint32_t tag = wire::bounds::unbounded;
  double min = 0, max = 0;
};
inline bool validUtf8(Reader r) {
  for (size_t i = 0; i < r.length;) {
    const uint8_t a = r.data[i++];
    if (a < 0x80) continue;
    uint32_t value = 0, count = 0, minimum = 0;
    if (a >= 0xc2 && a <= 0xdf) { value = a & 31; count = 1; minimum = 0x80; }
    else if (a >= 0xe0 && a <= 0xef) { value = a & 15; count = 2; minimum = 0x800; }
    else if (a >= 0xf0 && a <= 0xf4) { value = a & 7; count = 3; minimum = 0x10000; }
    else return false;
    if (count > r.length - i) return false;
    for (uint32_t j = 0; j < count; ++j) {
      const auto b = r.data[i++]; if ((b & 0xc0) != 0x80) return false;
      value = value << 6 | (b & 63);
    }
    if (value < minimum || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return false;
  }
  return true;
}
inline Axis axis(Reader r) {
  require(r.length == 24 && r.u32(4) == 0);
  Axis a{r.u32(0), r.f64(8), r.f64(16)};
  require(a.tag <= wire::bounds::expand && a.min >= 0 && a.max >= 0 &&
    (a.tag == wire::bounds::finite ? a.min <= a.max : a.max == 0) &&
    (a.tag != wire::bounds::expand || a.min == 0), wire::statuses::invalidValue);
  return a;
}
}
