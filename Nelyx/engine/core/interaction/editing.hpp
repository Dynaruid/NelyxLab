// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <deque>
#include <string>
#include <optional>
#include <vector>

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
  bool operator==(const SemanticRangeData&)const=default;
};
struct SemanticCustomActionData {
  uint32_t id=0,overrideAction=0;
  std::string label,hint;
  bool invokable=true,hintOverride=false;
  bool operator==(const SemanticCustomActionData&)const=default;
};
struct SemanticSortKey {
  double order=0;
  std::optional<std::string> name;
  bool operator==(const SemanticSortKey&)const=default;
};
struct SemanticMetadata {
  std::string identifier;
  uint32_t direction=0;
  std::optional<SemanticSortKey> sort;
  std::vector<SemanticCustomActionData> custom;
  bool operator==(const SemanticMetadata&)const=default;
  size_t bytes()const {
    size_t result=identifier.size()+(sort&&sort->name?sort->name->size():0)+custom.capacity()*sizeof(SemanticCustomActionData);
    for(const auto& action:custom)result+=action.label.size()+action.hint.size();
    return result;
  }
};
struct SemanticData {
  Lease lease;
  uint32_t role = 0, flags = 0, actions = 0;
  std::string label, hint, value, increasedValue, decreasedValue;
  SemanticRangeData range;
  SemanticMetadata metadata;
  uint32_t mergeFlags=0;
  bool explicitRole=false,declaredRole=false;
  static uint32_t defaultMergeFlags(uint32_t role,uint32_t flags){
    uint32_t result=0;
    if(role==wire::semanticsRoles::checkbox||role==wire::semanticsRoles::radio)
      result|=(flags&wire::semanticsFlags::mixed)?3u:(flags&wire::semanticsFlags::checked)?1u:2u;
    if(role==wire::semanticsRoles::switchControl)result|=((flags&wire::semanticsFlags::checked)?1u:2u)<<6;
    if(flags&wire::semanticsFlags::selected)result|=1u<<2;
    if(flags&wire::semanticsFlags::disabled)result|=2u<<4;
    if(flags&wire::semanticsFlags::focusable)result|=2u<<12;
    if(flags&wire::semanticsFlags::readOnly)result|=1u<<27;
    if(flags&wire::semanticsFlags::hidden)result|=1u<<22;
    if(flags&wire::semanticsFlags::scopesRoute)result|=1u<<20;
    if(flags&wire::semanticsFlags::namesRoute)result|=1u<<21;
    if(role==wire::semanticsRoles::button)result|=1u<<15;
    if(role==wire::semanticsRoles::textField)result|=1u<<16;
    if(role==wire::semanticsRoles::radio)result|=1u<<17;
    if(role==wire::semanticsRoles::link)result|=1u<<28;
    if(role==wire::semanticsRoles::slider)result|=1u<<29;
    return result;
  }
  SemanticData(const std::shared_ptr<Ledger> &ledger, uint32_t r, uint32_t f, uint32_t a,
               std::string name, std::string description, std::string displayed, std::string increased, std::string decreased, SemanticRangeData numeric,
               uint32_t sourceFlags=UINT32_MAX,uint32_t configuration=0,SemanticMetadata traits={})
      : lease(ledger, sizeof(SemanticData) + name.size() + description.size() + displayed.size() + increased.size() + decreased.size()+traits.bytes()), role(r), flags(f),
        actions(a), label(std::move(name)), hint(std::move(description)), value(std::move(displayed)), increasedValue(std::move(increased)), decreasedValue(std::move(decreased)), range(numeric),metadata(std::move(traits)) {
    mergeFlags=sourceFlags==UINT32_MAX?defaultMergeFlags(r,f):sourceFlags;
    declaredRole=sourceFlags==UINT32_MAX?(r==wire::semanticsRoles::radioGroup||r==wire::semanticsRoles::progressBar||r==wire::semanticsRoles::loadingSpinner||r==wire::semanticsRoles::dialog):bool(configuration&4u);
    explicitRole=sourceFlags==UINT32_MAX?(declaredRole||bool(mergeFlags&((1u<<16)|(1u<<20)|(1u<<23)|(1u<<28)|(1u<<29)|(1u<<30)))):bool(configuration&2u);
  }
};
} // namespace nelyx::v2
