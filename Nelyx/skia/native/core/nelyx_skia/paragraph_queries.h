// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstdint>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <utility>
#include <vector>
#include "modules/skparagraph/include/Paragraph.h"

namespace nelyx::skia_core {
struct ParagraphQueryIdentity {
  std::string owner,resource,text;uint64_t ownerGeneration=0,resourceGeneration=0;uint32_t units=0;
  bool operator==(ParagraphQueryIdentity const&)const=default;
};
struct ParagraphQueryBox {float left=0,top=0,right=0,bottom=0;bool rtl=false;};
struct ParagraphQueryHit {
  uint32_t position=0,start=0,end=0;bool upstream=false,hasGlyph=false;
  ParagraphQueryBox glyph;
};
class ParagraphQuerySource;
/** Shared by all accesses to an observed paragraph, including recording/paint.
 * Native accessibility reads try the same gate and return unavailable when busy.
 * No caller may retain a raw Paragraph beyond this scope. */
class ParagraphAccess final {
 public:
  explicit ParagraphAccess(skia::textlayout::Paragraph& paragraph);
  ParagraphAccess(ParagraphAccess&&)noexcept=default;
  ParagraphAccess(ParagraphAccess const&)=delete;
 private:
  std::shared_ptr<ParagraphQuerySource> source_;
  std::unique_lock<std::recursive_mutex> lock_;
};
/** The Core text service binds only its private, laid-out paragraph. Relayout or
 * disposal permanently retires the ticket. UI readers never construct a font,
 * shape text, invoke JavaScript, or wait for the JS owner to release its gate. */
class ParagraphQuerySource final {
 public:
  static std::shared_ptr<ParagraphQuerySource> create(std::shared_ptr<skia::textlayout::Paragraph> paragraph,std::shared_ptr<void> context,std::optional<std::string> originalText);
  ~ParagraphQuerySource();
  uint64_t bind(ParagraphQueryIdentity identity);
  void retire();
  static void willLayout(skia::textlayout::Paragraph& paragraph);
  static void didLayout(skia::textlayout::Paragraph& paragraph);
  static std::optional<std::vector<std::vector<ParagraphQueryBox>>> ranges(uint64_t ticket,void const* context,ParagraphQueryIdentity const& identity,std::vector<std::pair<uint32_t,uint32_t>> const& ranges);
  static std::optional<ParagraphQueryHit> hit(uint64_t ticket,void const* context,ParagraphQueryIdentity const& identity,float x,float y);
 private:
  friend class ParagraphAccess;
  struct Impl;
  explicit ParagraphQuerySource(std::unique_ptr<Impl> impl);
  std::unique_ptr<Impl> impl_;
};
}
