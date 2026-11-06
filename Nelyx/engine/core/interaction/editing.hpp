// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <deque>
#include <string>

namespace nelyx::v2 {
struct TextData;
std::u16string utf16(Reader);
std::string utf8(const std::u16string &);
bool textBoundary(const std::u16string &, int32_t);
struct EditingValue {
  Lease lease;
  std::u16string text;
  std::shared_ptr<const TextData> paintText;
  uint64_t revision = 1, serial = 0;
  int32_t base = 0, extent = 0, composingStart = -1, composingEnd = -1;
  EditingValue(const std::shared_ptr<Ledger> &, std::u16string, uint64_t rev = 1);
};
struct TextRect {
  double x = 0, y = 0, width = 0, height = 0;
};
struct TextGeometry {
  Lease lease;
  uint64_t revision;
  TextRect caret;
  std::vector<TextRect> selection;
  TextGeometry(const std::shared_ptr<Ledger> &ledger, uint64_t rev, TextRect cursor,
               std::vector<TextRect> boxes)
      : lease(ledger, sizeof(TextGeometry) + boxes.size() * sizeof(TextRect)), revision(rev),
        caret(cursor), selection(std::move(boxes)) {}
};
struct EditCommand {
  uint32_t kind = 0, policy = 0;
  uint64_t revision = 0;
  std::u16string text;
  int32_t base = 0, extent = 0, composingStart = -1, composingEnd = -1;
};
class EditingDocument {
public:
  Lease lease;
  std::shared_ptr<const EditingValue> value;
  EditingDocument(const std::shared_ptr<Ledger> &, std::u16string, uint64_t serial);
  std::shared_ptr<const EditingValue> apply(const EditCommand &, uint64_t serial);
  static void validate(const std::u16string &, int32_t, int32_t, int32_t, int32_t);

private:
  std::deque<std::shared_ptr<const EditingValue>> undo_, redo_;
  std::shared_ptr<const EditingValue> compositionBase_;
  void remember(std::deque<std::shared_ptr<const EditingValue>> &,
                std::shared_ptr<const EditingValue>);
};
struct SemanticRangeData {
  bool enabled=false,readOnly=false;
  double minimum=0,maximum=0,value=0,smallChange=0,largeChange=0;
};
struct SemanticData {
  Lease lease;
  uint32_t role = 0, flags = 0, actions = 0;
  std::string label, hint, value, increasedValue, decreasedValue;
  SemanticRangeData range;
  SemanticData(const std::shared_ptr<Ledger> &ledger, uint32_t r, uint32_t f, uint32_t a,
               std::string name, std::string description, std::string displayed, std::string increased, std::string decreased, SemanticRangeData numeric)
      : lease(ledger, sizeof(SemanticData) + name.size() + description.size() + displayed.size() + increased.size() + decreased.size()), role(r), flags(f),
        actions(a), label(std::move(name)), hint(std::move(description)), value(std::move(displayed)), increasedValue(std::move(increased)), decreasedValue(std::move(decreased)), range(numeric) {}
};
} // namespace nelyx::v2
