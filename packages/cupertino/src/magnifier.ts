// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned cupertino/magnifier.dart geometry, animation and platform constants.
import { StatelessWidget, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimatedPositioned } from '@nelyx/core/framework/widgets/implicit-animations';
import { Transform } from '@nelyx/core/framework/widgets/basic';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { RawMagnifier, MagnifierDecoration, MagnifierController } from '@nelyx/core/framework/widgets/magnifier';
import type { MagnifierInfo } from '@nelyx/core/framework/widgets/magnifier';
import type { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { Curve } from '@nelyx/core/framework/animation/curves';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { Size } from '@nelyx/core/ui/size';
import { Radius } from '@nelyx/core/ui/radius';
import type { Clip } from '@nelyx/core/ui/clip';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { CupertinoTheme } from './theme.ts';
export interface CupertinoMagnifierOptions extends WidgetOptions {
    readonly size?: Size;
    readonly borderRadius?: BorderRadius;
    readonly additionalFocalPointOffset?: Offset;
    readonly shadows?: readonly BoxShadow[];
    readonly clipBehavior?: Clip;
    readonly borderSide?: BorderSide;
    readonly inOutAnimation?: Animation<number> | null;
    readonly magnificationScale?: number;
}
export class CupertinoMagnifier extends StatelessWidget {
    static readonly kDefaultSize = new Size(80, 47.5);
    static readonly kMagnifierAboveFocalPoint = -26;
    readonly size: Size;
    readonly borderRadius: BorderRadius;
    readonly additionalFocalPointOffset: Offset;
    readonly shadows: readonly BoxShadow[];
    readonly clipBehavior: Clip;
    readonly borderSide: BorderSide;
    readonly inOutAnimation: Animation<number> | null;
    readonly magnificationScale: number;
    constructor({ key = null, size = CupertinoMagnifier.kDefaultSize, borderRadius = BorderRadius.all(new Radius(60, 50)), additionalFocalPointOffset = Offset.zero, shadows = [new BoxShadow({
            color: 0x19000000, blurRadius: 11, spreadRadius: .2, blurStyle: 'outer'
        })], clipBehavior = 'none', borderSide = new BorderSide({ color: 0xff007cff, width: 2 }), inOutAnimation = null, magnificationScale = 1 }: CupertinoMagnifierOptions = {}) {
        super(key);
        if (!(magnificationScale > 0))
            throw new Error('Magnification scale must be greater than zero');
        this.size = size;
        this.borderRadius = borderRadius;
        this.additionalFocalPointOffset = additionalFocalPointOffset;
        this.shadows = Object.freeze([...shadows]);
        this.clipBehavior = clipBehavior;
        this.borderSide = borderSide;
        this.inOutAnimation = inOutAnimation;
        this.magnificationScale = magnificationScale;
    }
    build(_context: BuildContext): Widget {
        const value = this.inOutAnimation?.value ?? 1;
        return Transform.translate(new RawMagnifier({
            size: this.size, magnificationScale: this.magnificationScale, focalPointOffset: new Offset(0, CupertinoMagnifier.kDefaultSize.height / 2 - CupertinoMagnifier.kMagnifierAboveFocalPoint).add(this.additionalFocalPointOffset), decoration: new MagnifierDecoration({
                opacity: value, shape: new RoundedRectangleBorder({ borderRadius: this.borderRadius, side: this.borderSide }), shadows: this.shadows
            }), clipBehavior: this.clipBehavior
        }), new Offset(0, -CupertinoMagnifier.kMagnifierAboveFocalPoint * (1 - value)));
    }
}
export interface CupertinoTextMagnifierOptions extends WidgetOptions {
    readonly controller: MagnifierController;
    readonly magnifierInfo: ValueNotifier<MagnifierInfo>;
    readonly animationCurve?: Curve;
    readonly dragResistance?: number;
    readonly hideBelowThreshold?: number;
    readonly horizontalScreenEdgePadding?: number;
}
export class CupertinoTextMagnifier extends StatefulWidget {
    readonly controller: MagnifierController;
    readonly magnifierInfo: ValueNotifier<MagnifierInfo>;
    readonly animationCurve: Curve;
    readonly dragResistance: number;
    readonly hideBelowThreshold: number;
    readonly horizontalScreenEdgePadding: number;
    constructor({ key = null, controller, magnifierInfo, animationCurve = Curves.easeOut, dragResistance = 10, hideBelowThreshold = 48, horizontalScreenEdgePadding = 10 }: CupertinoTextMagnifierOptions) {
        super(key);
        this.controller = controller;
        this.magnifierInfo = magnifierInfo;
        this.animationCurve = animationCurve;
        this.dragResistance = dragResistance;
        this.hideBelowThreshold = hideBelowThreshold;
        this.horizontalScreenEdgePadding = horizontalScreenEdgePadding;
    }
    createState(): CupertinoTextMagnifierState {
        return new CupertinoTextMagnifierState();
    }
}
class CupertinoTextMagnifierState extends SingleTickerProviderStateMixin<CupertinoTextMagnifier> {
    private position = Offset.zero;
    private focalY = 0;
    private animation!: AnimationController;
    private curved!: CurvedAnimation;
    private readonly animate = () => {
        if (this.mounted)
            this.setState(() => {
            });
    };
    override initState(): void {
        super.initState();
        this.animation = new AnimationController({
            value: 0, vsync: this, duration: 150
        });
        this.animation.addListener(this.animate);
        this.widget.controller.animationController = this.animation;
        this.curved = new CurvedAnimation({ parent: this.animation, curve: this.widget.animationCurve });
        this.widget.magnifierInfo.addListener(this.determinePosition);
    }
    override didChangeDependencies(): void {
        this.determinePosition();
        super.didChangeDependencies();
    }
    override didUpdateWidget(old: CupertinoTextMagnifier): void {
        if (old.controller !== this.widget.controller) {
            if (old.controller.animationController === this.animation)
                old.controller.animationController = null;
            this.widget.controller.animationController = this.animation;
        }
        this.curved.curve = this.widget.animationCurve;
        if (old.magnifierInfo !== this.widget.magnifierInfo) {
            old.magnifierInfo.removeListener(this.determinePosition);
            this.widget.magnifierInfo.addListener(this.determinePosition);
            this.determinePosition();
        }
        super.didUpdateWidget(old);
    }
    private readonly determinePosition = () => {
        if (!this.mounted)
            return;
        const info = this.widget.magnifierInfo.value, center = info.caretRect.center.dy;
        if (center - info.globalGesturePosition.dy < -this.widget.hideBelowThreshold) {
            if (this.widget.controller.shown)
                void this.widget.controller.hide({ removeFromOverlay: false });
            return;
        }
        if (!this.widget.controller.shown)
            this.animation.forward();
        const vertical = Math.max(center, center - (center - info.globalGesturePosition.dy) / this.widget.dragResistance), size = CupertinoMagnifier.kDefaultSize, shift = CupertinoMagnifier.kMagnifierAboveFocalPoint, media = MediaQuery.of(this.context), padding = this.widget.horizontalScreenEdgePadding;
        const position = MagnifierController.shiftWithinBounds({ bounds: Rect.fromLTRB(padding, -(size.height + shift), media.width - padding, media.height + size.height + shift), rect: Rect.fromLTWH(info.globalGesturePosition.dx - size.width / 2, vertical - (size.height - shift), size.width, size.height) }).topLeft;
        this.setState(() => {
            this.position = position;
            this.focalY = center - vertical;
        });
    };
    build(context: BuildContext): Widget {
        return new AnimatedPositioned({
            duration: 45, curve: this.widget.animationCurve, left: this.position.dx, top: this.position.dy, child: new CupertinoMagnifier({
                inOutAnimation: this.curved, additionalFocalPointOffset: new Offset(0, this.focalY), borderSide: new BorderSide({ color: CupertinoTheme.of(context).primaryColor, width: 2 })
            })
        });
    }
    override dispose(): void {
        if (this.widget.controller.animationController === this.animation)
            this.widget.controller.animationController = null;
        this.widget.magnifierInfo.removeListener(this.determinePosition);
        this.animation.removeListener(this.animate);
        this.curved.dispose();
        this.animation.dispose();
        super.dispose();
    }
}
