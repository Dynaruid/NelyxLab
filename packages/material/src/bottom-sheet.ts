// SPDX-License-Identifier: BSD-3-Clause
// Material defaults and modal policy based on Flutter bottom_sheet.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { invariant } from '@nelyx/core/foundation/errors';
import { Cubic } from '@nelyx/core/framework/animation/curves';
import { CurveTween, Tween } from '@nelyx/core/framework/animation/tween';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Builder,
  Column,
  ConstrainedBox,
  DecoratedBox,
  Flexible,
  Padding,
  SizedBox,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { TraversalEdgeBehavior } from '@nelyx/core/framework/widgets/focus-traversal-policy';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Listener } from '@nelyx/core/framework/widgets/listener';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import { PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import type { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { SlideTransition } from '@nelyx/core/framework/widgets/transitions';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Radius } from '@nelyx/core/ui/radius';
import { Size } from '@nelyx/core/ui/size';
import { Material } from './material.ts';
import { Theme } from './theme.ts';

const sheetShape = new RoundedRectangleBorder({
  borderRadius: BorderRadius.vertical({ top: Radius.circular(28) }),
});
const sheetConstraints = new BoxConstraints(0, 640);
const handleSize = new Size(32, 4);
const transparent = new Color(0x00000000);
const black54 = new Color(0x8a000000);
const dismissLabel = 'Dismiss';
const slide = new Tween<Offset>({ begin: new Offset(0, 1), end: Offset.zero }).chain(
  new CurveTween({ curve: new Cubic(0, 0, 0.2, 1) }),
);

interface SheetAppearance {
  readonly backgroundColor?: Color | null;
  readonly elevation?: number | null;
  readonly shape?: ShapeBorder | null;
  readonly clipBehavior?: Clip | null;
  readonly constraints?: BoxConstraints | null;
  /** Shows a close affordance. Swipe-to-dismiss is not supported. */
  readonly showDragHandle?: boolean | null;
}

export interface BottomSheetOptions extends SheetAppearance, WidgetOptions {
  readonly builder: (context: BuildContext) => Widget;
  /** Invoked when the optional handle is activated. The owner removes the sheet. */
  readonly onClosing: () => void;
  readonly shadowColor?: Color | null;
  readonly dragHandleColor?: Color | null;
  readonly dragHandleSize?: Size | null;
}

/** An inline Material surface. For a modal route, use showModalBottomSheet. */
export class BottomSheet extends StatelessWidget {
  constructor(readonly options: BottomSheetOptions) {
    super(options.key ?? null);
  }

  override build(context: BuildContext): Widget {
    const constraints =
      this.options.constraints ??
      Theme.of(context).bottomSheetTheme.constraints ??
      sheetConstraints;
    return new Align(new ConstrainedBox(new SheetSurface(this.options), constraints), {
      alignment: Alignment.bottomCenter,
      heightFactor: 1,
    });
  }
}

class SheetSurface extends StatelessWidget {
  constructor(
    private readonly options: BottomSheetOptions,
    private readonly modal = false,
  ) {
    super();
  }

  override build(context: BuildContext): Widget {
    const { colorScheme, bottomSheetTheme: theme } = Theme.of(context);
    const options = this.options;
    let child: Widget = new Builder(options.builder);
    if (options.showDragHandle ?? theme.showDragHandle ?? false) {
      const size = options.dragHandleSize ?? theme.dragHandleSize ?? handleSize;
      const color =
        options.dragHandleColor ?? theme.dragHandleColor ?? new Color(colorScheme.onSurfaceVariant);
      const handle = new ControlInteraction(
        () =>
          new SizedBox(
            Math.max(48, size.width),
            Math.max(48, size.height),
            new Align(
              new DecoratedBox(
                new SizedBox(size.width, size.height),
                color.toARGB32(),
                size.height / 2,
              ),
            ),
          ),
        { onPressed: options.onClosing, semantics: { button: true, label: dismissLabel } },
      );
      child = new Column(
        [new Align(handle, { widthFactor: 1, heightFactor: 1 }), new Flexible(child)],
        {
          mainAxisSize: 'min',
          crossAlign: this.modal ? 'stretch' : 'center',
        },
      );
    }
    return new Material({
      color:
        options.backgroundColor ??
        (this.modal ? theme.modalBackgroundColor : null) ??
        theme.backgroundColor ??
        new Color(colorScheme.surfaceContainerLow),
      elevation:
        options.elevation ?? (this.modal ? theme.modalElevation : null) ?? theme.elevation ?? 1,
      shape: options.shape ?? theme.shape ?? sheetShape,
      clipBehavior: options.clipBehavior ?? theme.clipBehavior ?? 'none',
      shadowColor: options.shadowColor ?? theme.shadowColor ?? transparent,
      surfaceTintColor: theme.surfaceTintColor ?? transparent,
      child,
    });
  }
}

export interface ModalBottomSheetOptions extends SheetAppearance {
  readonly builder: (context: BuildContext) => Widget;
  readonly barrierColor?: Color | null;
  readonly barrierLabel?: string | null;
  /** Allows a tap on the scrim to dismiss the route. */
  readonly isDismissible?: boolean;
  /** Allows content to use the full available height, without adding drag behavior. */
  readonly isScrollControlled?: boolean;
  readonly scrollControlDisabledMaxHeightRatio?: number;
  readonly useRootNavigator?: boolean;
  /** Avoid top and side safe insets; bottom safe padding is left to the content. */
  readonly useSafeArea?: boolean;
  readonly routeSettings?: RouteSettings | null;
  readonly requestFocus?: boolean | null;
}

/** Pushes a non-opaque sheet. Pop with a result to resolve it, or dismiss for undefined. */
export function showModalBottomSheet<T = unknown>(
  context: BuildContext,
  {
    barrierColor,
    barrierLabel,
    isDismissible = true,
    isScrollControlled = false,
    scrollControlDisabledMaxHeightRatio = 9 / 16,
    useRootNavigator = false,
    useSafeArea = false,
    routeSettings,
    requestFocus,
    ...options
  }: ModalBottomSheetOptions,
): Promise<T | undefined> {
  const ratio = isScrollControlled ? 1 : scrollControlDisabledMaxHeightRatio;
  invariant(
    Number.isFinite(ratio) && ratio >= 0 && ratio <= 1,
    'invalid-sheet-height-ratio',
    'Sheet height ratio must be between 0 and 1',
  );
  const navigator = Navigator.of(context, { rootNavigator: useRootNavigator });
  let navigatorContext: BuildContext | undefined;
  if (context.widget instanceof Navigator && context.widget.controller === navigator) {
    navigatorContext = context;
  } else {
    context.visitAncestorElements((ancestor) => {
      if (!(ancestor.widget instanceof Navigator) || ancestor.widget.controller !== navigator)
        return true;
      navigatorContext = ancestor;
      return false;
    });
  }
  const themes = InheritedTheme.capture(context, navigatorContext);
  const closeLabel = barrierLabel ?? dismissLabel;
  const route = new PageRouteBuilder<T>({
    opaque: false,
    fullscreenDialog: true,
    settings: routeSettings ?? null,
    requestFocus: requestFocus ?? null,
    traversalEdgeBehavior: TraversalEdgeBehavior.closedLoop,
    barrierDismissible: isDismissible,
    barrierColor: barrierColor ?? Theme.of(context).bottomSheetTheme.modalBarrierColor ?? black54,
    barrierLabel: closeLabel,
    transitionDuration: 250,
    reverseTransitionDuration: 200,
    pageBuilder: (_context, animation) =>
      themes.wrap(
        new Builder((context) => {
          const constraints =
            options.constraints ??
            Theme.of(context).bottomSheetTheme.constraints ??
            sheetConstraints;
          const surface = new SheetSurface(
            {
              ...options,
              onClosing: () => {
                if (route.isCurrent) navigator.pop();
              },
            },
            true,
          );
          const content = new LayoutBuilder(
            (_context, viewport) =>
              new ClipRect(
                new Align(
                  new SlideTransition({
                    position: animation.drive(slide),
                    child: new ConstrainedBox(
                      new Listener(new SizedBox(Infinity, undefined, surface), {
                        behavior: HitTestBehavior.opaque,
                      }),
                      constraints.enforce(
                        new BoxConstraints(0, viewport.maxWidth, 0, viewport.maxHeight * ratio),
                      ),
                    ),
                  }),
                  { alignment: Alignment.bottomCenter },
                ),
              ),
          );
          const safeContent = useSafeArea
            ? new SafeArea({ bottom: false, child: content })
            : MediaQuery.removePadding({ context, removeTop: true, child: content });
          return new Padding(
            EdgeInsets.only({ bottom: MediaQuery.viewInsetsOf(context).bottom }),
            safeContent,
          );
        }),
      ),
  });
  return navigator.push(route);
}
