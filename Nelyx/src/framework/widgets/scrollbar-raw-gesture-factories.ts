// SPDX-License-Identifier: BSD-3-Clause
// Separate generated-class lookups from base hosts to avoid ESM initialization cycles.
import {
  GestureRecognizerFactory,
  GestureRecognizerFactoryWithHandlers,
} from './raw-gesture-detector.ts';
import {
  SourceHorizontalThumbDragGestureRecognizer,
  SourceVerticalThumbDragGestureRecognizer,
  SourceTrackTapGestureRecognizer,
} from './scrollbar.generated.ts';
export function scrollbarHorizontalFactory(
  create: () => SourceHorizontalThumbDragGestureRecognizer,
  initialize: (value: SourceHorizontalThumbDragGestureRecognizer) => void,
): GestureRecognizerFactory<SourceHorizontalThumbDragGestureRecognizer> {
  return new GestureRecognizerFactoryWithHandlers(
    SourceHorizontalThumbDragGestureRecognizer,
    create,
    initialize,
  );
}
export function scrollbarVerticalFactory(
  create: () => SourceVerticalThumbDragGestureRecognizer,
  initialize: (value: SourceVerticalThumbDragGestureRecognizer) => void,
): GestureRecognizerFactory<SourceVerticalThumbDragGestureRecognizer> {
  return new GestureRecognizerFactoryWithHandlers(
    SourceVerticalThumbDragGestureRecognizer,
    create,
    initialize,
  );
}
export function scrollbarTrackFactory(
  create: () => SourceTrackTapGestureRecognizer,
  initialize: (value: SourceTrackTapGestureRecognizer) => void,
): GestureRecognizerFactory<SourceTrackTapGestureRecognizer> {
  return new GestureRecognizerFactoryWithHandlers(
    SourceTrackTapGestureRecognizer,
    create,
    initialize,
  );
}
