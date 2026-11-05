// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstdint>
namespace nelyx::v2 {
struct ControlStyle {
  uint32_t kind=0,disabled=0,foreground=0xff286ee9,track=0xffd0d7e2;
  uint64_t revision=0;
  double minimum=0,maximum=1,step=0,value=0,second=1;
  uint32_t appearance=0;
};
}
