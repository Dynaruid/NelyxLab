// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx_skia/scene_composition.h"
#include "nelyx_skia/semantics_geometry.h"
#include <cstring>
#include <fcntl.h>
#include <functional>
#include <io.h>
#include <iostream>
#include <stdexcept>
#include <string>
using namespace nelyx;
static void require(bool v) {
  if (!v)
    throw std::runtime_error("Scene transaction contract failed");
}
static void rejects(const std::function<void()> &f) {
  bool rejected = false;
  try {
    f();
  } catch (const std::exception &) {
    rejected = true;
  }
  require(rejected);
}
static std::vector<double> packet(double rev, std::vector<double> body,
                                  size_t updates, size_t removes = 0,
                                  double root = 1) {
  std::vector<double> p{scene_composition::magic,
                        1,
                        1,
                        7,
                        rev,
                        1,
                        1,
                        -1,
                        -1,
                        1,
                        double(updates),
                        double(removes),
                        root,
                        double(16 + body.size()),
                        0,
                        0};
  p.insert(p.end(), body.begin(), body.end());
  return p;
}
int main(int argc, char **argv) {
  try {
    if (argc > 1 && std::string(argv[1]) == "scene") {
      _setmode(_fileno(stdin), _O_BINARY);
      _setmode(_fileno(stdout), _O_BINARY);
      std::vector<char> bytes{std::istreambuf_iterator<char>(std::cin),
                              std::istreambuf_iterator<char>()};
      if (bytes.size() % 8)
        throw std::runtime_error("alignment");
      std::vector<double> words(bytes.size() / 8);
      std::memcpy(words.data(), bytes.data(), bytes.size());
      scene_composition::Session session(1, argc > 2 ? std::stod(argv[2]) : 7);
      std::vector<double> result;
      size_t at = 0;
      while (at < words.size()) {
        auto op = words.at(at++);
        auto length = size_t(words.at(at++));
        if (length > words.size() - at)
          throw std::runtime_error("RPC length");
        auto p = std::span<const double>(words).subspan(at, length);
        at += length;
        if (op == 1)
          result = session.prepare(p);
        else if (op == 2)
          session.commit(p[0]);
        else if (op == 3)
          session.discard(p[0]);
        else if (op == 4)
          result = session.stats();
        else if (op == 5)
          session.close();
        else
          throw std::runtime_error("RPC opcode");
      }
      std::cout.write(reinterpret_cast<const char *>(result.data()),
                      result.size() * 8);
      return 0;
    }
    if (argc > 1 && std::string(argv[1]) == "sem") {
      _setmode(_fileno(stdin), _O_BINARY);
      _setmode(_fileno(stdout), _O_BINARY);
      std::vector<char> bytes{std::istreambuf_iterator<char>(std::cin),
                              std::istreambuf_iterator<char>()};
      if (bytes.size() % 8)
        throw std::runtime_error("alignment");
      std::vector<double> words(bytes.size() / 8);
      std::memcpy(words.data(), bytes.data(), bytes.size());
      semantics_geometry::Session session(1, argc > 2 ? std::stod(argv[2]) : 7);
      auto result = session.evaluate(words);
      std::cout.write(reinterpret_cast<const char *>(result.data()),
                      result.size() * 8);
      return 0;
    }
    scene_composition::Session session(1, 7);
    auto p = packet(1, {1, 0, 0, 2, 1, 1, 2, 2, 0, 1, 1, 0}, 2),
         out = session.prepare(p), saved = out;
    require(std::vector<double>(out.begin() + 16, out.end()) ==
            std::vector<double>{1, 0, 1, 0, 0, 0, 2, 0, 1, 0, 1, 1, 1, 1, 2});
    require(session.stats()[0] == 0 && session.stats()[1] == 2);
    rejects([&] { session.prepare(p); });
    session.commit(1);
    require(session.stats()[0] == 2 && session.stats()[1] == 0);
    auto update = packet(2, {2, 1, 1, 2, 0}, 1);
    auto next = session.prepare(update);
    require(next != out && out == saved);
    session.discard(2);
    require(session.stats()[0] == 2 && session.stats()[1] == 0);
    auto cycle = packet(3, {1, 1, 0, 2, 1, 0, 1}, 1);
    rejects([&] { session.prepare(cycle); });
    require(session.stats()[0] == 2 && session.stats()[1] == 0);
    auto dangling = packet(3, {2}, 0, 1);
    rejects([&] { session.prepare(dangling); });
    auto duplicate = packet(3, {2, 1, 0, 1, 0, 2, 1, 0, 1, 0}, 2);
    rejects([&] { session.prepare(duplicate); });
    auto malformed = p;
    malformed[4] = 3;
    malformed[3] = 8;
    rejects([&] { session.prepare(malformed); });
    malformed = p;
    malformed[4] = 3;
    malformed[16 + 3] = 4097;
    rejects([&] { session.prepare(malformed); });
    std::vector<double> deep;
    for (size_t i = 1; i <= 129; ++i) {
      deep.insert(deep.end(), {double(i), 0, 0, 0, i < 129 ? 1. : 0.});
      if (i < 129)
        deep.insert(deep.end(), {0, double(i + 1)});
    }
    scene_composition::Session depth(1, 7);
    rejects([&] { depth.prepare(packet(1, deep, 129)); });
    require(depth.stats()[0] == 0 && depth.stats()[1] == 0);
    depth.close();
    auto remove = packet(3, {1, 1, 0, 2, 0, 2}, 1, 1);
    session.prepare(remove);
    session.commit(3);
    require(session.stats()[0] == 1 &&
            session.stats()[4] <= scene_composition::maxBytes);
    rejects([&] { session.commit(2); });
    session.close();
    require(session.stats()[0] == 0 && session.stats()[1] == 0 &&
            session.stats()[2] == 0 && session.stats()[3] == 0);
    rejects([&] { session.prepare(p); });
    std::cout << "PASS actual C++ Scene create/update/remove, ordering/scopes, "
                 "immutable output, prepare/commit/discard, "
                 "cycle/dangling/duplicate/depth/budget/foreign/stale/close\n";
    return 0;
  } catch (const std::exception &e) {
    std::cerr << e.what() << '\n';
    return 1;
  }
}
