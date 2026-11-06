// SPDX-License-Identifier: BSD-3-Clause
import {
  registerNativeWidgetAdapter,
  StatefulElement,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import {
  RawGestureDetector,
  RawGestureDetectorState,
} from '@nelyx/core/framework/widgets/raw-gesture-detector';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import type { GestureOptions } from '@nelyx/core/framework/widgets/gesture-detector';
import { TapGestureRecognizer } from '@nelyx/core/framework/gestures/tap';
import {
  HorizontalDragGestureRecognizer,
  VerticalDragGestureRecognizer,
  PanGestureRecognizer,
} from '@nelyx/core/framework/gestures/monodrag';
import {
  nativeRecognizerConfiguration,
  MultitouchDragStrategy,
} from '@nelyx/core/framework/gestures/recognizer';
import { GestureArenaTeam } from '@nelyx/core/framework/gestures/team';
import type { OneSequenceGestureRecognizer } from '@nelyx/core/framework/gestures/recognizer';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';

/** Retain Source factories/recognizer lifetime; Content delivers canonical recognition details. */
export function installOriginalRawGestures(
  owner: BuildOwner,
  fail: (reason: string) => never,
): void {
  const teams = new WeakMap<GestureArenaTeam, RawGestureDetectorState>();
  registerNativeWidgetAdapter(owner, 'raw-gesture-detector', (widget, context) => {
    if (
      Object.getPrototypeOf(widget) !== RawGestureDetector.prototype ||
      !(context instanceof StatefulElement) ||
      !(context.stateObject instanceof RawGestureDetectorState)
    )
      return fail('custom-raw-gesture-detector');
    const source = widget as RawGestureDetector,
      state = context.stateObject;
    if (source.semantics || source.options.semanticsId) return fail('custom-raw-gesture-semantics');
    const configuration: Record<string, unknown> = {
      behavior:
        source.behavior ??
        (source.child === null ? HitTestBehavior.translucent : HitTestBehavior.deferToChild),
      excludeFromSemantics: source.excludeFromSemantics,
      label: source.options.label,
      enabled: source.options.enabled,
    };
    const retained = [...source.gestures.keys()].map((type) => {
      const recognizer = state.recognizerFor(type),
        metadata = recognizer && nativeRecognizerConfiguration(recognizer);
      if (
        !recognizer ||
        Object.getPrototypeOf(recognizer) !== type.prototype ||
        !metadata ||
        metadata.custom ||
        recognizer.supportedDevices !== null ||
        (recognizer.gestureSettings?.touchSlop != null &&
          recognizer.gestureSettings.touchSlop !== 18)
      )
        return fail('custom-raw-gesture-configuration');
      const bind = (native: string, name: string) => {
        if (typeof Reflect.get(recognizer, name) !== 'function') return;
        configuration[native] = (...args: unknown[]) => {
          if (!context.mounted || recognizer.isDisposed || state.recognizerFor(type) !== recognizer)
            return;
          const callback = Reflect.get(recognizer, name) as ((...args: unknown[]) => void) | null;
          callback?.(...args);
        };
      };
      if (type === TapGestureRecognizer) {
        const tap = recognizer as TapGestureRecognizer;
        if (
          tap.preAcceptSlopTolerance !== 18 ||
          tap.postAcceptSlopTolerance !== 18 ||
          Object.keys(tap).some(
            (name) => /on(?:Secondary|Tertiary)/.test(name) && Reflect.get(tap, name),
          )
        )
          return fail('custom-raw-tap-configuration');
        for (const name of ['onTap', 'onTapDown', 'onTapUp', 'onTapCancel', 'onTapMove'])
          bind(name, name);
      } else if (
        type === HorizontalDragGestureRecognizer ||
        type === VerticalDragGestureRecognizer ||
        type === PanGestureRecognizer
      ) {
        const drag = recognizer as HorizontalDragGestureRecognizer;
        if (
          drag.multitouchDragStrategy !== MultitouchDragStrategy.latestPointer ||
          drag.velocityTrackerBuilder !== metadata.velocity ||
          drag.minFlingDistance !== null ||
          drag.minFlingVelocity !== null ||
          drag.maxFlingVelocity !== null
        )
          return fail('custom-raw-drag-configuration');
        const prefix =
          type === HorizontalDragGestureRecognizer
            ? 'onHorizontalDrag'
            : type === VerticalDragGestureRecognizer
              ? 'onVerticalDrag'
              : 'onPan';
        for (const name of ['Down', 'Start', 'Update', 'End', 'Cancel'])
          bind(prefix + name, 'on' + name);
        if (
          (configuration.dragStartBehavior &&
            configuration.dragStartBehavior !== drag.dragStartBehavior) ||
          (configuration.onlyAcceptDragOnThreshold !== undefined &&
            configuration.onlyAcceptDragOnThreshold !== drag.onlyAcceptDragOnThreshold)
        )
          return fail('competing-raw-drag-settings');
        configuration.dragStartBehavior = drag.dragStartBehavior;
        configuration.onlyAcceptDragOnThreshold = drag.onlyAcceptDragOnThreshold;
      } else return fail('unported-raw-gesture-recognizer');
      return { type, recognizer: recognizer as OneSequenceGestureRecognizer };
    });
    const team = retained[0]?.recognizer.team;
    if (retained.some(({ recognizer }) => recognizer.team !== team))
      return fail('competing-raw-gesture-teams');
    if (team) {
      if (
        Object.getPrototypeOf(team) !== GestureArenaTeam.prototype ||
        team.captain !== null ||
        team.arena !== owner.gestureBinding.gestureArena
      )
        return fail('custom-raw-gesture-team');
      const previous = teams.get(team);
      if (previous && previous !== state && previous.mounted)
        return fail('shared-raw-gesture-team');
      teams.set(team, state);
    }
    return new GestureDetector(source.child, configuration as GestureOptions);
  });
}
