// SPDX-License-Identifier: BSD-3-Clause
import { StatelessWidget, Element } from './framework.ts';
import type { Widget, BuildContext } from './framework.ts';
import type { Key } from '../../foundation/key.ts';
import { NotificationListener } from './notification-listener.ts';
import { ScrollUpdateNotification } from './scroll-notification.ts';
import type { FocusManager } from './focus.ts';
import { invariant } from '../../foundation/errors.ts';
import { FlagProperty } from '../../foundation/diagnostic-properties.ts';
import type { FlagPropertyOptions } from '../../foundation/diagnostic-properties.ts';
// Source's process singleton is rebound to the actual View during this exact
// synchronous notification callback. Capture each listener's build context;
// nested builds and callbacks restore the previous scope in finally.
let building: BuildContext | null = null,
  notifying: FocusManager | null = null;
export abstract class TwoAxisStatelessHost extends StatelessWidget {
  constructor({ key = null }: { key?: Key | null } = {}) {
    super(key);
  }
  abstract sourceBuild(context: BuildContext): Widget;
  override build(context: BuildContext): Widget {
    const previous = building;
    building = context;
    try {
      return this.sourceBuild(context);
    } finally {
      building = previous;
    }
  }
}
export function createTwoAxisUpdateListener({
  child,
  onNotification,
}: {
  child: Widget;
  onNotification: (notification: ScrollUpdateNotification) => boolean;
}): NotificationListener<ScrollUpdateNotification> {
  const context = building;
  invariant(
    context instanceof Element,
    'missing-two-axis-build-scope',
    'The exact source listener must be constructed during its owning build',
  );
  return new NotificationListener({
    child,
    notificationType: ScrollUpdateNotification,
    onNotification: (notification) => {
      if (!context.mounted) return false;
      const previous = notifying;
      notifying = context.owner.focus;
      try {
        return onNotification(notification);
      } finally {
        notifying = previous;
      }
    },
  });
}
export function currentTwoAxisFocusManager(_owner: typeof FocusManager): FocusManager {
  invariant(
    notifying !== null,
    'missing-two-axis-focus-scope',
    'Source focus singleton is available only in its owning notification callback',
  );
  return notifying;
}
export function createTwoAxisFlag(
  name: string,
  { value, ...options }: FlagPropertyOptions & { value: boolean | null },
): FlagProperty {
  return new FlagProperty(name, value, options);
}
