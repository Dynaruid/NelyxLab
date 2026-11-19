// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/user_accounts_drawer_header.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Tween } from '@nelyx/core/framework/animation/tween';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import type { Decoration } from '@nelyx/core/framework/painting/decoration';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { MultiChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import {
  Center,
  Column,
  Expanded,
  Padding,
  PositionedDirectional,
  Row,
  SizedBox,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { CustomMultiChildLayout, LayoutId } from '@nelyx/core/framework/widgets/custom-layout';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { RotationTransition } from '@nelyx/core/framework/widgets/transitions';
import type { Color } from '@nelyx/core/ui/color';
import type { Size as BoxSize } from '@nelyx/core/ui/geometry';
import { Size } from '@nelyx/core/ui/size';
import { Colors } from './colors.ts';
import { DrawerHeader } from './drawer-header.ts';
import { Icons } from './icons.ts';
import { InkWell } from './ink-well.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Theme } from './theme.ts';

const accountDetailsHeight = 56;
const defaultMargin = EdgeInsets.only({ bottom: 8 });
const defaultCurrentPictureSize = Size.square(72);
const defaultOtherPictureSize = Size.square(40);

export interface UserAccountsDrawerHeaderOptions extends WidgetOptions {
  readonly decoration?: Decoration | null;
  readonly margin?: EdgeInsetsGeometry | null;
  readonly currentAccountPicture?: Widget | null;
  readonly otherAccountsPictures?: readonly Widget[] | null;
  readonly currentAccountPictureSize?: BoxSize;
  readonly otherAccountsPicturesSize?: BoxSize;
  readonly accountName: Widget | null;
  readonly accountEmail: Widget | null;
  readonly onDetailsPressed?: (() => void) | null;
  readonly arrowColor?: Color;
}

export class UserAccountsDrawerHeader extends StatefulWidget {
  readonly decoration: Decoration | null;
  readonly margin: EdgeInsetsGeometry | null;
  readonly currentAccountPicture: Widget | null;
  readonly otherAccountsPictures: readonly Widget[] | null;
  readonly currentAccountPictureSize: BoxSize;
  readonly otherAccountsPicturesSize: BoxSize;
  readonly accountName: Widget | null;
  readonly accountEmail: Widget | null;
  readonly onDetailsPressed: (() => void) | null;
  readonly arrowColor: Color;

  constructor({
    decoration = null,
    margin = defaultMargin,
    currentAccountPicture = null,
    otherAccountsPictures = null,
    currentAccountPictureSize = defaultCurrentPictureSize,
    otherAccountsPicturesSize = defaultOtherPictureSize,
    accountName,
    accountEmail,
    onDetailsPressed = null,
    arrowColor = Colors.white,
    key = null,
  }: UserAccountsDrawerHeaderOptions) {
    super(key);
    this.decoration = decoration;
    this.margin = margin;
    this.currentAccountPicture = currentAccountPicture;
    this.otherAccountsPictures = otherAccountsPictures;
    this.currentAccountPictureSize = currentAccountPictureSize;
    this.otherAccountsPicturesSize = otherAccountsPicturesSize;
    this.accountName = accountName;
    this.accountEmail = accountEmail;
    this.onDetailsPressed = onDetailsPressed;
    this.arrowColor = arrowColor;
  }

  override createState(): SingleTickerProviderStateMixin<UserAccountsDrawerHeader> {
    return new UserAccountsDrawerHeaderState();
  }
}

function accountPictures(header: UserAccountsDrawerHeader): Widget {
  const otherPictures = (header.otherAccountsPictures ?? []).slice(0, 3).map(
    (picture) =>
      new Padding(
        EdgeInsetsDirectional.only({ start: 8 }),
        new Semantics({
          container: true,
          child: new Padding(
            EdgeInsets.only({ left: 8, bottom: 8 }),
            SizedBox.fromSize(header.otherAccountsPicturesSize, picture),
          ),
        }),
      ),
  );
  return new Stack([
    new PositionedDirectional(new Row(otherPictures), { top: 0, end: 0 }),
    new PositionedDirectional(
      new Semantics({
        explicitChildNodes: true,
        child: SizedBox.fromSize(
          header.currentAccountPictureSize,
          header.currentAccountPicture ?? undefined,
        ),
      }),
      { top: 0, start: 0 },
    ),
  ]);
}

class AccountDetailsLayout extends MultiChildLayoutDelegate {
  constructor(private readonly direction: 'ltr' | 'rtl') {
    super();
  }

  override performLayout(size: BoxSize): void {
    let reservedHeight = accountDetailsHeight;
    let availableWidth = size.width;
    if (this.hasChild('arrow')) {
      const arrow = this.layoutChild('arrow', BoxConstraints.loose(size));
      this.positionChild('arrow', {
        x: this.direction === 'ltr' ? size.width - arrow.width : 0,
        y: size.height - arrow.height,
      });
      reservedHeight = arrow.height;
      availableWidth -= arrow.width;
    }
    const bottom = this.hasChild('email') ? 'email' : this.hasChild('name') ? 'name' : null;
    if (!bottom) return;
    const constraints = new BoxConstraints(0, availableWidth, 0, size.height);
    const bottomSize = this.layoutChild(bottom, constraints);
    const y = size.height - (reservedHeight + bottomSize.height) / 2;
    this.positionChild(bottom, {
      x: this.direction === 'ltr' ? 0 : size.width - bottomSize.width,
      y,
    });
    if (bottom === 'email' && this.hasChild('name')) {
      const name = this.layoutChild('name', constraints);
      this.positionChild('name', {
        x: this.direction === 'ltr' ? 0 : size.width - name.width,
        y: y - name.height,
      });
    }
  }

  override shouldRelayout(old: AccountDetailsLayout): boolean {
    return this.direction !== old.direction;
  }
}

class UserAccountsDrawerHeaderState extends SingleTickerProviderStateMixin<UserAccountsDrawerHeader> {
  private open = false;
  private animation!: AnimationController;
  private curve!: CurvedAnimation;
  private turns!: Animation<number>;

  override initState(): void {
    super.initState();
    this.animation = new AnimationController({ duration: 200, vsync: this });
    this.curve = new CurvedAnimation({
      parent: this.animation,
      curve: Curves.fastOutSlowIn,
      reverseCurve: Curves.fastOutSlowIn.flipped,
    });
    this.turns = new Tween<number>({ begin: 0, end: 0.5 }).animate(this.curve);
  }

  private readonly pressDetails = (): void => {
    const callback = this.widget.onDetailsPressed;
    if (!callback) return;
    this.setState(() => {
      this.open = !this.open;
    });
    if (this.open) this.animation.forward();
    else this.animation.reverse();
    callback();
  };

  private accountDetails(context: BuildContext, localizations: MaterialLocalizations): Widget {
    const { accountName, accountEmail, onDetailsPressed, arrowColor } = this.widget;
    const textTheme = Theme.of(context).primaryTextTheme;
    const verticalPadding = EdgeInsets.symmetric({ vertical: 2 });
    const children: Widget[] = [];
    if (accountName) {
      children.push(
        new LayoutId(
          new Padding(
            verticalPadding,
            new DefaultTextStyle(textTheme.bodyLarge!, accountName, { overflow: 'ellipsis' }),
          ),
          'name',
        ),
      );
    }
    if (accountEmail) {
      children.push(
        new LayoutId(
          new Padding(
            verticalPadding,
            new DefaultTextStyle(textTheme.bodyMedium!, accountEmail, { overflow: 'ellipsis' }),
          ),
          'email',
        ),
      );
    }
    const onTap = onDetailsPressed ? this.pressDetails : null;
    if (onTap) {
      children.push(
        new LayoutId(
          new Semantics({
            container: true,
            button: true,
            onTap,
            child: SizedBox.square(
              accountDetailsHeight,
              new Center(
                new RotationTransition({
                  turns: this.turns,
                  child: new Icon(Icons.arrow_drop_down, {
                    color: arrowColor,
                    semanticLabel: this.open
                      ? localizations.hideAccountsLabel
                      : localizations.showAccountsLabel,
                  }),
                }),
              ),
            ),
          }),
          'arrow',
        ),
      );
    }
    const details = new CustomMultiChildLayout(
      children,
      new AccountDetailsLayout(Directionality.of(context)),
    );
    return new SizedBox(
      undefined,
      accountDetailsHeight,
      onTap ? new InkWell({ onTap, excludeFromSemantics: true, child: details }) : details,
    );
  }

  override build(context: BuildContext): Widget {
    const header = this.widget;
    const localizations = MaterialLocalizations.of(context);
    return new Semantics({
      container: true,
      label: localizations.signedInLabel,
      child: new DrawerHeader({
        decoration:
          header.decoration ?? new BoxDecoration({ color: Theme.of(context).colorScheme.primary }),
        margin: header.margin,
        padding: EdgeInsetsDirectional.only({ top: 16, start: 16 }),
        child: new SafeArea({
          bottom: false,
          child: new Column(
            [
              new Expanded(
                new Padding(EdgeInsetsDirectional.only({ end: 16 }), accountPictures(header)),
              ),
              this.accountDetails(context, localizations),
            ],
            { crossAxisAlignment: 'stretch' },
          ),
        }),
      }),
    });
  }

  override dispose(): void {
    this.curve.dispose();
    this.animation.dispose();
    super.dispose();
  }
}
