// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
package com.reactnative.skia;
import android.content.Context;
import android.view.PointerIcon;
final class SystemMouseCursor {
  private SystemMouseCursor() {}
  static PointerIcon resolve(Context context,String kind) {
    int type=switch(kind==null?"basic":kind) {
      case "alias" -> PointerIcon.TYPE_ALIAS;
      case "allScroll" -> PointerIcon.TYPE_ALL_SCROLL;
      case "basic" -> PointerIcon.TYPE_ARROW;
      case "cell" -> PointerIcon.TYPE_CELL;
      case "click" -> PointerIcon.TYPE_HAND;
      case "contextMenu" -> PointerIcon.TYPE_CONTEXT_MENU;
      case "copy" -> PointerIcon.TYPE_COPY;
      case "forbidden" -> PointerIcon.TYPE_NO_DROP;
      case "grab" -> PointerIcon.TYPE_GRAB;
      case "grabbing" -> PointerIcon.TYPE_GRABBING;
      case "help" -> PointerIcon.TYPE_HELP;
      case "move" -> PointerIcon.TYPE_ALL_SCROLL;
      case "none" -> PointerIcon.TYPE_NULL;
      case "noDrop" -> PointerIcon.TYPE_NO_DROP;
      case "precise" -> PointerIcon.TYPE_CROSSHAIR;
      case "text" -> PointerIcon.TYPE_TEXT;
      case "resizeColumn" -> PointerIcon.TYPE_HORIZONTAL_DOUBLE_ARROW;
      case "resizeDown" -> PointerIcon.TYPE_VERTICAL_DOUBLE_ARROW;
      case "resizeUpLeft" -> PointerIcon.TYPE_TOP_LEFT_DIAGONAL_DOUBLE_ARROW;
      case "resizeDownRight" -> PointerIcon.TYPE_TOP_LEFT_DIAGONAL_DOUBLE_ARROW;
      case "resizeLeft" -> PointerIcon.TYPE_HORIZONTAL_DOUBLE_ARROW;
      case "resizeLeftRight" -> PointerIcon.TYPE_HORIZONTAL_DOUBLE_ARROW;
      case "resizeRight" -> PointerIcon.TYPE_HORIZONTAL_DOUBLE_ARROW;
      case "resizeRow" -> PointerIcon.TYPE_VERTICAL_DOUBLE_ARROW;
      case "resizeUp" -> PointerIcon.TYPE_VERTICAL_DOUBLE_ARROW;
      case "resizeUpDown" -> PointerIcon.TYPE_VERTICAL_DOUBLE_ARROW;
      case "resizeUpRight" -> PointerIcon.TYPE_TOP_RIGHT_DIAGONAL_DOUBLE_ARROW;
      case "resizeUpLeftDownRight" -> PointerIcon.TYPE_TOP_LEFT_DIAGONAL_DOUBLE_ARROW;
      case "resizeUpRightDownLeft" -> PointerIcon.TYPE_TOP_RIGHT_DIAGONAL_DOUBLE_ARROW;
      case "verticalText" -> PointerIcon.TYPE_VERTICAL_TEXT;
      case "wait" -> PointerIcon.TYPE_WAIT;
      case "zoomIn" -> PointerIcon.TYPE_ZOOM_IN;
      case "zoomOut" -> PointerIcon.TYPE_ZOOM_OUT;
      default -> PointerIcon.TYPE_ARROW;
    };
    return PointerIcon.getSystemIcon(context,type);
  }
}
