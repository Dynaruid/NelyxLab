// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../../sdk/native/windows-hermes/Editors.h"
#include "../../../sdk/native/windows-hermes/SemanticsTree.h"
#include "../../core/engine.hpp"
#include "../../core/state.hpp"
#include "skia_provider.hpp"
#include <set>

namespace nelyx::v2::windows {
namespace nh = ::Nelyx::NativeHermes;
namespace wi = ::Nelyx::WindowsInput;
namespace ws = ::Nelyx::WindowsSemantics;
class Interaction {
  HWND window;
  Engine &engine;
  std::function<std::vector<uint8_t>(uint32_t, const std::vector<uint8_t> &)> call;
  std::function<void(std::function<void()>)> post;
  std::function<void()> wake;
  std::shared_ptr<nh::Editors> editors;
  std::shared_ptr<nh::SemanticsTree> semantics;
  std::shared_ptr<int> context = std::make_shared<int>(1);
  std::shared_ptr<const InteractionSnapshot> snapshot;
  std::shared_ptr<const Prepared> prepared;
  uint64_t viewport = 0, device = 0;
  struct Editor {
    Handle node;
    wi::DocumentValue native;
    std::shared_ptr<const EditingValue> core;
    uint32_t flags = 0;
  };
  std::map<std::string, Editor> documents;
  bool syncing = false, closed = false;
  uint64_t request = 0;
  struct Forced {std::vector<uint8_t> bytes,result;Handle node;uint64_t nativeRequest;};
  std::map<uint64_t,Forced> forced;
  std::vector<uint8_t> reply(const std::vector<uint8_t>& bytes,uint32_t status){
    const Reader input{bytes.data(),bytes.size()};auto result=call(wire::opcodes::inspect,{});
    Writer packet(result.size());packet.bytes=std::move(result);packet.u16(12,uint16_t(input.u16(12)|0x8000));
    packet.u16(14,uint16_t(status));packet.u64(40,input.u64(40));return std::move(packet.bytes);
  }
  std::string focused;
  Handle pressed;
  int32_t pointerAnchor = 0;
  wchar_t high = 0;
  static std::string key(Handle h) {
    return std::to_string(h.slot) + ":" + std::to_string(h.generation);
  }
  static std::wstring wide(const std::u16string &s) {
    return {reinterpret_cast<const wchar_t *>(s.data()), s.size()};
  }
  static std::wstring wide(const std::string &s) {
    return wide(utf16({reinterpret_cast<const uint8_t *>(s.data()), s.size()}));
  }
  nh::EditorCommand command(const std::string &id, const char *kind) {
    nh::EditorCommand c;
    c.kind = kind;
    c.id = id;
    c.generation = documents.at(id).node.generation;
    return c;
  }
  std::vector<uint8_t> edit(Handle node, uint32_t kind, const std::u16string &text, int32_t base,
                            int32_t extent, int32_t start = -1, int32_t end = -1,
                            uint32_t policy = wire::compositionPolicies::preserve) {
    const auto &entry = documents.at(key(node));
    const auto encoded = utf8(text);
    Writer b(64 + (encoded.size() + 7) / 8 * 8);
    writeHandle(b, 0, node);
    b.u64(8, snapshot && snapshot->focus == node ? snapshot->session : 0);
    b.u64(16, entry.core->revision);
    b.u32(24, kind);
    b.u32(28, policy);
    b.u32(32, uint32_t(base));
    b.u32(36, uint32_t(extent));
    b.u32(40, uint32_t(start));
    b.u32(44, uint32_t(end));
    b.u32(48, uint32_t(encoded.size()));
    b.u64(56, snapshot ? snapshot->frame.id : 0);
    if (!encoded.empty())
      std::memcpy(b.bytes.data() + 64, encoded.data(), encoded.size());
    return call(wire::opcodes::edit, b.bytes);
  }
  bool selectPoint(Handle node, double x, double y, bool begin) {
    if (!snapshot || !prepared || snapshot->focus != node ||
        prepared->id != snapshot->frame.scene->preparation ||
        snapshot->frame.scene->metrics.epoch != snapshot->metrics.epoch)
      return false;
    const auto value = snapshot->editors.find(node.key());
    const auto source = prepared->editors.find(node.key());
    if (value == snapshot->editors.end() || source == prepared->editors.end() ||
        value->second->composingStart >= 0 ||
        source->second.identity.text != utf8(value->second->text))
      return false;
    const auto item = std::find_if(snapshot->frame.items.begin(), snapshot->frame.items.end(),
                                   [&](const auto &i) { return i.node == node; });
    if (item == snapshot->frame.items.end())
      return false;
    const auto &q = source->second;
    const auto& visual=snapshot->frame.scene->document->get(node);
    const auto hit = skia_core::ParagraphQuerySource::hit(
        q.ticket, prepared->context.get(), q.identity, float(x - item->x-visual.contentX), float(y - item->y-visual.contentY));
    if (!hit)
      return false;
    int32_t position = int32_t(hit->position);
    if (hit->hasGlyph && position > int32_t(hit->start) && position < int32_t(hit->end)) {
      const bool left = x - item->x-visual.contentX < (hit->glyph.left + hit->glyph.right) / 2.;
      position = int32_t(left != hit->glyph.rtl ? hit->start : hit->end);
    }
    const auto after = std::lower_bound(q.characters.begin(), q.characters.end(), position);
    if (after == q.characters.end())
      position = int32_t(value->second->text.size());
    else if (*after != position) {
      const auto before = after == q.characters.begin() ? 0 : *(after - 1);
      position = position - before < *after - position ? before : *after;
    }
    if (begin)
      pointerAnchor = position;
    auto result = edit(node, wire::editKinds::selection, {}, pointerAnchor, position);
    if (Reader{result.data(), result.size()}.u16(14) != wire::statuses::ok)
      return false;
    wake();
    sync();
    return true;
  }
  void nativeEvent(nh::Editors::Event e) {
    auto found = documents.find(e.id);
    if (found == documents.end() || found->second.node.generation != e.generation || closed)
      return;
    if (e.kind == "characters" && snapshot && prepared &&
        prepared->id == snapshot->frame.scene->preparation) {
      const auto record = prepared->editors.find(found->second.node.key());
      if (record == prepared->editors.end())
        return;
      const auto &q = record->second;
      std::vector<std::pair<uint32_t, uint32_t>> spans;
      for (int i = e.start; i < e.end && spans.size() < 4096; ++i)
        spans.emplace_back(uint32_t(i), uint32_t(i + 1));
      if (spans.size() != size_t(e.end - e.start))
        return;
      const auto ranges = skia_core::ParagraphQuerySource::ranges(q.ticket, prepared->context.get(),
                                                                  q.identity, spans);
      if (!ranges)
        return;
      const auto item = std::find_if(snapshot->frame.items.begin(), snapshot->frame.items.end(),
                                     [&](const auto &x) { return x.node == found->second.node; });
      if (item == snapshot->frame.items.end())
        return;
      auto c = command(e.id, "geometry");
      c.revision = e.revision;
      c.text = found->second.native.text;
      c.selection = found->second.native.selection;
      const auto &n = snapshot->frame.scene->document->get(item->node);
      if (!n.textGeometry || n.textGeometry->revision != found->second.core->revision)
        return;
      const auto &caret = n.textGeometry->caret;
      c.geometry =
          wi::CoreGeometry{{"native-hermes:root", 1},
                           snapshot->metrics.epoch,
                           e.epoch,
                           {item->x, item->y, n.properties.width, n.properties.height},
                           {item->clip.x, item->clip.y, item->clip.width, item->clip.height},
                           {item->x + caret.x, item->y + caret.y, caret.width, caret.height},
                           item->x + n.contentX,
                           item->y + n.baseline,
                           snapshot->metrics.device};
      c.start = e.start;
      c.end = e.end;
      for (const auto &row : *ranges) {
        wi::Rect bounds;
        bool first = true;
        for (const auto &r : row) {
          if (first) {
            bounds = {item->x + n.contentX + r.left, item->y + n.contentY + r.top, r.right - r.left, r.bottom - r.top};
            first = false;
          } else {
            const double right = std::max(bounds.x + bounds.width, item->x + n.contentX + r.right),
                         bottom = std::max(bounds.y + bounds.height, item->y + n.contentY + r.bottom);
            bounds.x = std::min(bounds.x, item->x + n.contentX + r.left);
            bounds.y = std::min(bounds.y, item->y + n.contentY + r.top);
            bounds.width = right - bounds.x;
            bounds.height = bottom - bounds.y;
          }
        }
        c.rects.push_back(bounds);
      }
      post([this, token = std::weak_ptr<int>(context), c = std::move(c)]() mutable {
        if (!token.expired())
          editors->execute(std::move(c));
      });
      return;
    }
    if (e.kind == "hit" && snapshot && prepared &&
        prepared->id == snapshot->frame.scene->preparation) {
      const auto record = prepared->editors.find(found->second.node.key());
      if (record == prepared->editors.end())
        return;
      const auto item = std::find_if(snapshot->frame.items.begin(), snapshot->frame.items.end(),
                                     [&](const auto &x) { return x.node == found->second.node; });
      if (item == snapshot->frame.items.end())
        return;
      POINT point = e.point;
      ScreenToClient(window, &point);
      const double scale = GetDpiForWindow(window) / 96.;
      const auto &q = record->second;
      const auto &node = snapshot->frame.scene->document->get(item->node);
      const auto hit = skia_core::ParagraphQuerySource::hit(
          q.ticket, prepared->context.get(), q.identity, float(point.x / scale - item->x - node.contentX),
          float(point.y / scale - item->y - node.contentY));
      auto c = command(e.id, "hit");
      c.revision = e.revision;
      c.request = e.request;
      if (hit)
        c.hit = int(hit->position);
      post([this, token = std::weak_ptr<int>(context), c = std::move(c)]() mutable {
        if (!token.expired())
          editors->execute(std::move(c));
      });
      return;
    }
    if (e.kind != "editing")
      return;
    auto &entry = found->second;
    entry.native = e.editing.value;
    if(e.editing.request)for(auto& [id,pending]:forced)if(pending.result.empty()&&pending.nativeRequest==*e.editing.request&&pending.node==entry.node){
      if(!e.editing.rejection.empty()){pending.result=reply(pending.bytes,e.editing.rejection=="composing"?wire::statuses::timedOut:wire::statuses::baseConflict);wake();return;}
      const auto current=engine.interactionSnapshot(1,1);const Reader original{pending.bytes.data(),pending.bytes.size()};
      if(!current||current->focus!=entry.node||current->session!=original.u64(wire::headerBytes+8)||!current->editors.count(entry.node.key()))
        pending.result=reply(pending.bytes,wire::statuses::canceled);
      else {auto accepted=pending.bytes;Writer revision(8);revision.u64(0,current->editors.at(entry.node.key())->revision);
        std::memcpy(accepted.data()+wire::headerBytes+16,revision.bytes.data(),8);pending.result=engine.dispatch({accepted.data(),accepted.size()});}
      wake();sync();return;
    }
    if (syncing || e.editing.programmatic || !snapshot || snapshot->focus != entry.node ||
        !entry.native.focused)
      return;
    const auto &n = entry.native;
    const std::u16string text(reinterpret_cast<const char16_t *>(n.text.data()), n.text.size());
    auto result = edit(entry.node, wire::editKinds::update, text, n.selection.anchor,
                       n.selection.focus, n.composing.start, n.composing.end);
    const auto status = Reader{result.data(), result.size()}.u16(14);
    if (status != wire::statuses::ok && status != wire::statuses::stale &&
        status != wire::statuses::baseConflict)
      throw std::runtime_error("TSF edit rejected: " + std::to_string(status));
    auto current = engine.interactionSnapshot(1, 1);
    if (current) {
      snapshot = current;
      auto value = current->editors.find(entry.node.key());
      if (value != current->editors.end())
        entry.core = value->second;
    }
    wake();
    post([this, token = std::weak_ptr<int>(context)] {
      if (!token.expired() && !closed)
        sync();
    });
  }
  bool publishedAction(uint32_t opcode,Writer body,Handle node,const InteractionSnapshot& observed) {
    const auto before=std::find_if(observed.frame.items.begin(),observed.frame.items.end(),[&](const auto& item){return item.node==node;});
    if(before==observed.frame.items.end())return false;
    for(unsigned attempt=0;attempt<3;++attempt){
      const auto current=engine.interactionSnapshot(1,1);
      if(!current||!current->frame.allows(node)||!current->frame.scene->document->contains(node))return false;
      const auto after=std::find_if(current->frame.items.begin(),current->frame.items.end(),[&](const auto& item){return item.node==node;});
      const auto& oldNode=observed.frame.scene->document->get(node);const auto& newNode=current->frame.scene->document->get(node);
      if(after==current->frame.items.end()||before->x!=after->x||before->y!=after->y||
        oldNode.properties.width!=newNode.properties.width||oldNode.properties.height!=newNode.properties.height||
        before->clip.x!=after->clip.x||before->clip.y!=after->clip.y||before->clip.width!=after->clip.width||before->clip.height!=after->clip.height)return false;
      body.u64(8,current->frame.id);const auto result=call(opcode,body.bytes);const auto status=Reader{result.data(),result.size()}.u16(14);
      if(status==wire::statuses::ok)return true;
      if(status!=wire::statuses::stale)return false;
    }
    return false;
  }
  void action(nh::SemanticsTree::Action action,std::shared_ptr<const InteractionSnapshot> observed) {
    if (closed || !snapshot || !observed || action.commit != observed->frame.id)
      return;
    const Handle node{uint32_t(action.source), uint32_t(action.source >> 32)};
    if (!snapshot->document->contains(node))
      return;
    if (action.kind == "focus") {
      ::SetFocus(window);
      Writer b(24);
      writeHandle(b, 0, node);
      b.u64(8, action.commit);
      publishedAction(wire::opcodes::focus,std::move(b),node,*observed);
      wake();
      sync();
      return;
    }
    if (action.text) {
      const auto found = documents.find(key(node));
      if (found == documents.end() || action.text->revision != found->second.core->revision)
        return;
      const auto &a = *action.text;
      if (a.kind == ws::TextActionKind::SetText) {
        const std::u16string text(reinterpret_cast<const char16_t *>(a.text.data()), a.text.size());
        edit(node, wire::editKinds::replace, text, a.anchor, a.focus);
      } else if (a.kind == ws::TextActionKind::SetSelection)
        edit(node, wire::editKinds::selection, {}, a.anchor, a.focus);
      wake();
      sync();
      return;
    }
    if(action.kind=="set-range-value"&&action.value){
      Writer b(32);writeHandle(b,0,node);b.u64(8,action.commit);b.f64(16,*action.value);
      publishedAction(wire::opcodes::controlValue,std::move(b),node,*observed);wake();return;
    }
    Writer b(32);
    writeHandle(b, 0, node);
    b.u64(8, action.commit);
    b.u32(16, wire::semanticsActions::activate);
    publishedAction(wire::opcodes::semanticsAction,std::move(b),node,*observed);
    wake();
  }

public:
  uint64_t publications = 0, nativeEdits = 0;
  Interaction(HWND window, Engine &engine, decltype(call) call, decltype(post) post,
              decltype(wake) wake)
      : window(window), engine(engine), call(std::move(call)), post(std::move(post)),
        wake(std::move(wake)) {
    editors = std::make_shared<nh::Editors>(window, this->post, [this](auto e) {
      ++nativeEdits;
      nativeEvent(std::move(e));
    });
    semantics = nh::SemanticsTree::create(
        window,
        [this](auto a) {
          this->post([this, token = std::weak_ptr<int>(context), observed=snapshot, a = std::move(a)]() mutable {
            if (!token.expired())
              action(std::move(a),std::move(observed));
          });
        },
        this->post);
  }
  bool filter(const MSG &message) { return !closed && editors->filter(message); }
  void timer(UINT_PTR id) {
    if (!closed)
      editors->timer(id);
  }
  LRESULT object(WPARAM w, LPARAM l) {
    return closed ? 0 : UiaReturnRawElementProvider(window, w, l, semantics->root.Get());
  }
  std::vector<uint8_t> gateway(const std::vector<uint8_t> &bytes) {
    const Reader r{bytes.data(), bytes.size()};
    const auto op = r.u16(12);
    if (op == wire::opcodes::edit && bytes.size() >= wire::headerBytes + 64) {
      const auto id=r.u64(40);const auto known=forced.find(id);
      if(known!=forced.end()){
        if(known->second.bytes!=bytes)return reply(bytes,wire::statuses::idReused);
        return known->second.result.empty()?reply(bytes,wire::statuses::busy):known->second.result;
      }
      const auto node = handle(r, wire::headerBytes);
      auto found = documents.find(key(node));
      if (r.u32(wire::headerBytes + 24) == wire::editKinds::update) {
        auto guarded = bytes;
        std::fill_n(guarded.data() + wire::headerBytes + 24, 4, uint8_t(0xff));
        return engine.dispatch({guarded.data(), guarded.size()});
      }
      if (found != documents.end() && found->second.native.composing.active()) {
        const auto b=wire::headerBytes;
        if(r.u32(b+24)==wire::editKinds::replace&&r.u32(b+28)!=wire::compositionPolicies::preserve){
          if(!id||r.u32(b+28)>wire::compositionPolicies::cancel)return reply(bytes,wire::statuses::invalidValue);
          const auto state=engine.interactionSnapshot(1,1);
          if(!state||state->focus!=node||state->session!=r.u64(b+8)||!state->editors.count(node.key())||state->editors.at(node.key())->revision!=r.u64(b+16))
            return reply(bytes,wire::statuses::baseConflict);
          size_t held=0;for(const auto& cached:forced)held+=cached.second.bytes.size()+cached.second.result.size();
          for(auto it=forced.begin();it!=forced.end()&&(forced.size()>=32||held+bytes.size()>wire::limits::packetBytes);){
            if(!it->second.result.empty()){held-=it->second.bytes.size()+it->second.result.size();it=forced.erase(it);}else ++it;}
          if(forced.size()>=32||held+bytes.size()>wire::limits::packetBytes)return reply(bytes,wire::statuses::budgetExceeded);
          const auto length=r.u32(b+48);if(length>wire::limits::textBytes||b+64+((length+7)/8)*8!=bytes.size())return reply(bytes,wire::statuses::malformed);
          std::u16string replacement;
          try{
            const auto& n=state->document->get(node);replacement=utf16(r.slice(b+64,length));
            require(!(n.editFlags&(wire::editFlags::readOnly|wire::editFlags::disabled)),wire::statuses::capabilityMissing);
            require(replacement.size()<=n.maximumLength,wire::statuses::budgetExceeded);
            require((n.editFlags&wire::editFlags::multiline)||replacement.find_first_of(u"\r\n")==std::u16string::npos,wire::statuses::invalidValue);
            EditingDocument::validate(replacement,r.i32(b+32),r.i32(b+36),-1,-1);
            require(r.i32(b+40)==-1&&r.i32(b+44)==-1&&r.u32(b+52)==0&&r.u64(b+56)==0,wire::statuses::invalidValue);
            for(size_t i=b+64+length;i<bytes.size();++i)require(bytes[i]==0);
          }catch(const Error& error){return reply(bytes,error.status);}
          auto commandValue=command(key(node),"replace");commandValue.text=wide(replacement);
          commandValue.selection={r.i32(b+32),r.i32(b+36)};commandValue.revision=found->second.native.revision;
          commandValue.request=++request;commandValue.cancel=true;
          forced.emplace(id,Forced{bytes,{},node,commandValue.request});
          try{editors->execute(std::move(commandValue));}catch(...){forced.erase(id);throw;}
          wake();return forced.at(id).result.empty()?reply(bytes,wire::statuses::busy):forced.at(id).result;
        }
        auto guarded = bytes;
        Writer policy(4);
        policy.u32(0, wire::compositionPolicies::preserve);
        std::memcpy(guarded.data() + wire::headerBytes + 28, policy.bytes.data(), 4);
        // Native composition must acknowledge its end before an App replacement.
        auto result = engine.dispatch({guarded.data(), guarded.size()});
        wake();
        return result;
      }
    }
    auto result = engine.dispatch(r);
    wake();
    sync();
    return result;
  }
  void sync(std::shared_ptr<const Prepared> publication = nullptr) {
    if (publication)
      prepared = std::move(publication);
    if (closed || syncing)
      return;
    auto next = engine.interactionSnapshot(1, 1);
    if (!next)
      return;
    snapshot = next;
    syncing = true;
    struct Reset {
      bool &flag;
      ~Reset() { flag = false; }
    } reset{syncing};
    const auto &f = next->frame;
    const bool geometry =
        f.scene->metrics.epoch == next->metrics.epoch && f.device == next->metrics.device;
    if (viewport != next->metrics.epoch || device != next->metrics.device) {
      viewport = next->metrics.epoch;
      device = next->metrics.device;
      editors->metrics(viewport, device);
      semantics->metrics(viewport, device);
    }
    std::set<std::string> desired;
    for (const auto &entry : next->editors) {
      Handle h{uint32_t(entry.first), uint32_t(entry.first >> 32)};
      if (!next->document->contains(h))
        continue;
      const auto &node = next->document->get(h);
      const auto id = key(h);
      desired.insert(id);
      auto found = documents.find(id);
      if (found == documents.end()) {
        documents.emplace(id, Editor{h, {}, entry.second, node.editFlags});
        auto c = command(id, "attach");
        c.text = wide(entry.second->text);
        c.selection = {entry.second->base, entry.second->extent};
        c.maximum = node.maximumLength;
        c.enabled = !(node.editFlags & wire::editFlags::disabled);
        c.readOnly = node.editFlags & wire::editFlags::readOnly;
        c.multiline = node.editFlags & wire::editFlags::multiline;
        c.scope = node.editFlags & wire::editFlags::password ? IS_PASSWORD : IS_TEXT;
        editors->execute(std::move(c));
      } else {
        auto &old = found->second;
        old.core = entry.second;
        old.flags = node.editFlags;
        auto c = command(id, "configure");
        c.enabled = !(node.editFlags & wire::editFlags::disabled);
        c.readOnly = node.editFlags & wire::editFlags::readOnly;
        c.multiline = node.editFlags & wire::editFlags::multiline;
        c.scope = node.editFlags & wire::editFlags::password ? IS_PASSWORD : IS_TEXT;
        editors->execute(std::move(c));
        const bool pending=std::any_of(forced.begin(),forced.end(),[&](const auto& value){return value.second.node==node.id&&value.second.result.empty();});
        if (!pending && !old.native.composing.active() &&
            (old.native.text != wide(entry.second->text) ||
             old.native.selection != wi::Selection{entry.second->base, entry.second->extent})) {
          auto replace = command(id, "replace");
          replace.text = wide(entry.second->text);
          replace.selection = {entry.second->base, entry.second->extent};
          replace.revision = old.native.revision;
          replace.request = ++request;
          editors->execute(std::move(replace));
        }
      }
    }
    for (auto it = documents.begin(); it != documents.end();)
      if (!desired.contains(it->first)) {
        editors->execute(command(it->first, "detach"));
        it = documents.erase(it);
      } else
        ++it;
    const auto newFocus =
        next->focus && documents.contains(key(next->focus)) ? key(next->focus) : std::string{};
    if (focused != newFocus) {
      high = 0;
      if (!focused.empty() && documents.contains(focused))
        editors->execute(command(focused, "blur"));
      focused = newFocus;
      if (!focused.empty())
        editors->execute(command(focused, "focus"));
    }
    std::vector<nh::SemanticPacket> packets;
    std::map<uint64_t, int> indices;
    for (const auto &item : f.items) {
      const auto &node = f.scene->document->get(item.node);
      if(item.opacity<=0||!f.allows(node.id))continue;
      if (!next->document->contains(node.id))
        continue;
      const auto &current = next->document->get(node.id);
      const auto value = next->editors.find(node.id.key());
      const auto g = node.textGeometry;
      const bool textGeometry =
          geometry && value != next->editors.end() && g && g->revision == value->second->revision;
      wi::CoreGeometry frame{{"native-hermes:root", 1},
                             f.scene->metrics.epoch,
                             f.id,
                             {item.x, item.y, node.properties.width, node.properties.height},
                             {item.clip.x, item.clip.y, item.clip.width, item.clip.height},
                             {},
                             item.x + node.contentX,
                             item.y + node.baseline,
                             f.device};
      if (textGeometry) {
        frame.caret = {item.x + g->caret.x, item.y + g->caret.y, g->caret.width, g->caret.height};
        auto c = command(key(node.id), "geometry");
        c.text = wide(value->second->text);
        c.selection = {value->second->base, value->second->extent};
        c.revision = documents.at(key(node.id)).native.revision;
        c.geometry = frame;
        editors->execute(std::move(c));
      }
      const auto a = current.semantics;
      if (!a || (a->flags & wire::semanticsFlags::hidden))
        continue;
      nh::SemanticPacket packet;
      auto &s = packet.snapshot;
      s.owner = {"native-hermes:root", 1};
      s.id = key(node.id);
      s.source = node.id.key();
      s.commit = f.id;
      s.surface = next->metrics.device;
      s.frame = frame;
      s.bounds = frame.bounds;
      static const char *roles[] = {"group",      "group",  "button", "text",
                                    "text-field", "button", "group",  "button"};
      s.role = roles[a->role];
      packet.isLink = a->role == wire::semanticsRoles::link;
      packet.isSlider = a->role == wire::semanticsRoles::slider;
      if(packet.isSlider&&node.control.kind){nh::SemanticRange range;
        range.min=node.control.minimum;range.max=node.control.maximum;range.value=f.properties[node.id.slot].value;
        range.smallChange=node.control.step>0?node.control.step:(node.control.maximum-node.control.minimum)/20;
        range.largeChange=(node.control.maximum-node.control.minimum)/5;range.readOnly=node.control.disabled;
        packet.range=range;}
      packet.name = wide(a->label);
      packet.tooltip = wide(a->hint);
      packet.automationId = wide(s.id);
      s.enabled = geometry && !(a->flags & wire::semanticsFlags::disabled) &&
                  !(current.editFlags & wire::editFlags::disabled);
      s.focusable = (a->flags & wire::semanticsFlags::focusable) ||
                    (a->actions & wire::semanticsActions::focus);
      s.focused = next->focus == node.id;
      s.canActivate = a->actions & wire::semanticsActions::activate;
      if (a->role == wire::semanticsRoles::checkbox)
        packet.checked = node.control.kind ? f.properties[node.id.slot].value>node.control.minimum : bool(a->flags & wire::semanticsFlags::checked);
      if (a->flags & wire::semanticsFlags::selected)
        packet.selected = true;
      auto parent = node.parent;
      while (parent && !indices.contains(parent.key()))
        parent = f.scene->document->get(parent).parent;
      packet.parent = parent ? indices.at(parent.key()) : -1;
      if (value != next->editors.end()) {
        const auto &e = *value->second;
        ws::TextSnapshot t;
        t.generation = node.id.generation;
        t.revision = e.revision;
        t.textRevision = e.revision;
        t.readOnly = current.editFlags & wire::editFlags::readOnly;
        t.obscured = current.editFlags & wire::editFlags::password;
        t.enabled = s.enabled;
        t.focused = s.focused;
        if (!t.obscured) {
          t.text = wide(e.text);
          t.anchor = e.base;
          t.focus = e.extent;
          const auto record = prepared && prepared->id == f.scene->preparation
                                  ? prepared->editors.find(node.id.key())
                                  : std::map<uint64_t, Prepared::EditorParagraph>::const_iterator{};
          if (textGeometry && prepared && record != prepared->editors.end()) {
            const auto &q = record->second;
            t.characters = q.characters;
            t.words = q.words;
            t.lines = q.lines;
            ws::CoreParagraphFrame paragraph;
            paragraph.geometry = frame;
            paragraph.identity = q.identity;
            paragraph.ticket = q.ticket;
            paragraph.paintX = item.x + node.contentX;
            paragraph.paintY = item.y + node.contentY;
            paragraph.transform = {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};
            s.paragraph = paragraph;
          } else {
            t.characters = {0};
            if (!e.text.empty())
              t.characters.push_back(int(e.text.size()));
          }
        }
        s.text = std::move(t);
        s.hasGeometry = textGeometry;
      }
      indices[node.id.key()] = int(packets.size());
      packets.push_back(std::move(packet));
    }
    semantics->publish(std::move(packets), prepared ? std::weak_ptr<void>(prepared->context)
                                                    : std::weak_ptr<void>(context));
    ++publications;
  }
  bool point(uint32_t phase, double x, double y) {
    if (!snapshot)
      return false;
    Writer b(24);
    b.u64(0, snapshot->frame.id);
    b.f64(8, x);
    b.f64(16, y);
    if (phase == wire::phases::begin) {
      pressed = {};
      high = 0;
      std::vector<uint8_t> result;
      for(unsigned attempt=0;attempt<3;++attempt){
        const auto current=engine.interactionSnapshot(1,1);if(!current)break;
        b.u64(0,current->frame.id);result=call(wire::opcodes::focusAt,b.bytes);
        if(Reader{result.data(),result.size()}.u16(14)!=wire::statuses::stale)break;
      }
      if(result.empty())return false;
      if (Reader{result.data(), result.size()}.u16(14) == wire::statuses::ok) {
        wake();
        sync();
        pressed = snapshot->focus;
        if (!documents.contains(key(pressed))) { pressed={}; return false; }
        selectPoint(pressed, x, y, true);
        return true;
      }
    }
    if (pressed && phase == wire::phases::update) {
      if (documents.contains(key(pressed)))
        selectPoint(pressed, x, y, false);
      return true;
    }
    if (phase == wire::phases::cancel) {
      pressed = {};
      return true;
    }
    if (pressed && phase == wire::phases::end) {
      const auto target = pressed;
      pressed = {};
      if (documents.contains(key(target))) {
        selectPoint(target, x, y, false);
        return true;
      }
      const auto item = std::find_if(snapshot->frame.items.begin(), snapshot->frame.items.end(),
                                     [&](const auto &i) { return i.node == target; });
      if (item != snapshot->frame.items.end()) {
        const auto &n = snapshot->frame.scene->document->get(target);
        const auto &c = item->clip;
        if (x >= item->x && y >= item->y && x < item->x + n.properties.width &&
            y < item->y + n.properties.height && x >= c.x && y >= c.y && x < c.x + c.width &&
            y < c.y + c.height) {
          Writer action(32);
          writeHandle(action, 0, target);
          action.u64(8, snapshot->frame.id);
          action.u32(16, wire::semanticsActions::activate);
          call(wire::opcodes::semanticsAction, action.bytes);
          wake();
        }
      }
      return true;
    }
    return false;
  }
  bool character(wchar_t unit) {
    if (focused.empty() || !documents.contains(focused))
      return false;
    std::wstring text;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      high = unit;
      return true;
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) {
      if (!high)
        return true;
      text = {high, unit};
      high = 0;
    } else {
      high = 0;
      if (unit < 0x20)
        return false;
      text = {unit};
    }
    auto c = command(focused, "keyboardText");
    c.text = text;
    c.revision = documents.at(focused).native.revision;
    c.focusEpoch = snapshot->session;
    const auto result = editors->keyboardText(c, snapshot->session);
    return result.first != "unavailable";
  }
  bool keydown(WPARAM key) {
    if(snapshot&&(key==VK_TAB||(focused.empty()&&(key==VK_SPACE||key==VK_RETURN||
       key==VK_LEFT||key==VK_RIGHT||key==VK_UP||key==VK_DOWN||key==VK_HOME||key==VK_END)))){
      Writer data(24);data.u64(0,snapshot->frame.id);data.u32(8,uint32_t(key));
      data.u32(12,(GetKeyState(VK_SHIFT)&0x8000)?1u:0u);data.u32(16,1);
      call(wire::opcodes::key,data.bytes);wake();sync();return true;}
    if (focused.empty() || !documents.contains(focused))
      return false;
    auto &d = documents.at(focused);
    if (d.native.composing.active())
      return false;
    const auto e = d.core;
    const bool control = GetKeyState(VK_CONTROL) & 0x8000, shift = GetKeyState(VK_SHIFT) & 0x8000;
    uint32_t kind = wire::editKinds::selection;
    auto text = e->text;
    int32_t base = e->base, extent = e->extent;
    const auto start = std::min(base, extent), end = std::max(base, extent);
    const Prepared::EditorParagraph* paragraph=nullptr;
    if(prepared&&snapshot&&prepared->id==snapshot->frame.scene->preparation){const auto found=prepared->editors.find(d.node.key());
      if(found!=prepared->editors.end()&&found->second.identity.text==utf8(text))paragraph=&found->second;}
    const auto boundary=[&](int32_t at,bool forward,bool word){
      if(paragraph){const auto& stops=word?paragraph->words:paragraph->characters;
        if(forward){const auto after=std::upper_bound(stops.begin(),stops.end(),at);return after==stops.end()?int32_t(text.size()):int32_t(*after);}
        const auto before=std::lower_bound(stops.begin(),stops.end(),at);return before==stops.begin()?0:int32_t(*std::prev(before));}
      auto next=std::clamp(at+(forward?1:-1),0,int32_t(text.size()));while(!textBoundary(text,next))next+=forward?1:-1;return next;
    };
    if (control && (key == 'Z' || key == 'Y'))
      kind = key == 'Y' || shift ? wire::editKinds::redo : wire::editKinds::undo;
    else if (control && key == 'A') {
      base = 0;
      extent = int32_t(text.size());
    } else if(key==VK_UP||key==VK_DOWN){
      if(!paragraph||!snapshot->frame.scene->document->contains(d.node))return true;
      const auto& n=snapshot->frame.scene->document->get(d.node);
      if(!n.textGeometry||n.textGeometry->revision!=e->revision)return true;
      const auto& caret=n.textGeometry->caret;
      const auto hit=skia_core::ParagraphQuerySource::hit(paragraph->ticket,prepared->context.get(),paragraph->identity,
        float(caret.x-n.contentX),float(caret.y-n.contentY+caret.height/2+(key==VK_UP?-1:1)*std::max(1.0,caret.height)));
      if(!hit)return true;extent=int32_t(hit->position);if(!shift)base=extent;
    } else if (key == VK_LEFT || key == VK_RIGHT || key == VK_HOME || key == VK_END) {
      if (key == VK_HOME)
        {extent=0;if(!control&&paragraph){auto line=std::upper_bound(paragraph->lines.begin(),paragraph->lines.end(),e->extent);if(line!=paragraph->lines.begin())extent=*std::prev(line);}}
      else if (key == VK_END)
        {extent=int32_t(text.size());if(!control&&paragraph){const auto line=std::upper_bound(paragraph->lines.begin(),paragraph->lines.end(),e->extent);if(line!=paragraph->lines.end())extent=*line;
          while(extent>0&&(text[size_t(extent-1)]==u'\n'||text[size_t(extent-1)]==u'\r'))--extent;}}
      else if (!shift && base != extent)
        extent = key == VK_LEFT ? start : end;
      else {
        extent=boundary(extent,key==VK_RIGHT,control);
      }
      if (!shift)
        base = extent;
    } else if (key == VK_BACK || key == VK_DELETE || key == VK_RETURN ||
               control && (key == 'C' || key == 'X' || key == 'V')) {
      if (control && (key == 'C' || key == 'X')) {
        if (d.flags & wire::editFlags::password)
          return true;
        if (start == end)
          return true;
        if (OpenClipboard(window)) {
          EmptyClipboard();
          const auto selected = wide(text.substr(start, end - start));
          auto memory = GlobalAlloc(GMEM_MOVEABLE, (selected.size() + 1) * sizeof(wchar_t));
          if (memory) {
            auto target = GlobalLock(memory);
            std::memcpy(target, selected.c_str(), (selected.size() + 1) * sizeof(wchar_t));
            GlobalUnlock(memory);
            if (!SetClipboardData(CF_UNICODETEXT, memory))
              GlobalFree(memory);
          }
          CloseClipboard();
        }
        if (key == 'C')
          return true;
      }
      std::u16string insert;
      if (control && key == 'V') {
        if (OpenClipboard(window)) {
          auto memory = GetClipboardData(CF_UNICODETEXT);
          if (memory) {
            const auto source = static_cast<const wchar_t *>(GlobalLock(memory));
            if (source) {
              const auto max = std::min<size_t>(GlobalSize(memory) / sizeof(wchar_t),
                                                wire::limits::textBytes + 1);
              size_t length = 0;
              while (length < max && source[length])
                ++length;
              if (length < max)
                insert.assign(reinterpret_cast<const char16_t *>(source), length);
              GlobalUnlock(memory);
            }
          }
          CloseClipboard();
        }
      } else if (key == VK_RETURN) {
        if (!(d.flags & wire::editFlags::multiline))
          return true;
        insert = u"\n";
      }
      int32_t a = start, b = end;
      if (a == b && key == VK_BACK && a) {
        a=boundary(a,false,control);
      }
      if (a == b && key == VK_DELETE && size_t(b) < text.size()) {
        b=boundary(b,true,control);
      }
      text.replace(size_t(a), size_t(b - a), insert);
      base = extent = a + int32_t(insert.size());
      kind = wire::editKinds::replace;
    } else if (key == VK_TAB) {
      return false;
    } else
      return false;
    edit(d.node, kind, text, base, extent);
    wake();
    sync();
    return true;
  }
  void close() {
    if (closed)
      return;
    closed = true;
    context.reset();
    editors->close();
    semantics->close();
    snapshot.reset();
    documents.clear();
    forced.clear();
  }
};
} // namespace nelyx::v2::windows
