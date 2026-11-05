// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>
#include <set>
namespace nelyx::v2 {
void View::interaction(Event e) {
  if (e.kind == wire::events::editingChanged || e.kind == wire::events::needChildren ||
      e.kind == wire::events::controlChanged || (e.kind==wire::events::gesture&&
        (e.status==wire::gestureKinds::panUpdate||e.status==wire::gestureKinds::pinchUpdate||e.status==wire::gestureKinds::hover))) {
    for (auto &old : interactionEvents)
      if (old.kind == e.kind && old.node == e.node && (e.kind!=wire::events::gesture||old.status==e.status)) {
        old = e;
        return;
      }
  }
  if (interactionEvents.size() >= wire::limits::interactionEvents) {
    overflowed = true;
    return;
  }
  interactionEvents.push_back(e);
}
void View::installEditors(const std::shared_ptr<const Document> &nextDocument) {
  std::map<uint64_t, std::shared_ptr<EditingDocument>> staged;
  uint64_t serial = editClock;
  for (const auto &slot : nextDocument->nodes)
    if (slot.value && slot.value->kind == wire::kinds::editable) {
      const auto &n = *slot.value;
      const auto old = editors.find(n.id.key());
      if (old != editors.end()) {
        require(old->second->value->text.size() <= n.maximumLength, wire::statuses::budgetExceeded);
        require((n.editFlags & wire::editFlags::multiline) ||
                    old->second->value->text.find_first_of(u"\r\n") == std::u16string::npos,
                wire::statuses::invalidValue);
        staged.emplace(n.id.key(), old->second);
      } else {
        require(staged.size() < wire::limits::editors, wire::statuses::budgetExceeded);
        const auto text = n.text ? utf16({reinterpret_cast<const uint8_t *>(n.text->value.data()),
                                          n.text->value.size()})
                                 : std::u16string{};
        require(text.size() <= n.maximumLength, wire::statuses::budgetExceeded);
        require((n.editFlags & wire::editFlags::multiline) ||
                    text.find_first_of(u"\r\n") == std::u16string::npos,
                wire::statuses::invalidValue);
        serial = next(serial);
        staged.emplace(n.id.key(), std::make_shared<EditingDocument>(lease.ledger, text, serial));
      }
    }
  require(staged.size() <= wire::limits::editors, wire::statuses::budgetExceeded);
  const bool clearFocus =
      focusNode && (!nextDocument->contains(focusNode) ||
                    (nextDocument->get(focusNode).editFlags & wire::editFlags::disabled) ||
                    (nextDocument->get(focusNode).semantics &&
                     (nextDocument->get(focusNode).semantics->flags &
                      (wire::semanticsFlags::disabled | wire::semanticsFlags::hidden))));
  if (clearFocus) {
    const auto found = staged.find(focusNode.key());
    if (found != staged.end() && found->second->value->composingStart >= 0) {
      const auto &e = *found->second->value;
      EditCommand command;
      command.revision = e.revision;
      command.text = e.text;
      command.base = e.base;
      command.extent = e.extent;
      found->second->apply(command, next(serial));
      serial = found->second->value->serial;
    }
  }
  editors = std::move(staged);
  editClock = serial;
  if (clearFocus) {
    interaction({wire::events::focusChanged, wire::statuses::canceled, focusSession,
                 nextDocument->epoch, publication, focusNode});
    focusNode = {};
    focusSession = 0;
  }
}
std::shared_ptr<const Document> View::editingDocument() const {
  if (!document || editors.empty())
    return document;
  auto result = std::make_shared<Document>(*document);
  std::map<uint32_t, uint64_t> revisions;
  for (const auto &entry : editors) {
    const auto &value = entry.second->value;
    Handle node{uint32_t(entry.first), uint32_t(entry.first >> 32)};
    if (!result->contains(node))
      continue;
    auto copy = std::make_shared<Node>(result->get(node));
    copy->editing = value;
    copy->text = value->paintText;
    copy->editSerial = value->serial;
    result->nodes[node.slot].value = copy;
    for (auto h = node; h; h = document->get(h).parent)
      revisions[h.slot] = std::max(revisions[h.slot], value->serial);
  }
  for (const auto &item : revisions) {
    auto copy = std::make_shared<Node>(*result->nodes[item.first].value);
    copy->editSerial = item.second;
    result->nodes[item.first].value = std::move(copy);
  }
  return result;
}
void View::setFocus(Handle node, uint64_t snapshot, uint64_t expected) {
  require(expected == 0 || expected == focusSession, wire::statuses::stale);
  if (node) {
    require(visible && focused && published && snapshot == publication &&
                published->allows(node) &&
                published->scene->metrics.epoch == metrics.epoch &&
                published->scene->document->contains(node) && document->contains(node),
            wire::statuses::stale);
    const auto &n = published->scene->document->get(node);
    const auto &current = document->get(node);
    const auto disabled = n.editFlags & wire::editFlags::disabled;
    require(
        !disabled && !n.control.disabled && !current.control.disabled && !(current.editFlags & wire::editFlags::disabled) &&
            (!current.semantics || !(current.semantics->flags & (wire::semanticsFlags::disabled |
                                                                 wire::semanticsFlags::hidden))) &&
            (!n.semantics || !(n.semantics->flags &
                               (wire::semanticsFlags::disabled | wire::semanticsFlags::hidden))) &&
            (n.kind == wire::kinds::editable ||
             (n.semantics && (n.semantics->actions & wire::semanticsActions::focus))),
        wire::statuses::capabilityMissing);
  } else
    require(!expected || expected == focusSession, wire::statuses::stale);
  if (node == focusNode)
    return;
  if (focusNode) {
    const auto old = editors.find(focusNode.key());
    if (old != editors.end() && old->second->value->composingStart >= 0) {
      const auto &v = *old->second->value;
      EditCommand command;
      command.revision = v.revision;
      command.text = v.text;
      command.base = v.base;
      command.extent = v.extent;
      const auto serial = next(editClock);
      old->second->apply(command, serial);
      editClock = serial;
      interaction({wire::events::editingChanged, wire::statuses::ok, focusSession, document->epoch,
                   old->second->value->revision, focusNode});
      requestContent();
    }
  }
  focusNode = node;
  revealPending=bool(node);
  caretDeadline = 0; caretNode = {};
  focusSession = node ? next(nextFocus) : 0;
  if (node)
    nextFocus = focusSession;
  dirty = true;
  interaction({wire::events::focusChanged, wire::statuses::ok, focusSession,
               document ? document->epoch : 0, publication, node});
}
void View::applyEdit(Reader bytes) {
  require(bytes.length >= 64 && bytes.u32(52) == 0);
  const Handle node = handle(bytes, 0);
  const uint64_t session = bytes.u64(8), revision = bytes.u64(16);
  const auto kind = bytes.u32(24), policy = bytes.u32(28), length = bytes.u32(48);
  require(length <= wire::limits::textBytes && length <= bytes.length - 64 &&
              64 + (length + 7) / 8 * 8 == bytes.length,
          wire::statuses::budgetExceeded);
  for (size_t i = 64 + length; i < bytes.length; ++i)
    require(bytes.data[i] == 0);
  const auto found = editors.find(node.key());
  require(found != editors.end() && document && document->contains(node),
          wire::statuses::invalidHandle);
  const auto &n = document->get(node);
  const auto &current = *found->second->value;
  require(!(n.editFlags & wire::editFlags::disabled), wire::statuses::capabilityMissing);
  require((focusNode == node ? session == focusSession : session == 0), wire::statuses::stale);
  if (kind == wire::editKinds::update)
    require(focusNode == node && session && bytes.u64(56) > 0 && bytes.u64(56) <= publication,
            wire::statuses::stale);
  EditCommand command{kind,          policy,        revision,      utf16(bytes.slice(64, length)),
                      bytes.i32(32), bytes.i32(36), bytes.i32(40), bytes.i32(44)};
  if (n.editFlags & wire::editFlags::readOnly)
    require(kind == wire::editKinds::selection ||
                ((kind == wire::editKinds::replace || kind == wire::editKinds::update) &&
                 command.text == current.text),
            wire::statuses::capabilityMissing);
  if (kind == wire::editKinds::update || kind == wire::editKinds::replace) {
    require(command.text.size() <= n.maximumLength, wire::statuses::budgetExceeded);
    require((n.editFlags & wire::editFlags::multiline) ||
                command.text.find_first_of(u"\r\n") == std::u16string::npos,
            wire::statuses::invalidValue);
  }
  const auto serial = next(editClock);
  const auto value = found->second->apply(command, serial);
  if (value->serial == serial) {
    if(node==focusNode)revealPending=true;
    editClock = serial;
    ++editingWork;
    requestContent();
    interaction({wire::events::editingChanged, wire::statuses::ok, focusSession, document->epoch,
                 value->revision, node});
  }
}
void View::semanticAction(Reader bytes) {
  require(bytes.length == 32 && bytes.u32(20) == 0);
  const auto node = handle(bytes, 0);
  const auto snapshot = bytes.u64(8);
  const uint32_t action = bytes.u32(16);
  require(published && snapshot == publication &&
              published->allows(node) &&
              published->scene->metrics.epoch == metrics.epoch &&
              published->scene->document->contains(node) && document->contains(node),
          wire::statuses::stale);
  const auto &n = published->scene->document->get(node);
  const auto &current = document->get(node);
  require(
      n.semantics && current.semantics &&
          !(current.semantics->flags &
            (wire::semanticsFlags::disabled | wire::semanticsFlags::hidden)) &&
          !(n.semantics->flags & (wire::semanticsFlags::disabled | wire::semanticsFlags::hidden)) &&
          (current.semantics->actions & action) == action && action &&
          (action & (action - 1)) == 0 && (n.semantics->actions & action) == action,
      wire::statuses::capabilityMissing);
  ++semanticsWork;
  if (action == wire::semanticsActions::focus) {
    setFocus(node, snapshot, bytes.u64(24));
    return;
  }
  require(action != wire::semanticsActions::setValue &&
              action != wire::semanticsActions::setSelection,
          wire::statuses::capabilityMissing);
  if(action==wire::semanticsActions::activate)activateControl(node);
  interaction(
      {wire::events::semanticAction, wire::statuses::ok, snapshot, document->epoch, action, node});
}
Handle View::interactionTarget(double x, double y) const {
  if (!published)
    return {};
  const auto &d = *published->scene->document;
  for (auto it = published->items.rbegin(); it != published->items.rend(); ++it) {
    const auto &n = d.get(it->node);
    if(!published->allows(n.id))continue;
    if (!document->contains(n.id))
      continue;
    if(!published->hit(*it,x,y))continue;
    if (n.kind == wire::kinds::editable || (n.semantics && n.semantics->actions))
      return n.id;
  }
  return {};
}
} // namespace nelyx::v2
