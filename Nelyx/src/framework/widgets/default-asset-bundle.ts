// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {invariant} from '../../foundation/errors.ts';
import type {Key} from '../../foundation/key.ts';
import type {AssetBundle} from '../../services/asset-bundle.ts';
import {imageAssetBundleFor} from '../painting/image-provider.ts';
import {InheritedWidget} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
export class DefaultAssetBundle extends InheritedWidget {
  constructor(readonly bundle:AssetBundle,child:Widget,key:Key|null=null){super(child,key);}
  static of(context:BuildContext):AssetBundle{const value=context.maybeDependOn(DefaultAssetBundle);if(value)return value.bundle;const images=context.services.images;invariant(images&&!images.isClosed,'missing-image-service','The default asset bundle requires the app ImageService');return imageAssetBundleFor(images);}
  override updateShouldNotify(old:this):boolean{return old.bundle!==this.bundle;}
}
