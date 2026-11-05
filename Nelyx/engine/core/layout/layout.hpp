// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../scene/document.hpp"
#include <optional>

namespace nelyx::v2 {
struct LayoutConstraints {
  double minWidth = 0, maxWidth = INFINITY, minHeight = 0, maxHeight = INFINITY;
  bool operator==(const LayoutConstraints &) const = default;
};
struct LayoutBox;
struct Placement {
  std::shared_ptr<const LayoutBox> box;
  double x = 0, y = 0;
};
struct LayoutBox {
  Lease lease;
  Handle node;
  uint64_t revision;
  uint64_t editSerial;
  LayoutConstraints input;
  double width = 0, height = 0, baseline = -1;
  std::shared_ptr<const TextGeometry> textGeometry;
  std::shared_ptr<const ListGeometry> listGeometry;
  std::vector<Placement> children;
  LayoutBox(const Node &n, LayoutConstraints constraints, size_t count)
      : lease(n.lease.ledger, sizeof(LayoutBox) + count * sizeof(Placement)), node(n.id),
        revision(n.layoutRevision), editSerial(n.editSerial), input(constraints), children(count) {}
};
struct MeasurementRequest {
  uint64_t id = 0;
  std::shared_ptr<const Node> node;
  double width = 0;
  bool bounded = false;
  uint64_t preparation = 0;
};
struct Measurement {
  double width = 0, height = 0, minimum = 0, maximum = 0, baseline = -1;
  std::shared_ptr<const TextGeometry> geometry = nullptr;
};
struct LayoutOutput {
  Lease lease;
  double scale;
  uint64_t fontRevision;
  std::vector<std::shared_ptr<const LayoutBox>> boxes;
  LayoutOutput(const std::shared_ptr<Ledger> &ledger, double dpi, uint64_t font)
      : lease(ledger, sizeof(LayoutOutput) + (wire::limits::nodes + 1) * sizeof(boxes[0])),
        scale(dpi), fontRevision(font), boxes(wire::limits::nodes + 1) {}
};
// This continuation never calls an App callback or a provider. Each step does
// finite tree work and returns while a versioned measurement is outstanding.
class LayoutWork {
public:
  LayoutWork(std::shared_ptr<const Document>, double width, double height, double scale,
             uint64_t font, std::shared_ptr<const LayoutOutput> previous);
  LayoutWork(std::shared_ptr<const Document>, Handle root, LayoutConstraints, double scale,
             uint64_t font);
  ~LayoutWork();
  bool step(uint32_t quota);
  bool waiting() const;
  const std::optional<MeasurementRequest> &request() const;
  void measured(uint64_t id, Handle node, Measurement result);
  std::shared_ptr<const Document> document() const;
  std::shared_ptr<const LayoutOutput> output() const;
  uint64_t work() const;
  uint64_t reused() const;

private:
  struct State;
  std::unique_ptr<State> state_;
};
} // namespace nelyx::v2
