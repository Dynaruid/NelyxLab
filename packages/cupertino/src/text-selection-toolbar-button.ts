// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Text, Padding, DecoratedBox, Align, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { ContextMenuButtonItem } from '@nelyx/core/framework/widgets/context-menu-button-item';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoTheme } from './theme.ts';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Size } from '@nelyx/core/ui/geometry';
import { Offset } from '@nelyx/core/ui/offset';
import { Path } from '@nelyx/core/ui/path';
import { Paint } from '@nelyx/core/ui/paint';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurveTween, Tween } from '@nelyx/core/framework/animation/tween';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
export interface CupertinoTextSelectionToolbarButtonOptions extends WidgetOptions {
    readonly child?: Widget | null;
    readonly onPressed?: (() => void) | null;
    readonly text?: string | null;
    readonly buttonItem?: ContextMenuButtonItem | null;
}
export class CupertinoTextSelectionToolbarButton extends StatefulWidget {
    readonly child: Widget | null;
    readonly onPressed: (() => void) | null;
    readonly text: string | null;
    readonly buttonItem: ContextMenuButtonItem | null;
    constructor({ key = null, child = null, onPressed = null, text = null, buttonItem = null }: CupertinoTextSelectionToolbarButtonOptions) {
        super(key);
        this.child = child;
        this.onPressed = buttonItem?.onPressed ?? onPressed;
        this.text = text;
        this.buttonItem = buttonItem;
    }
    static text(options: {
        readonly text: string;
        readonly onPressed?: (() => void) | null;
    } & WidgetOptions): CupertinoTextSelectionToolbarButton {
        return new CupertinoTextSelectionToolbarButton(options);
    }
    static buttonItem(options: {
        readonly buttonItem: ContextMenuButtonItem;
    } & WidgetOptions): CupertinoTextSelectionToolbarButton {
        return new CupertinoTextSelectionToolbarButton(options);
    }
    static getButtonLabel(context: BuildContext, item: ContextMenuButtonItem): string {
        if (item.label !== null)
            return item.label;
        const l = CupertinoLocalizations.of(context);
        switch (item.type.name) {
            case 'cut': return l.cutButtonLabel;
            case 'copy': return l.copyButtonLabel;
            case 'paste': return l.pasteButtonLabel;
            case 'selectAll': return l.selectAllButtonLabel;
            case 'lookUp': return l.lookUpButtonLabel;
            case 'searchWeb': return l.searchWebButtonLabel;
            case 'share': return l.shareButtonLabel;
            default: return '';
        }
    }
    createState(): State<CupertinoTextSelectionToolbarButton> {
        return new CupertinoToolbarButtonState();
    }
}
class CupertinoToolbarButtonState extends State<CupertinoTextSelectionToolbarButton> {
    private pressed = false;
    build(context: BuildContext): Widget {
        const dark = CupertinoTheme.of(context).brightness === 'dark', label = this.widget.text ?? (this.widget.buttonItem ? CupertinoTextSelectionToolbarButton.getButtonLabel(context, this.widget.buttonItem) : ''), child = this.widget.child ?? (this.widget.buttonItem?.type.name === 'liveTextInput' ? new SizedBox(13, 13, new CustomPaint(undefined, { painter: new LiveTextIconPainter(dark ? 0xffffffff : 0xff000000) })) : new Text(label, { style: new TextStyle({
                inherit: false, fontSize: 15, letterSpacing: -.15, color: this.widget.onPressed ? (dark ? 0xffffffff : 0xff000000) : 0xff8e8e93
            }), overflow: 'ellipsis' }));
        const body = new GestureDetector(new DecoratedBox(new Padding({
            left: 16, top: 18, right: 16, bottom: 18
        }, child), this.pressed ? (dark ? 0x10ffffff : 0x10000000) : 0), {
            ...(this.widget.onPressed ? {
                onTapDown: () => this.setState(() => {
                    this.pressed = true;
                }), onTapUp: () => {
                    this.setState(() => {
                        this.pressed = false;
                    });
                }, onTap: this.widget.onPressed, onTapCancel: () => this.setState(() => {
                    this.pressed = false;
                })
            } : {}), excludeFromSemantics: true, behavior: HitTestBehavior.opaque
        });
        return new Semantics({
            button: true, label, enabled: this.widget.onPressed !== null, onTap: this.widget.onPressed, excludeSemantics: true, child: body
        });
    }
}
class LiveTextIconPainter extends CustomPainter {
    constructor(readonly color: number) {
        super();
    }
    paint(canvas: Canvas, size: Size): void {
        const paint = new Paint({
            color: this.color, strokeCap: 'round', strokeJoin: 'round', strokeWidth: 1, style: 'stroke'
        }), x = -size.width / 2, y = -size.height / 2, path = new Path();
        path.moveTo(x, y + 3.5);
        path.lineTo(x, y + 1);
        path.conicTo(x, y, x + 1, y, Math.SQRT1_2);
        path.lineTo(x + 3.5, y);
        canvas.save();
        try {
            canvas.translate(size.width / 2, size.height / 2);
            for (let i = 0; i < 4; i++) {
                canvas.drawPath(path, paint);
                canvas.transform([0, 1, -1, 0, 0, 0]);
            }
            for (const [y, end] of [[-3, 3], [0, 3], [3, 1]])
                canvas.drawLine(new Offset(-3, y!), new Offset(end!, y!), paint);
        }
        finally {
            canvas.restore();
        }
    }
    shouldRepaint(old: CustomPainter): boolean {
        return !(old instanceof LiveTextIconPainter) || old.color !== this.color;
    }
}
export class CupertinoDesktopTextSelectionToolbarButton extends CupertinoTextSelectionToolbarButton {
    static override text(options: {
        readonly text: string;
        readonly onPressed?: (() => void) | null;
    } & WidgetOptions): CupertinoDesktopTextSelectionToolbarButton {
        return new CupertinoDesktopTextSelectionToolbarButton(options);
    }
    static override buttonItem(options: {
        readonly buttonItem: ContextMenuButtonItem;
    } & WidgetOptions): CupertinoDesktopTextSelectionToolbarButton {
        return new CupertinoDesktopTextSelectionToolbarButton(options);
    }
    override createState(): State<CupertinoDesktopTextSelectionToolbarButton> {
        return new DesktopButtonState();
    }
}
class DesktopButtonState extends SingleTickerProviderStateMixin<CupertinoDesktopTextSelectionToolbarButton> {
    private hovered = false;
    private held = false;
    private controller!: AnimationController;
    private opacity!: Animation<number>;
    override initState(): void {
        super.initState();
        this.controller = new AnimationController({
            vsync: this, duration: 200, value: 0
        });
        this.opacity = this.controller.drive(new CurveTween({ curve: Curves.decelerate })).drive(new Tween({ begin: 1, end: .7 }));
    }
    private press(held: boolean): void {
        this.held = held;
        this.animate();
    }
    private animate(): void {
        if (this.controller.isAnimating)
            return;
        const held = this.held;
        this.controller.animateTo(held ? 1 : 0, { duration: held ? 120 : 180, curve: held ? Curves.easeInOutCubicEmphasized : Curves.easeOutCubic }).then(() => {
            if (this.mounted && held !== this.held)
                this.animate();
        });
    }
    override dispose(): void {
        this.controller.dispose();
        super.dispose();
    }
    build(context: BuildContext): Widget {
        const theme = CupertinoTheme.of(context), label = this.widget.text ?? (this.widget.buttonItem ? CupertinoTextSelectionToolbarButton.getButtonLabel(context, this.widget.buttonItem) : ''), child = this.widget.child ?? new Text(label, { style: new TextStyle({
                inherit: false, fontSize: 14, letterSpacing: -.15, color: this.hovered ? theme.primaryContrastingColor : theme.brightness === 'dark' ? 0xffffffff : 0xff000000
            }), overflow: 'ellipsis' });
        const body = new SizedBox(Infinity, undefined, new MouseRegion(new GestureDetector(new FadeTransition({ opacity: this.opacity, child: new DecoratedBox(new Padding({
                left: 8, top: 2, right: 8, bottom: 5
            }, new Align(child, { alignment: { x: -1, y: 0 }, heightFactor: 1 })), this.hovered ? theme.primaryColor : 0, 4) }), {
            ...(this.widget.onPressed ? {
                onTap: this.widget.onPressed, onTapDown: () => this.press(true), onTapUp: () => this.press(false), onTapCancel: () => this.press(false)
            } : {}), excludeFromSemantics: true, behavior: HitTestBehavior.opaque
        }), { onEnter: () => this.setState(() => {
                this.hovered = true;
            }), onExit: () => this.setState(() => {
                this.hovered = false;
            }) }));
        return new Semantics({
            button: true, label, enabled: this.widget.onPressed !== null, onTap: this.widget.onPressed, excludeSemantics: true, child: body
        });
    }
}
