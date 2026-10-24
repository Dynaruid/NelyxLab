// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
#pragma once
#include <string>
#include <unordered_map>
namespace RNSkia {
inline const char* linuxMouseCursor(const std::string& kind) {
  static const std::unordered_map<std::string,const char*> names={
    {"alias","alias"},
    {"allScroll","all-scroll"},
    {"basic","default"},
    {"cell","cell"},
    {"click","pointer"},
    {"contextMenu","context-menu"},
    {"copy","copy"},
    {"forbidden","not-allowed"},
    {"grab","grab"},
    {"grabbing","grabbing"},
    {"help","help"},
    {"move","move"},
    {"none","none"},
    {"noDrop","no-drop"},
    {"precise","crosshair"},
    {"progress","progress"},
    {"text","text"},
    {"resizeColumn","col-resize"},
    {"resizeDown","s-resize"},
    {"resizeDownLeft","sw-resize"},
    {"resizeDownRight","se-resize"},
    {"resizeLeft","w-resize"},
    {"resizeLeftRight","ew-resize"},
    {"resizeRight","e-resize"},
    {"resizeRow","row-resize"},
    {"resizeUp","n-resize"},
    {"resizeUpDown","ns-resize"},
    {"resizeUpLeft","nw-resize"},
    {"resizeUpRight","ne-resize"},
    {"resizeUpLeftDownRight","nwse-resize"},
    {"resizeUpRightDownLeft","nesw-resize"},
    {"verticalText","vertical-text"},
    {"wait","wait"},
    {"zoomIn","zoom-in"},
    {"zoomOut","zoom-out"}
  };
  const auto found=names.find(kind);return found==names.end()?"default":found->second;
}
}
