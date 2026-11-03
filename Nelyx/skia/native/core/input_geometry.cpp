// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx_skia/input_geometry.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <chrono>
#include <limits>
#include <stdexcept>

// Geometry must preserve the TS accumulation order, including zero terms.
#if defined(_MSC_VER)
#pragma float_control(precise, on, push)
#pragma fp_contract(off)
#elif defined(__clang__)
#pragma clang fp contract(off)
#endif

namespace nelyx::input_geometry {
namespace {
constexpr double maxInteger = 9007199254740991.0;
[[noreturn]] void reject() { throw std::invalid_argument("Invalid input-geometry v1 packet/owner/budget"); }
bool integer(double x, double low, double high) {
  return std::isfinite(x) && x >= low && x <= high && std::floor(x) == x;
}
std::size_t count(double x, std::size_t high) {
  if (!integer(x, 0, static_cast<double>(high))) reject();
  return static_cast<std::size_t>(x);
}
void ownerValid(Owner owner) {
  if (!integer(owner.session, 1, maxInteger) || !integer(owner.generation, 0, maxInteger)) reject();
}
struct Rect { double x, y, w, h; };
Rect rect(const double* p) { return {p[0], p[1], p[2], p[3]}; }
bool finite(Rect r) {
  return std::isfinite(r.x) && std::isfinite(r.y) && std::isfinite(r.w) && std::isfinite(r.h);
}
void validRect(const double* p) {
  if (!finite(rect(p)) || p[2] < 0 || p[3] < 0) reject();
}
// std::min/max do not propagate NaN like Math.min/max.
double minimum(double a, double b) { return std::isnan(a) || std::isnan(b) ? std::numeric_limits<double>::quiet_NaN() : std::min(a, b); }
double maximum(double a, double b) { return std::isnan(a) || std::isnan(b) ? std::numeric_limits<double>::quiet_NaN() : std::max(a, b); }
Rect intersect(Rect a, Rect b) {
  const auto x = maximum(a.x, b.x), y = maximum(a.y, b.y);
  return {x, y, maximum(0, minimum(a.x + a.w, b.x + b.w) - x),
                maximum(0, minimum(a.y + a.h, b.y + b.h) - y)};
}
struct Matrix {
  std::array<double, 16> v{};
  bool affine = true;
  bool owned = true;
};
Matrix identity() { return {{{1, 0, 0, 1, 0, 0}}, true}; }
Matrix full(Matrix a) {
  if (!a.affine) return a;
  const auto& v = a.v;
  return {{{v[0], v[1], 0, 0, v[2], v[3], 0, 0, 0, 0, 1, 0, v[4], v[5], 0, 1}}, false};
}
Matrix multiply(Matrix a, Matrix b, bool requireFinite = true) {
  Matrix out;
  if (a.affine && b.affine) {
    out.owned = a.owned && b.owned;
    const auto& x = a.v; const auto& y = b.v;
    out.v = {x[0]*y[0]+x[2]*y[1], x[1]*y[0]+x[3]*y[1],
             x[0]*y[2]+x[2]*y[3], x[1]*y[2]+x[3]*y[3],
             x[0]*y[4]+x[2]*y[5]+x[4], x[1]*y[4]+x[3]*y[5]+x[5]};
  } else {
    a = full(a); b = full(b); out.affine = false;
    for (std::size_t column = 0; column < 16; column += 4)
      for (std::size_t row = 0; row < 4; ++row)
        out.v[column+row] = 0.0 + a.v[row]*b.v[column] + a.v[row+4]*b.v[column+1]
                                   + a.v[row+8]*b.v[column+2] + a.v[row+12]*b.v[column+3];
  }
  for (std::size_t i = 0; i < (out.affine ? 6u : 16u); ++i)
    if (requireFinite && !std::isfinite(out.v[i])) throw std::invalid_argument("Nonfinite input-geometry transform product");
  return out;
}
Rect bounds(Matrix m, double width, double height) {
  const auto& v = m.v;
  const auto a = v[0], b = v[1], c = v[m.affine ? 2 : 4], d = v[m.affine ? 3 : 5],
             tx = v[m.affine ? 4 : 12], ty = v[m.affine ? 5 : 13];
  double x0 = a*0.0+c*0.0+tx, y0 = b*0.0+d*0.0+ty,
         x1 = a*width+c*0.0+tx, y1 = b*width+d*0.0+ty,
         x2 = a*0.0+c*height+tx, y2 = b*0.0+d*height+ty,
         x3 = a*width+c*height+tx, y3 = b*width+d*height+ty;
  if (!m.affine) {
    const auto w0 = v[15], w1 = v[3]*width+v[15], w2 = v[7]*height+v[15],
               w3 = v[3]*width+v[7]*height+v[15];
    if (minimum(minimum(w0,w1),minimum(w2,w3)) <= 0 && maximum(maximum(w0,w1),maximum(w2,w3)) >= 0) {
      const auto nan = std::numeric_limits<double>::quiet_NaN(); return {nan,nan,nan,nan};
    }
    const auto q0 = v[3]*0.0+v[7]*0.0+v[15], q1 = v[3]*width+v[7]*0.0+v[15],
               q2 = v[3]*0.0+v[7]*height+v[15];
    if (q0 != 1) { x0 /= q0; y0 /= q0; }
    if (q1 != 1) { x1 /= q1; y1 /= q1; }
    if (q2 != 1) { x2 /= q2; y2 /= q2; }
    if (w3 != 1) { x3 /= w3; y3 /= w3; }
  }
  const auto x = minimum(minimum(x0,x1),minimum(x2,x3)), y = minimum(minimum(y0,y1),minimum(y2,y3));
  return {x,y,maximum(maximum(x0,x1),maximum(x2,x3))-x,maximum(maximum(y0,y1),maximum(y2,y3))-y};
}
Rect project(Matrix m, Rect r) {
  if (m.affine && !m.owned) m=full(m);
  auto translation = identity(); translation.v[4] = r.x; translation.v[5] = r.y;
  return bounds(multiply(m,translation,!m.affine),r.w,r.h);
}
void write(double* p, Rect r) { p[0]=r.x; p[1]=r.y; p[2]=r.w; p[3]=r.h; }
}

std::vector<double> evaluate(std::span<const double> p, Owner owner) {
  const bool timing=p.size()>14 && p[14]==1;
  const auto began=timing ? std::chrono::steady_clock::now() : std::chrono::steady_clock::time_point{};
  ownerValid(owner);
  if (p.size() < headerWords || p.size() > maxBytes/sizeof(double) || p[0] != magic || p[1] != version ||
      p[2] != owner.session || p[3] != owner.generation || !integer(p[4],1,maxInteger) ||
      !integer(p[5],0,maxInteger) || !integer(p[6],-1,maxInteger) ||
      !std::isfinite(p[7]) || p[7] <= 0 || !std::isfinite(p[8]) || p[8] < 0 ||
      !std::isfinite(p[9]) || p[9] < 0 || p[13] != p.size() || (p[14] != 0 && p[14] != 1) || p[15] != 0) reject();
  const auto nodes = count(p[10],maxNodes), editors = count(p[11],maxEditors), selections = count(p[12],maxSelections);
  const auto editorAt = headerWords+nodes*nodeWords, selectionAt = editorAt+editors*editorWords;
  if (p.size() != selectionAt+selections*4 || (editors && !nodes)) reject();
  std::vector<std::size_t> depths(nodes);
  for (std::size_t i = 0; i < nodes; ++i) {
    const auto* n = p.data()+headerWords+i*nodeWords;
    if (!integer(n[0],-1,static_cast<double>(i)-1) || (n[1] != 6 && n[1] != 16) ||
        (n[18] != 0 && n[18] != 1) || (n[23] != 0 && n[23] != 1) || (n[0] == -1 && n[18] != 0)) reject();
    depths[i] = n[0] == -1 ? 1 : depths[static_cast<std::size_t>(n[0])]+1;
    if (depths[i] > maxDepth) reject();
    for (std::size_t j=0; j<16; ++j)
      if (!std::isfinite(n[2+j]) || (n[1] == 6 && j>=6 && n[2+j] != 0)) reject();
    validRect(n+19);
    if (n[18] == 0 && (n[19] != 0 || n[20] != 0 || n[21] != 0 || n[22] != 0)) reject();
  }
  std::size_t nextSelection = 0;
  for (std::size_t i=0; i<editors; ++i) {
    const auto* e = p.data()+editorAt+i*editorWords;
    if (!integer(e[0],0,static_cast<double>(nodes)-1) || !integer(e[1],0,maxInteger) ||
        !std::isfinite(e[2]) || e[2]<0 || !std::isfinite(e[3]) || e[3]<0 ||
        !std::isfinite(e[8]) || !std::isfinite(e[9]) || e[10] != nextSelection) reject();
    validRect(e+4);
    nextSelection += count(e[11],maxEditorSelections);
    if (nextSelection > selections) reject();
  }
  if (nextSelection != selections) reject();
  for (std::size_t i=0; i<selections; ++i) validRect(p.data()+selectionAt+i*4);
  // No numeric work or externally visible state was applied before validation.
  const auto validated=timing ? std::chrono::steady_clock::now() : began;
  std::vector<Matrix> transforms(nodes);
  for (std::size_t i=0; i<nodes; ++i) {
    const auto* n=p.data()+headerWords+i*nodeWords;
    Matrix local; local.affine=n[1]==6; local.owned=n[23]==1; std::copy_n(n+2,16,local.v.begin());
    transforms[i]=n[0]==-1 ? multiply(local,identity()) : multiply(transforms[static_cast<std::size_t>(n[0])],local);
  }
  const auto outputSelectionAt=headerWords+editors*resultWords;
  std::vector<double> out(outputSelectionAt+selections*4,0);
  std::copy_n(p.begin(),headerWords,out.begin()); out[0]=resultMagic; out[13]=static_cast<double>(out.size());
  for (std::size_t i=0; i<editors; ++i) {
    const auto* e=p.data()+editorAt+i*editorWords;
    auto* r=out.data()+headerWords+i*resultWords;
    const auto node=static_cast<std::size_t>(e[0]), start=static_cast<std::size_t>(e[10]), length=static_cast<std::size_t>(e[11]);
    r[1]=static_cast<double>(i); r[2]=e[1]; r[33]=e[10]; r[34]=e[11];
    const auto matrix=transforms[node], complete=full(matrix);
    const auto fullBounds=project(matrix,{0,0,e[2],e[3]});
    auto clip=intersect(fullBounds,{0,0,p[8],p[9]});
    bool empty=clip.w==0 || clip.h==0;
    for (auto child=node; !empty;) {
      const auto* n=p.data()+headerWords+child*nodeWords;
      if (n[0]==-1) break;
      const auto parent=static_cast<std::size_t>(n[0]);
      if (n[18]==1) clip=intersect(clip,project(transforms[parent],rect(n+19)));
      empty=clip.w==0 || clip.h==0; child=parent;
    }
    if (empty) continue;
    const auto caret=project(matrix,rect(e+4));
    const auto& v=complete.v;
    auto bx=v[0]*e[8]+v[4]*e[9]+v[12], by=v[1]*e[8]+v[5]*e[9]+v[13];
    const auto bw=v[3]*e[8]+v[7]*e[9]+v[15];
    if (bw!=1) { bx/=bw; by/=bw; }
    bool valid=finite(fullBounds)&&finite(clip)&&finite(caret)&&std::isfinite(bx)&&std::isfinite(by);
    for (std::size_t s=0; s<length; ++s) {
      const auto selection=project(matrix,rect(p.data()+selectionAt+(start+s)*4));
      valid=valid&&finite(selection); write(out.data()+outputSelectionAt+(start+s)*4,selection);
    }
    if (!valid) { std::fill_n(out.data()+outputSelectionAt+start*4,length*4,0); continue; }
    r[0]=1; std::copy(complete.v.begin(),complete.v.end(),r+3);
    write(r+19,fullBounds); write(r+23,clip); write(r+27,caret); r[31]=bx; r[32]=by;
  }
  if (timing) {
    out[14]=std::chrono::duration<double,std::milli>(validated-began).count();
    out[15]=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-validated).count();
  }
  return out;
}
Session::Session(Owner owner) : owner_(owner) { ownerValid(owner); }
std::vector<double> Session::evaluate(std::span<const double> packet) {
  if (closed_) throw std::runtime_error("Input-geometry session closed");
  if (packet.size()<headerWords || packet[4]<=revision_) throw std::invalid_argument("Stale input-geometry transaction");
  auto result=input_geometry::evaluate(packet,owner_); revision_=packet[4]; return result;
}
}

namespace nelyx::input_geometry {
struct RetainedSession::State {
  struct Node {
    bool live = false, clipped = false;
    std::uint64_t generation = 0, parentGeneration = 0;
    int parent = -1;
    Matrix local, world;
    Rect clip{}, projectedClip{};
    double localRevision = 0, resolvedLocal = -1, resolvedParent = -1,
      worldRevision = 0, visited = -1, clipLocal = -1, clipParent = -1;
  };
  Owner owner;
  double revision = 0, pending = 0, attempt = 0;
  bool changed = false;
  std::vector<Node> committed, staged;
  std::size_t live = 0, pendingLive = 0, peak = 0, upserts = 0,
    worlds = 0, clips = 0;
  explicit State(Owner value) : owner(value), committed(retained::maxNodes) {}
  std::size_t bytes() const {
    return sizeof(State) + (committed.capacity()+staged.capacity())*sizeof(Node);
  }
};
namespace {
struct NumericHandle { std::size_t slot; std::uint64_t generation; };
NumericHandle numericHandle(double value) {
  if (!integer(value, static_cast<double>(retained::maxNodes), maxInteger)) reject();
  const auto handle=static_cast<std::uint64_t>(value);
  return {static_cast<std::size_t>(handle%retained::maxNodes),handle/retained::maxNodes};
}
}
RetainedSession::RetainedSession(Owner owner) {
  ownerValid(owner); state_=std::make_unique<State>(owner);
}
RetainedSession::~RetainedSession() = default;
bool RetainedSession::current(double revision) const noexcept {
  return state_ && state_->pending==revision && revision>0;
}
std::size_t RetainedSession::retainedBytes() const noexcept {
  return state_ ? state_->bytes() : 0;
}
void RetainedSession::close() noexcept { state_.reset(); }
void RetainedSession::commit(double revision) {
  if (!current(revision)) throw std::invalid_argument("Stale retained-geometry commit");
  auto& s=*state_;
  if (s.changed) s.committed.swap(s.staged);
  s.staged.clear(); s.live=s.pendingLive; s.revision=revision; s.pending=0;
}
void RetainedSession::discard(double revision) {
  if (!current(revision)) throw std::invalid_argument("Stale retained-geometry discard");
  state_->staged.clear(); state_->pending=0;
}
std::vector<double> RetainedSession::stats() const {
  if (!state_) return {0,0,0,0,0,1,0,0,0,0};
  const auto& s=*state_;
  return {double(s.live),s.pending ? double(s.pendingLive) : 0,double(s.bytes()),
    double(s.peak),s.revision,0,s.pending,double(s.upserts),double(s.worlds),double(s.clips)};
}
std::vector<double> RetainedSession::prepare(std::span<const double> p) {
  if (!state_) throw std::runtime_error("Retained geometry session closed");
  auto& s=*state_;
  if (s.pending) throw std::runtime_error("Retained geometry already has a candidate");
  const bool timing=p.size()>14 && p[14]==1;
  const auto began=timing ? std::chrono::steady_clock::now() : std::chrono::steady_clock::time_point{};
  if (p.size()<retained::headerWords || p.size()>maxBytes/8 ||
      p[0]!=retained::magic || p[1]!=retained::version ||
      p[2]!=s.owner.session || p[3]!=s.owner.generation ||
      !integer(p[4],1,maxInteger) || p[4]<=s.revision || p[15]!=s.revision ||
      !integer(p[5],0,maxInteger) || !integer(p[6],-1,maxInteger) ||
      !std::isfinite(p[7]) || p[7]<=0 || !std::isfinite(p[8]) || p[8]<0 ||
      !std::isfinite(p[9]) || p[9]<0 || p[13]!=p.size() ||
      (p[14]!=0 && p[14]!=1) || p[18]!=0 || p[19]!=0) reject();
  const auto updates=count(p[10],retained::maxNodes), editors=count(p[11],retained::maxEditors),
    selections=count(p[12],retained::maxSelections), removals=count(p[16],retained::maxNodes),
    live=count(p[17],retained::maxNodes);
  const auto removeAt=retained::headerWords+updates*retained::nodeWords,
    editorAt=removeAt+removals, selectionAt=editorAt+editors*editorWords,
    outputAt=headerWords+editors*resultWords, outputWords=outputAt+selections*4;
  if (p.size()!=selectionAt+selections*4 || (editors && !live)) reject();
  // Reserve 512KiB for numeric TS metadata and its staging. Include
  // both VM/native input/output copies and worst-case staging capacity before
  // allocating. The existing per-snapshot limits remain smaller where relevant.
  const auto stateBytes=sizeof(State)+2*retained::maxNodes*sizeof(State::Node),
    peakBytes=stateBytes+2*(p.size()+outputWords)*sizeof(double)+512*1024;
  if (peakBytes>maxBytes) throw std::length_error("Retained geometry aggregate byte budget");
  s.changed=updates!=0 || removals!=0;
  if (s.changed) s.staged=s.committed;
  auto& nodes=s.changed ? s.staged : s.committed;
  try {
    std::array<bool,retained::maxNodes> removed{}, updated{};
    for (std::size_t i=0;i<removals;++i) {
      const auto h=numericHandle(p[removeAt+i]); auto& node=nodes[h.slot];
      if (removed[h.slot] || !node.live || node.generation!=h.generation) reject();
      removed[h.slot]=true; node.live=false;
    }
    for (std::size_t i=0;i<updates;++i) {
      const auto* input=p.data()+retained::headerWords+i*retained::nodeWords;
      const auto h=numericHandle(input[0]); auto& node=nodes[h.slot];
      if (updated[h.slot] || (node.live ? node.generation!=h.generation : h.generation!=node.generation+1)) reject();
      updated[h.slot]=true;
      const auto* n=input+1;
      if ((n[1]!=6 && n[1]!=16) || (n[18]!=0 && n[18]!=1) ||
          (n[23]!=0 && n[23]!=1) || (n[0]==-1 && n[18]!=0)) reject();
      for (std::size_t j=0;j<16;++j)
        if (!std::isfinite(n[2+j]) || (n[1]==6 && j>=6 && n[2+j]!=0)) reject();
      validRect(n+19);
      if (n[18]==0 && (n[19]!=0 || n[20]!=0 || n[21]!=0 || n[22]!=0)) reject();
      node.live=true; node.generation=h.generation; node.parent=-1; node.parentGeneration=0;
      if (n[0]!=-1) { const auto parent=numericHandle(n[0]); node.parent=int(parent.slot); node.parentGeneration=parent.generation; }
      node.local.affine=n[1]==6; node.local.owned=n[23]==1;
      std::copy_n(n+2,16,node.local.v.begin());
      node.clipped=n[18]==1; node.clip=rect(n+19); node.localRevision=p[4];
      node.visited=-1;
    }
    std::size_t actualLive=0;
    for (std::size_t i=0;i<nodes.size();++i) if (nodes[i].live) {
      ++actualLive; std::size_t depth=1;
      for (int parent=nodes[i].parent;parent>=0;parent=nodes[std::size_t(parent)].parent) {
        if (++depth>maxDepth || std::size_t(parent)>=nodes.size() || !nodes[std::size_t(parent)].live) reject();
      }
      if (nodes[i].parent>=0 && nodes[std::size_t(nodes[i].parent)].generation!=nodes[i].parentGeneration) reject();
    }
    if (actualLive!=live) reject();
    std::size_t nextSelection=0;
    for (std::size_t i=0;i<editors;++i) {
      const auto* e=p.data()+editorAt+i*editorWords; const auto h=numericHandle(e[0]);
      if (!nodes[h.slot].live || nodes[h.slot].generation!=h.generation ||
          !integer(e[1],0,maxInteger) || !std::isfinite(e[2]) || e[2]<0 ||
          !std::isfinite(e[3]) || e[3]<0 || !std::isfinite(e[8]) || !std::isfinite(e[9]) || e[10]!=nextSelection) reject();
      validRect(e+4); nextSelection+=count(e[11],maxEditorSelections);
      if (nextSelection>selections) reject();
    }
    if (nextSelection!=selections) reject();
    for (std::size_t i=0;i<selections;++i) validRect(p.data()+selectionAt+i*4);
    const auto validated=timing ? std::chrono::steady_clock::now() : began;
    if (s.attempt>=maxInteger) throw std::overflow_error("Retained geometry cache revision exhausted");
    const auto computation=++s.attempt;
    std::size_t worlds=0, clips=0;
    const auto resolve=[&](auto&& self,std::size_t index)->Matrix {
      auto& node=nodes[index];
      if (node.visited==computation) return node.world;
      double parentRevision=-1; Matrix parent;
      if (node.parent>=0) { parent=self(self,std::size_t(node.parent)); parentRevision=nodes[std::size_t(node.parent)].worldRevision; }
      if (node.resolvedLocal!=node.localRevision || node.resolvedParent!=parentRevision) {
        node.world=node.parent<0 ? multiply(node.local,identity()) : multiply(parent,node.local);
        node.worldRevision=computation; node.resolvedLocal=node.localRevision; node.resolvedParent=parentRevision; ++worlds;
      }
      node.visited=computation; return node.world;
    };
    std::vector<double> out(outputWords,0);
    std::copy_n(p.begin(),headerWords,out.begin()); out[0]=resultMagic; out[1]=version;
    out[10]=0; out[13]=double(outputWords); out[14]=out[15]=0;
    for (std::size_t i=0;i<editors;++i) {
      const auto* e=p.data()+editorAt+i*editorWords; auto* r=out.data()+headerWords+i*resultWords;
      const auto index=numericHandle(e[0]).slot, start=std::size_t(e[10]), length=std::size_t(e[11]);
      r[1]=double(i); r[2]=e[1]; r[33]=e[10]; r[34]=e[11];
      const auto matrix=resolve(resolve,index), complete=full(matrix);
      const auto fullBounds=project(matrix,{0,0,e[2],e[3]});
      auto clip=intersect(fullBounds,{0,0,p[8],p[9]}); bool empty=clip.w==0 || clip.h==0;
      for (auto child=index; !empty && nodes[child].parent>=0; child=std::size_t(nodes[child].parent)) {
        auto& edge=nodes[child];
        if (!edge.clipped) continue;
        const auto parent=std::size_t(edge.parent); resolve(resolve,parent);
        if (edge.clipLocal!=edge.localRevision || edge.clipParent!=nodes[parent].worldRevision) {
          edge.projectedClip=project(nodes[parent].world,edge.clip);
          edge.clipLocal=edge.localRevision; edge.clipParent=nodes[parent].worldRevision; ++clips;
        }
        clip=intersect(clip,edge.projectedClip); empty=clip.w==0 || clip.h==0;
      }
      if (empty) continue;
      const auto caret=project(matrix,rect(e+4)); const auto& v=complete.v;
      auto bx=v[0]*e[8]+v[4]*e[9]+v[12], by=v[1]*e[8]+v[5]*e[9]+v[13];
      const auto bw=v[3]*e[8]+v[7]*e[9]+v[15]; if (bw!=1) { bx/=bw; by/=bw; }
      bool valid=finite(fullBounds)&&finite(clip)&&finite(caret)&&std::isfinite(bx)&&std::isfinite(by);
      for (std::size_t n=0;n<length;++n) { const auto selection=project(matrix,rect(p.data()+selectionAt+(start+n)*4)); valid=valid&&finite(selection); write(out.data()+outputAt+(start+n)*4,selection); }
      if (!valid) { std::fill_n(out.data()+outputAt+start*4,length*4,0); continue; }
      r[0]=1; std::copy(complete.v.begin(),complete.v.end(),r+3); write(r+19,fullBounds); write(r+23,clip); write(r+27,caret); r[31]=bx; r[32]=by;
    }
    if (timing) { out[14]=std::chrono::duration<double,std::milli>(validated-began).count(); out[15]=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-validated).count(); }
    s.pending=p[4]; s.pendingLive=live; s.upserts=updates; s.worlds=worlds; s.clips=clips; s.peak=std::max(s.peak,peakBytes);
    return out;
  } catch (...) { s.staged.clear(); throw; }
}
}
#if defined(_MSC_VER)
#pragma float_control(pop)
#endif
