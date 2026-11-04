// SPDX-License-Identifier: BSD-3-Clause
#include "editing.hpp"
#include "../scene/document.hpp"
#include <algorithm>
namespace nelyx::v2 {
EditingValue::EditingValue(const std::shared_ptr<Ledger> &ledger, std::u16string value,
                           uint64_t rev)
    : lease(ledger, sizeof(EditingValue) + (value.size() + 1) * sizeof(char16_t)),
      text(std::move(value)), revision(rev) {
  const auto encoded = utf8(text);
  paintText = std::make_shared<TextData>(
      ledger, Reader{reinterpret_cast<const uint8_t *>(encoded.data()), encoded.size()});
}
std::u16string utf16(Reader input) {
  require(validUtf8(input), wire::statuses::invalidValue);
  std::u16string result;
  for (size_t i = 0; i < input.length;) {
    uint32_t cp = input.data[i++], count = 0;
    if (cp >= 0xf0) {
      cp &= 7;
      count = 3;
    } else if (cp >= 0xe0) {
      cp &= 15;
      count = 2;
    } else if (cp >= 0xc0) {
      cp &= 31;
      count = 1;
    }
    while (count--)
      cp = (cp << 6) | (input.data[i++] & 63);
    if (cp <= 0xffff)
      result.push_back(char16_t(cp));
    else {
      cp -= 0x10000;
      result.push_back(char16_t(0xd800 + (cp >> 10)));
      result.push_back(char16_t(0xdc00 + (cp & 1023)));
    }
  }
  return result;
}
std::string utf8(const std::u16string &input) {
  std::string result;
  for (size_t i = 0; i < input.size(); ++i) {
    uint32_t cp = input[i];
    if (cp >= 0xd800 && cp <= 0xdbff) {
      require(i + 1 < input.size() && input[i + 1] >= 0xdc00 && input[i + 1] <= 0xdfff,
              wire::statuses::invalidValue);
      cp = 0x10000 + ((cp - 0xd800) << 10) + (input[++i] - 0xdc00);
    } else
      require(cp < 0xdc00 || cp > 0xdfff, wire::statuses::invalidValue);
    if (cp < 0x80)
      result.push_back(char(cp));
    else if (cp < 0x800) {
      result.push_back(char(0xc0 | (cp >> 6)));
      result.push_back(char(0x80 | (cp & 63)));
    } else if (cp < 0x10000) {
      result.push_back(char(0xe0 | (cp >> 12)));
      result.push_back(char(0x80 | ((cp >> 6) & 63)));
      result.push_back(char(0x80 | (cp & 63)));
    } else {
      result.push_back(char(0xf0 | (cp >> 18)));
      result.push_back(char(0x80 | ((cp >> 12) & 63)));
      result.push_back(char(0x80 | ((cp >> 6) & 63)));
      result.push_back(char(0x80 | (cp & 63)));
    }
  }
  return result;
}
bool textBoundary(const std::u16string &text, int32_t p) {
  return p >= 0 && size_t(p) <= text.size() &&
         !(p > 0 && size_t(p) < text.size() && text[p] >= 0xdc00 && text[p] <= 0xdfff &&
           text[p - 1] >= 0xd800 && text[p - 1] <= 0xdbff);
}
void EditingDocument::validate(const std::u16string &text, int32_t base, int32_t extent,
                               int32_t start, int32_t end) {
  require(text.size() <= wire::limits::textBytes && utf8(text).size() <= wire::limits::textBytes,
          wire::statuses::budgetExceeded);
  require(
      textBoundary(text, base) && textBoundary(text, extent) &&
          ((start == -1 && end == -1) ||
           (start >= 0 && end >= start && textBoundary(text, start) && textBoundary(text, end))),
      wire::statuses::invalidValue);
}
EditingDocument::EditingDocument(const std::shared_ptr<Ledger> &ledger, std::u16string text,
                                 uint64_t serial)
    : lease(ledger, sizeof(EditingDocument) + wire::limits::editHistory * 2 *
                                                  sizeof(std::shared_ptr<const EditingValue>)) {
  validate(text, 0, 0, -1, -1);
  auto initial = std::make_shared<EditingValue>(ledger, std::move(text));
  initial->serial = serial;
  value = std::move(initial);
}
void EditingDocument::remember(std::deque<std::shared_ptr<const EditingValue>> &history,
                               std::shared_ptr<const EditingValue> entry) {
  history.push_back(std::move(entry));
  uint64_t bytes = 0;
  for (const auto &v : history)
    bytes += v->lease.bytes;
  while (history.size() > wire::limits::editHistory || bytes > wire::limits::editHistoryBytes) {
    bytes -= history.front()->lease.bytes;
    history.pop_front();
  }
}
std::shared_ptr<const EditingValue> EditingDocument::apply(const EditCommand &command,
                                                           uint64_t serial) {
  require(command.revision == value->revision, wire::statuses::baseConflict);
  const auto &old = *value;
  std::u16string text = command.text;
  int32_t base = command.base, extent = command.extent, start = command.composingStart,
          end = command.composingEnd;
  auto source = value;
  bool undo = false, redo = false;
  if (command.kind == wire::editKinds::undo || command.kind == wire::editKinds::redo) {
    require(old.composingStart < 0, wire::statuses::busy);
    auto &history = command.kind == wire::editKinds::undo ? undo_ : redo_;
    require(!history.empty(), wire::statuses::notFound);
    source = history.back();
    text = source->text;
    base = source->base;
    extent = source->extent;
    start = end = -1;
    undo = command.kind == wire::editKinds::undo;
    redo = !undo;
  } else if (command.kind == wire::editKinds::selection) {
    text = old.text;
    start = old.composingStart;
    end = old.composingEnd;
  } else if (command.kind == wire::editKinds::replace) {
    require(command.policy <= wire::compositionPolicies::cancel, wire::statuses::invalidValue);
    if (old.composingStart >= 0 && command.policy == wire::compositionPolicies::preserve)
      require(text == old.text && start == old.composingStart && end == old.composingEnd,
              wire::statuses::busy);
    if (command.policy != wire::compositionPolicies::preserve)
      start = end = -1;
  } else
    require(command.kind == wire::editKinds::update, wire::statuses::invalidValue);
  validate(text, base, extent, start, end);
  if (text == old.text && base == old.base && extent == old.extent && start == old.composingStart &&
      end == old.composingEnd)
    return value;
  auto fresh = std::make_shared<EditingValue>(lease.ledger, std::move(text), next(old.revision));
  fresh->serial = serial;
  fresh->base = base;
  fresh->extent = extent;
  fresh->composingStart = start;
  fresh->composingEnd = end;
  if (undo) {
    remember(redo_, value);
    undo_.pop_back();
  } else if (redo) {
    remember(undo_, value);
    redo_.pop_back();
  } else if (fresh->text != old.text) {
    if (old.composingStart < 0)
      remember(undo_, value);
    else if (compositionBase_)
      remember(undo_, compositionBase_);
    redo_.clear();
    compositionBase_.reset();
  } else if (old.composingStart < 0 && fresh->composingStart >= 0)
    compositionBase_ = value;
  if (fresh->composingStart < 0)
    compositionBase_.reset();
  value = std::move(fresh);
  return value;
}
} // namespace nelyx::v2
