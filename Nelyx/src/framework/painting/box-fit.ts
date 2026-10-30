// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter painting/box_fit.dart at the recorded upstream pin.
import { invariant } from '../../foundation/errors.ts';
import { Size } from '../../ui/size.ts';
import type { Size as SizeInput } from '../../ui/geometry.ts';

export type BoxFit = 'fill' | 'contain' | 'cover' | 'fitWidth' | 'fitHeight' | 'none' | 'scaleDown';
function size(value: SizeInput): Size {
  return value instanceof Size ? value : new Size(value.width, value.height);
}
/** Immutable references retain Size identity and derived getter dispatch. */
export class FittedSizes {
  readonly #source: Size;
  readonly #destination: Size;
  constructor(source: SizeInput, destination: SizeInput) {
    this.#source = size(source);
    this.#destination = size(destination);
  }
  get source(): Size {
    return this.#source;
  }
  get destination(): Size {
    return this.#destination;
  }
}
export function applyBoxFit(fit: BoxFit, input: SizeInput, output: SizeInput): FittedSizes {
  invariant(
    ['fill', 'contain', 'cover', 'fitWidth', 'fitHeight', 'none', 'scaleDown'].includes(fit),
    'invalid-box-fit',
    'Unknown BoxFit',
  );
  const inputSize = size(input),
    outputSize = size(output);
  if (
    inputSize.height <= 0 ||
    inputSize.width <= 0 ||
    outputSize.height <= 0 ||
    outputSize.width <= 0
  )
    return new FittedSizes(Size.zero, Size.zero);
  let sourceSize: Size, destinationSize: Size;
  switch (fit) {
    case 'fill':
      sourceSize = inputSize;
      destinationSize = outputSize;
      break;
    case 'contain':
      sourceSize = inputSize;
      if (outputSize.width / outputSize.height > sourceSize.width / sourceSize.height)
        destinationSize = new Size(
          (sourceSize.width * outputSize.height) / sourceSize.height,
          outputSize.height,
        );
      else
        destinationSize = new Size(
          outputSize.width,
          (sourceSize.height * outputSize.width) / sourceSize.width,
        );
      break;
    case 'cover':
      if (outputSize.width / outputSize.height > inputSize.width / inputSize.height)
        sourceSize = new Size(
          inputSize.width,
          (inputSize.width * outputSize.height) / outputSize.width,
        );
      else
        sourceSize = new Size(
          (inputSize.height * outputSize.width) / outputSize.height,
          inputSize.height,
        );
      destinationSize = outputSize;
      break;
    case 'fitWidth':
      if (outputSize.width / outputSize.height > inputSize.width / inputSize.height) {
        sourceSize = new Size(
          inputSize.width,
          (inputSize.width * outputSize.height) / outputSize.width,
        );
        destinationSize = outputSize;
      } else {
        sourceSize = inputSize;
        destinationSize = new Size(
          outputSize.width,
          (sourceSize.height * outputSize.width) / sourceSize.width,
        );
      }
      break;
    case 'fitHeight':
      if (outputSize.width / outputSize.height > inputSize.width / inputSize.height) {
        sourceSize = inputSize;
        destinationSize = new Size(
          (sourceSize.width * outputSize.height) / sourceSize.height,
          outputSize.height,
        );
      } else {
        sourceSize = new Size(
          (inputSize.height * outputSize.width) / outputSize.height,
          inputSize.height,
        );
        destinationSize = outputSize;
      }
      break;
    case 'none':
      sourceSize = new Size(
        Math.min(inputSize.width, outputSize.width),
        Math.min(inputSize.height, outputSize.height),
      );
      destinationSize = sourceSize;
      break;
    case 'scaleDown':
      sourceSize = inputSize;
      destinationSize = inputSize;
      const ratio = inputSize.width / inputSize.height;
      if (destinationSize.height > outputSize.height)
        destinationSize = new Size(outputSize.height * ratio, outputSize.height);
      if (destinationSize.width > outputSize.width)
        destinationSize = new Size(outputSize.width, outputSize.width / ratio);
      break;
  }
  return new FittedSizes(sourceSize, destinationSize);
}
