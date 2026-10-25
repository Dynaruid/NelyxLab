// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace RNSkia::FileData {
// Explicit local-file IO. The app-confined asset stream remains unchanged.
inline std::filesystem::path pathFromUri(const std::string &uri) {
  if (uri.rfind("file:///", 0) != 0 || uri.size() <= 8)
    throw std::invalid_argument("Expected an absolute file:/// URI");
  auto hex = [](char c) -> int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
  };
  std::string decoded="/";
  for (size_t i=8; i<uri.size(); ++i) {
    unsigned char c=static_cast<unsigned char>(uri[i]);
    if (c=='?' || c=='#' || c=='\\' || c<=0x20)
      throw std::invalid_argument("Invalid file URI character");
    if (c=='%') {
      if (i+2>=uri.size() || hex(uri[i+1])<0 || hex(uri[i+2])<0)
        throw std::invalid_argument("Invalid file URI escape");
      c=static_cast<unsigned char>((hex(uri[i+1])<<4)|hex(uri[i+2]));i+=2;
    }
    if (c==0 || c=='\\') throw std::invalid_argument("Invalid local file path");
    decoded.push_back(static_cast<char>(c));
  }
#ifdef _WIN32
  // Local drive paths only; do not reinterpret a path as a UNC/device authority.
  if (decoded.size()<4 || decoded[2]!=':' || decoded[3]!='/' ||
      !((decoded[1]>='a'&&decoded[1]<='z')||(decoded[1]>='A'&&decoded[1]<='Z')))
    throw std::invalid_argument("Expected a local Windows drive file URI");
  decoded.erase(0,1);
#endif
#if defined(__cpp_char8_t)
  return std::filesystem::path(std::u8string(decoded.begin(),decoded.end()));
#else
  return std::filesystem::u8path(decoded);
#endif
}
inline std::vector<uint8_t> read(const std::string &uri,size_t limit) {
  if (limit==0 || limit>16*1024*1024) throw std::invalid_argument("Invalid file image byte budget");
  const auto path=pathFromUri(uri);
  if (!std::filesystem::is_regular_file(path)) throw std::runtime_error("File image is not a regular file");
  std::ifstream stream(path,std::ios::binary|std::ios::ate);
  if (!stream) throw std::runtime_error("Cannot open file image");
  const auto size=stream.tellg();
  if (size<=0 || static_cast<uint64_t>(size)>limit) throw std::runtime_error("File image exceeds nonempty byte budget");
  std::vector<uint8_t> bytes(static_cast<size_t>(size));stream.seekg(0);
  if (!stream.read(reinterpret_cast<char*>(bytes.data()),static_cast<std::streamsize>(bytes.size())) || stream.peek()!=std::char_traits<char>::eof())
    throw std::runtime_error("File image changed or could not be read");
  return bytes;
}
}
