// SPDX-License-Identifier: BSD-3-Clause
import { paintFrameLimits } from './frame.ts';

export const webFrameMagic = 0x574c5a4e;
export const webFrameWireVersion = 1;
export const webFrameHeaderBytes = 104;
export const webFrameRecordBytes = 72;
export const maxWebFrameBytes =
  webFrameHeaderBytes + paintFrameLimits.commands * webFrameRecordBytes;
