// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include "../layout/list.hpp"
#include "../interaction/controls.hpp"
#include "geometry.hpp"
#include "../layout/program.hpp"
#include "paragraph.hpp"
#include "font_catalog.hpp"
#include "clip.hpp"
#include "native_paint.hpp"
#include "image.hpp"
#include "snapshot.hpp"
#include <array>
#include <memory>
#include <atomic>
#include <string>

namespace nelyx::v2 {
struct EditingValue;
struct TextGeometry;
struct SemanticData;
struct ResourceStorage {
  Lease lease;
  std::vector<uint8_t> bytes;
  ResourceStorage(const std::shared_ptr<Ledger>& ledger,size_t size)
    :lease(ledger,size+sizeof(ResourceStorage),true),bytes(size){}
  ResourceStorage(const std::shared_ptr<Ledger>& ledger,Reader data):ResourceStorage(ledger,data.length){
    std::copy_n(data.data,data.length,bytes.data());
  }
};
struct Resource {
  Lease lease;
  Handle id;
  std::shared_ptr<const ResourceStorage> storage;
  const std::vector<uint8_t>& bytes;
  bool fontCatalog=false;
  Resource(const std::shared_ptr<Ledger>& ledger, Handle h, Reader data)
      : lease(ledger, sizeof(Resource), true), id(h),storage(std::make_shared<ResourceStorage>(ledger,data)),bytes(storage->bytes) {}
  Resource(const std::shared_ptr<Ledger>& ledger,Handle h,std::shared_ptr<const ResourceStorage> value,bool font=true)
    :lease(ledger,sizeof(Resource),true),id(h),storage(std::move(value)),bytes(storage->bytes),fontCatalog(font){}
};
struct Properties {
  double x = 0, y = 0, width = 0, height = 0, opacity = 1;
  double minimum = 0, maximum = 0;
  uint32_t extent = wire::extents::finite, flags = 0;
  bool operator==(const Properties&) const = default;
};
struct Motion {
  uint64_t id = 0, baseRevision = 0;
  double target = 1, seconds = 0;
};
struct LayoutStyle {
  uint32_t enabled = 0, direction = 0, mainSize = 0, mainAlign = 0, crossAlign = 0, fit = 0, columns = 2, constraintFlags = 0;
  double flex = 0, gap = 0, runGap = 0, left = 0, top = 0, right = 0, bottom = 0;
  double alignmentX = 0, alignmentY = 0, widthFactor = -1, heightFactor = -1;
  double inlineScale = 1;
  uint32_t runAlign = 0, textBaseline = 0, positionedFlags = 0, overflowClipBehavior = 0;
  std::array<double,6> positioned{};
  bool operator==(const LayoutStyle&) const = default;
};
struct Coverage { uint64_t revision = 0; double minimum = 0, maximum = 0; bool enabled = false; };
struct TextData {
  Lease lease;
  std::string value;
  TextData(const std::shared_ptr<Ledger>& owner, Reader data)
    : lease(owner, sizeof(TextData) + data.length),
      value(reinterpret_cast<const char*>(data.data), data.length) {}
};
struct LayerLinkStyle {
  uint32_t role=0;bool showWhenUnlinked=false;
  Handle leader;
  Point offset,leaderAnchor,followerAnchor;
};
struct TapRegionStyle {
  uint32_t flags=0,group=0;
  Handle surface;
  uint64_t revision=0;
};
struct TooltipPositionStyle {
  Handle target;
  double verticalOffset=0,margin=10;
  bool preferBelow=true;
};
struct LayoutBuilderStyle {
  uint64_t revision=0,builtRevision=0;
  Axis horizontal,vertical;
};
struct IntrinsicSizingStyle {
  double minimumHeight=0,minimumWidthPerHeight=0;
  bool expandReportedWidth=false;
};
struct Node {
  Lease lease;
  Handle id, parent, paintOwner;
  uint32_t kind = 0, order = 0, policy = 0;
  uint32_t gestureDevices=63;
  Properties properties;
  GraphicsStyle graphics;
  LayerLinkStyle layerLink;
  TapRegionStyle tapRegion;
  std::optional<TooltipPositionStyle> tooltipPosition;
  std::optional<std::array<double,6>> childAnchor;
  std::optional<IntrinsicSizingStyle> intrinsicSizing;
  std::optional<LayoutBuilderStyle> layoutBuilder;
  std::optional<ClipStyle> clipStyle;
  std::optional<ImageStyle> imageStyle;
  std::optional<SnapshotStyle> snapshot;
  std::shared_ptr<const ImagePaint> imagePaint;
  std::shared_ptr<const NativePaint> nativePaint,resolvedPaint;
  std::shared_ptr<const PaintPlacement> paintPlacement;
  Affine paintTransform,layoutTransform;
  std::shared_ptr<const LayoutPaintValues> layoutPaintValues;
  const NativePaintEntry* physicalPaint()const {
    if(resolvedPaint)for(const auto& entry:resolvedPaint->entries)if(entry.kind==1)return &entry;
    return nullptr;
  }
  Point extensionSize;
  std::shared_ptr<const LayoutProgram> layoutProgram;
  Axis horizontal, vertical;
  Motion motion;
  LayoutStyle layout;
  Coverage coverage;
  ListStyle list;
  ListItem item;
  uint32_t gestures=0;
  ControlStyle control;
  std::shared_ptr<const ListGeometry> listGeometry;
  uint64_t layoutRevision = 0;
  // Direct transaction edits, excluding ancestor layout invalidation.
  uint64_t configurationRevision = 0;
  double baseline = -1;
  double contentX = 0, contentY = 0, contentWidth = 0, contentHeight = 0;
  bool contentOverflow = false;
  bool contentOverflowX = false;
  double overflowProbeWidth=0,overflowProbeHeight=0;
  bool paintBoundedWidth = true, paintBoundedHeight = true;
  bool inlineHidden = false;
  uint64_t editSerial=0;
  uint32_t editFlags=0,maximumLength=wire::limits::textBytes;
  struct EditorViewport { bool enabled=false,expands=false;uint32_t minimumLines=0,maximumLines=0; } editorViewport;
  double editorScrollOffset=0;
  std::shared_ptr<const EditingValue> editing;
  std::shared_ptr<const TextGeometry> textGeometry;
  std::shared_ptr<const SemanticData> semantics;
  uint32_t color = 0;
  uint32_t textDirection = 0;
  double radius = 0, fontSize = 18;
  std::shared_ptr<const TextData> text;
  std::shared_ptr<const ParagraphData> paragraph;
  std::shared_ptr<const Resource> resource;
  std::shared_ptr<const Resource> fontResource;
  uint64_t fontRevision=1;
  bool fontPinned=false;
  explicit Node(const std::shared_ptr<Ledger>& ledger) : lease(ledger, sizeof(Node)) {
    ++lease.ledger->nodes;
  }
  Node(const Node& n) : lease(n.lease.ledger, sizeof(Node)), id(n.id), parent(n.parent), paintOwner(n.paintOwner),
      kind(n.kind), order(n.order), policy(n.policy), gestureDevices(n.gestureDevices), properties(n.properties), graphics(n.graphics),layerLink(n.layerLink),tapRegion(n.tapRegion),tooltipPosition(n.tooltipPosition),childAnchor(n.childAnchor),intrinsicSizing(n.intrinsicSizing),layoutBuilder(n.layoutBuilder),clipStyle(n.clipStyle),imageStyle(n.imageStyle),snapshot(n.snapshot),imagePaint(n.imagePaint),nativePaint(n.nativePaint),resolvedPaint(n.resolvedPaint),paintPlacement(n.paintPlacement),paintTransform(n.paintTransform),layoutTransform(n.layoutTransform),layoutPaintValues(n.layoutPaintValues),extensionSize(n.extensionSize),
      layoutProgram(n.layoutProgram),horizontal(n.horizontal), vertical(n.vertical), motion(n.motion), layout(n.layout), coverage(n.coverage),
      list(n.list), item(n.item), gestures(n.gestures), control(n.control), listGeometry(n.listGeometry),
      layoutRevision(n.layoutRevision), configurationRevision(n.configurationRevision), baseline(n.baseline), contentX(n.contentX), contentY(n.contentY),
      contentWidth(n.contentWidth), contentHeight(n.contentHeight), contentOverflow(n.contentOverflow), contentOverflowX(n.contentOverflowX),overflowProbeWidth(n.overflowProbeWidth),overflowProbeHeight(n.overflowProbeHeight),paintBoundedWidth(n.paintBoundedWidth), paintBoundedHeight(n.paintBoundedHeight), inlineHidden(n.inlineHidden), editSerial(n.editSerial),editFlags(n.editFlags),maximumLength(n.maximumLength),
      editorViewport(n.editorViewport),editorScrollOffset(n.editorScrollOffset),editing(n.editing),textGeometry(n.textGeometry),semantics(n.semantics),color(n.color), textDirection(n.textDirection), radius(n.radius),
      fontSize(n.fontSize), text(n.text), paragraph(n.paragraph), resource(n.resource),fontResource(n.fontResource),fontRevision(n.fontRevision),fontPinned(n.fontPinned) {
    ++lease.ledger->nodes;
  }
  ~Node() { --lease.ledger->nodes; }
};
inline Point layerOffset(const Node& node,const Node& leader) {
  const auto& link=node.layerLink;const auto& source=leader.properties;
  return {(link.leaderAnchor.x+1)*source.width/2-(link.followerAnchor.x+1)*node.properties.width/2+link.offset.x,
    (link.leaderAnchor.y+1)*source.height/2-(link.followerAnchor.y+1)*node.properties.height/2+link.offset.y};
}
inline Affine nodeTransform(const Node& node,Affine parent,const Node* leader=nullptr,const Affine* leaderWorld=nullptr,const Affine* paintTransform=nullptr) {
  const auto local=node.graphics.effective(node.properties.width,node.properties.height);
  const auto& link=node.layerLink;
  if(link.role==2&&leader&&leaderWorld&&parent.inverse()){
    const auto offset=layerOffset(node,*leader);
    return *leaderWorld*Affine{1,0,0,1,offset.x,offset.y}*local;
  }
  return parent*Affine{1,0,0,1,node.properties.x,node.properties.y}*node.layoutTransform*(paintTransform?*paintTransform:node.paintTransform)*local;
}
inline Affine childTransform(const Node& node,Affine world) {
  return (node.layout.constraintFlags&wire::layoutConstraintFlags::inlineScale)?
    world*Affine{node.layout.inlineScale,0,0,node.layout.inlineScale,0,0}:world;
}
template<class T> struct Slot {
  uint32_t generation = 1;
  std::shared_ptr<const T> value;
};
struct Document {
  Lease lease;
  uint64_t epoch = 0;
  uint32_t count = 0;
  uint32_t highWater = 0;
  bool framePaintGeometry=false;
  std::vector<Slot<Node>> nodes;
  std::vector<std::vector<Handle>> children;
  explicit Document(const std::shared_ptr<Ledger>& ledger)
      : lease(ledger, sizeof(Document) + (wire::limits::nodes + 1) *
          (sizeof(Slot<Node>) + sizeof(std::vector<Handle>) + 4 * sizeof(Handle))),
        nodes(wire::limits::nodes + 1), children(wire::limits::nodes + 1) {}
  Document(const Document& d) : lease(d.lease.ledger, d.lease.bytes),
      epoch(d.epoch), count(d.count), highWater(d.highWater), framePaintGeometry(d.framePaintGeometry), nodes(d.nodes), children(d.children) {}
  const Node& get(Handle h) const {
    require(h.slot > 0 && h.slot < nodes.size() && nodes[h.slot].value &&
      nodes[h.slot].value->id == h, wire::statuses::invalidHandle);
    return *nodes[h.slot].value;
  }
  bool contains(Handle h) const {
    return h.slot > 0 && h.slot < nodes.size() && nodes[h.slot].value &&
      nodes[h.slot].value->id == h;
  }
  bool descends(Handle child,Handle ancestor) const {
    for(uint32_t depth=0;child&&depth<=wire::limits::depth;++depth){if(child==ancestor)return true;
      if(!contains(child))return false;child=get(child).parent;}
    return false;
  }
};
using Resources = std::array<Slot<Resource>, wire::limits::resources + 1>;
/** Resolve inherited fonts in a preparation/query snapshot. Accepted App input
 * and older recordings remain immutable and keep their own resource holders. */
inline std::shared_ptr<const Document> fontDocument(std::shared_ptr<const Document> source,
    const std::shared_ptr<const Resource>& resource,uint64_t revision){
  std::shared_ptr<Document> derived;
  for(const auto& slot:source->nodes){if(!slot.value)continue;const auto& node=*slot.value;
    if((node.kind!=wire::kinds::paragraph&&node.kind!=wire::kinds::editable)||node.fontPinned||
        (node.fontRevision==revision&&node.fontResource==resource))continue;
    if(!derived)derived=std::make_shared<Document>(*source);
    auto copy=std::make_shared<Node>(node);copy->fontResource=resource;copy->fontRevision=revision;
    derived->nodes[node.id.slot].value=std::move(copy);
  }
  return derived?std::shared_ptr<const Document>(std::move(derived)):source;
}
Handle canonicalFocusOwner(const Document&,Handle);
Handle canonicalFocusPeer(const Document&,Handle);
struct Installed {
  std::shared_ptr<const Document> document;
  Resources resources;
};
Installed transact(const std::shared_ptr<const Document>&, const Resources&, Reader, uint32_t);
void validateGraphics(const Document&);
}
