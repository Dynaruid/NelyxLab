// SPDX-License-Identifier: BSD-3-Clause
// Own host binding for the source compile-time flutter.benchmarks.force_disable_snapshot flag.
// Configure once before the first Zoom build; applications have no Node/process dependency.
import {invariant} from '@nelyx/core/foundation/errors';
let configured=false,used=false,forceDisableSnapshotting=false;
export function configureZoomTransitionProfile(options:{readonly forceDisableSnapshotting:boolean}):void{invariant(!configured&&!used,'zoom-profile-already-bound','Zoom profiling must be configured once before use');invariant(typeof options.forceDisableSnapshotting==='boolean','invalid-zoom-profile','Zoom profiling requires a boolean');forceDisableSnapshotting=options.forceDisableSnapshotting;configured=true;}
export function zoomProfileForceDisableSnapshotting():boolean{used=true;return forceDisableSnapshotting;}
