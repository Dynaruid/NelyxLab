// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
#pragma once
#import <TargetConditionals.h>
#if TARGET_OS_OSX
#import <AppKit/AppKit.h>
static NSDictionary<NSString*,NSCursor*>* nelyxSystemCursors;
static NSCursor* NelyxSystemMouseCursor(NSString* kind) {
  // The following mapping must be kept in sync with Flutter framework's
  // mouse_cursor.dart

  if ([kind isEqualToString:@"none"]) {
    NSImage* image = [[NSImage alloc] initWithSize:NSMakeSize(1, 1)];
    return [[NSCursor alloc] initWithImage:image hotSpot:NSMakePoint(0, 0)];
  }

  if (nelyxSystemCursors == nil) {
    nelyxSystemCursors = @{
      @"alias" : [NSCursor dragLinkCursor],
      @"basic" : [NSCursor arrowCursor],
      @"click" : [NSCursor pointingHandCursor],
      @"contextMenu" : [NSCursor contextualMenuCursor],
      @"copy" : [NSCursor dragCopyCursor],
      @"disappearing" : [NSCursor disappearingItemCursor],
      @"forbidden" : [NSCursor operationNotAllowedCursor],
      @"grab" : [NSCursor openHandCursor],
      @"grabbing" : [NSCursor closedHandCursor],
      @"noDrop" : [NSCursor operationNotAllowedCursor],
      @"precise" : [NSCursor crosshairCursor],
      @"text" : [NSCursor IBeamCursor],
      @"resizeColumn" : [NSCursor resizeLeftRightCursor],
      @"resizeDown" : [NSCursor resizeDownCursor],
      @"resizeLeft" : [NSCursor resizeLeftCursor],
      @"resizeLeftRight" : [NSCursor resizeLeftRightCursor],
      @"resizeRight" : [NSCursor resizeRightCursor],
      @"resizeRow" : [NSCursor resizeUpDownCursor],
      @"resizeUp" : [NSCursor resizeUpCursor],
      @"resizeUpDown" : [NSCursor resizeUpDownCursor],
      @"verticalText" : [NSCursor IBeamCursorForVerticalLayout],
    };
  }
  NSCursor* result = [nelyxSystemCursors objectForKey:kind];
  if (result == nil) {
    return [NSCursor arrowCursor];
  }
  return result;
}

#endif
