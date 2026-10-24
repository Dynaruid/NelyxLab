#pragma once
#include <cstdint>
#include <array>
#include <memory>
#include <string>
#include <vector>
#include <stdexcept>

// All methods and destruction run on the renderer owner thread. No native object
// crosses the ABI: paragraph IDs and copied UTF-16 geometry are the public boundary.
class SkiaRenderer {
 public:
  class RasterizationUnconfirmed : public std::runtime_error {public:using std::runtime_error::runtime_error;};
  SkiaRenderer();
  // C ABI keeps the prepared owner reachable if initialization/drain fails.
  void initialize(const std::string& image,const std::string& font,const std::string& icu,bool gpu,uint64_t borrowedWindow=0,uint32_t linuxKind=0,uint64_t borrowedDisplay=0);
  ~SkiaRenderer();
  void close();
  std::string driver() const;
  std::string runtimeShaderStats() const;
  void resize(uint32_t width, uint32_t height);
  void render(const std::vector<uint8_t>& commands);
  bool readPixels(uint32_t width, uint32_t height, void* pixels);
  void recordPicture(uint32_t id,const std::vector<uint8_t>& commands);
  void rasterizePicture(uint32_t id,uint32_t width,uint32_t height,void* rgba,uint32_t length);
  void releasePicture(uint32_t id);
  std::string layout(uint32_t id, const std::string& text, float width, float size,
                     const std::string& locale, bool rtl, uint32_t color, uint32_t maxLines, const std::string& ellipsis);
  std::string layoutWithFont(uint32_t id, uint32_t font, const std::string& text, float width, float size,
                     const std::string& locale, bool rtl, uint32_t color, uint32_t maxLines, const std::string& ellipsis);
  void loadAsset(uint32_t id, uint32_t kind, const std::string& path, const std::string& family);
  void loadAssetBytes(uint32_t id, uint32_t kind, const std::vector<uint8_t>& bytes, const std::string& family);
  void releaseAsset(uint32_t id, uint32_t kind);
  std::string glyphs(uint32_t id);
  std::string range(uint32_t id, uint32_t start, uint32_t end);
  std::string hit(uint32_t id, float x, float y);
  void release(uint32_t id);
  void retireGpu();
 private:
  struct Impl;
  std::unique_ptr<Impl> impl;
};
