// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <span>
#include <cstddef>
#include <vector>
namespace nelyx::flex_layout {
inline constexpr double magic=0x4e4c4658;
inline constexpr size_t headerWords=16,maxChildren=2048;
// Header: magic/version/phase/count/horizontal/mainSize/cross/main/flipMain/
// flipCross/gap/minW/maxW/minH/maxH/totalFlex. Rows: width/height/group
// (0 unmeasured, 1 first pass, 2 flex pass). Preserve TS addition order.
// The two phases bracket normal TS child layout, never call back into JS.
std::vector<double> run(std::span<const double> input);
}
