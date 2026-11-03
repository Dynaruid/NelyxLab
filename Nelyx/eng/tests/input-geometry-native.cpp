// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx_skia/input_geometry.h"
#include <iostream>
#include <string>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif
int main(int argc, char** argv) {
#ifdef _WIN32
  _setmode(_fileno(stdin),_O_BINARY); _setmode(_fileno(stdout),_O_BINARY);
#endif
  const nelyx::input_geometry::Owner owner{1,argc==2 ? std::stod(argv[1]) : 7};
  nelyx::input_geometry::Session session(owner);
  nelyx::input_geometry::RetainedSession retained(owner);
  std::uint32_t operation, words;
  while (std::cin.read(reinterpret_cast<char*>(&operation),4) && std::cin.read(reinterpret_cast<char*>(&words),4)) {
    if (words>nelyx::input_geometry::maxBytes/8+1) return 2;
    std::vector<double> input(words);
    if (!std::cin.read(reinterpret_cast<char*>(input.data()),words*8)) return 3;
    std::vector<double> output;
    try {
      if (operation==0) output=nelyx::input_geometry::evaluate(input,owner);
      else if (operation==1) output=session.evaluate(input);
      else if (operation==2) { session.close(); output={1}; }
      else if (operation==3) output=retained.prepare(input);
      else if (operation==4 && words==1) { retained.commit(input[0]); output={1}; }
      else if (operation==5 && words==1) { retained.discard(input[0]); output={1}; }
      else if (operation==6 && words==0) output=retained.stats();
      else if (operation==7 && words==0) { retained.close(); output={1}; }
      else return 4;
    } catch (const std::exception&) { /* zero words is an explicit rejection */ }
    words=static_cast<std::uint32_t>(output.size());
    std::cout.write(reinterpret_cast<const char*>(&words),4);
    std::cout.write(reinterpret_cast<const char*>(output.data()),words*8);
  }
}
