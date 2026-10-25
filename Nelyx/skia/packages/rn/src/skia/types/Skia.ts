// SPDX-License-Identifier: MIT
import type {Skia as NativeSkia} from '@nelyx/skia-native/skia/types/Skia';
import type {JsiRecorder} from './Recorder.ts';
/** RN's declarative recorder extends the neutral Engine API. */
export interface Skia extends NativeSkia {Recorder():JsiRecorder;}
