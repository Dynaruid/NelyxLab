// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#import <Foundation/Foundation.h>
#include "AppleStreamState.h"
#include "include/core/SkData.h"
#include <functional>
#include <string>

@interface RNSkAppleStreamLoader : NSObject
- (void)loadURI:(const std::string &)uri limit:(size_t)limit
    completion:(std::function<void(sk_sp<SkData>)>)completion;
- (void)close;
- (RNSkia::AppleStreamSnapshot)snapshot;
@end
