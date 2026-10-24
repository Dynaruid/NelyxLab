// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import type {Widget,WidgetOptions,BuildContext} from '@nelyx/core/framework/widgets/framework';
import {Center} from '@nelyx/core/framework/widgets/basic';
import {AnimatedContainer} from '@nelyx/core/framework/widgets/implicit-animations';
import {MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {DefaultTextStyle} from '@nelyx/core/framework/widgets/default-text-style';
import {IconTheme} from '@nelyx/core/framework/widgets/icon-theme';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {BoxDecoration} from '@nelyx/core/framework/painting/box-decoration';
import {DecorationImage} from '@nelyx/core/framework/painting/decoration-image';
import type {ImageProvider} from '@nelyx/core/framework/painting/image-provider';
import type {ImageErrorListener} from '@nelyx/core/framework/painting/image-stream';
import type {Color} from '@nelyx/core/ui/color';
import {invariant} from '@nelyx/core/foundation/errors';
import {Theme} from './theme.ts';
import {materialSchemeColor} from './internal/theme/default-color-schemes.ts';

export interface CircleAvatarOptions extends WidgetOptions {
    readonly child?:Widget|null;
    readonly backgroundColor?:Color|null;
    readonly foregroundColor?:Color|null;
    readonly backgroundImage?:ImageProvider|null;
    readonly foregroundImage?:ImageProvider|null;
    readonly onBackgroundImageError?:ImageErrorListener|null;
    readonly onForegroundImageError?:ImageErrorListener|null;
    /** @dartType double? */ readonly radius?:number|null;
    /** @dartType double? */ readonly minRadius?:number|null;
    /** @dartType double? */ readonly maxRadius?:number|null;
}
/** M3 avatar using the shared animated decoration and owner-scoped image pipeline. */
export class CircleAvatar extends StatelessWidget {
    readonly child:Widget|null;
    readonly backgroundColor:Color|null;
    readonly foregroundColor:Color|null;
    readonly backgroundImage:ImageProvider|null;
    readonly foregroundImage:ImageProvider|null;
    readonly onBackgroundImageError:ImageErrorListener|null;
    readonly onForegroundImageError:ImageErrorListener|null;
    /** @dartType double? */ readonly radius:number|null;
    /** @dartType double? */ readonly minRadius:number|null;
    /** @dartType double? */ readonly maxRadius:number|null;
    /** @dartParam radius double?
     * @dartParam minRadius double?
     * @dartParam maxRadius double? */
    constructor(options:CircleAvatarOptions={}) {
        super(options.key??null);this.child=options.child??null;this.backgroundColor=options.backgroundColor??null;
        this.foregroundColor=options.foregroundColor??null;this.backgroundImage=options.backgroundImage??null;this.foregroundImage=options.foregroundImage??null;
        this.onBackgroundImageError=options.onBackgroundImageError??null;this.onForegroundImageError=options.onForegroundImageError??null;
        this.radius=options.radius??null;this.minRadius=options.minRadius??null;this.maxRadius=options.maxRadius??null;
        invariant(this.radius===null||this.minRadius===null&&this.maxRadius===null,'ambiguous-avatar-radius','radius excludes minRadius/maxRadius');
        invariant(this.backgroundImage!==null||this.onBackgroundImageError===null,'missing-avatar-background','background error listener requires an image');
        invariant(this.foregroundImage!==null||this.onForegroundImageError===null,'missing-avatar-foreground','foreground error listener requires an image');
    }
    override build(context:BuildContext):Widget {
        MediaQuery.of(context);
        const theme=Theme.of(context),foreground=this.foregroundColor??materialSchemeColor(theme.colorScheme,'onPrimaryContainer');
        const style=theme.textTheme.titleMedium!.copyWith({color:foreground.toARGB32()});
        const defaultRadius=this.radius===null&&this.minRadius===null&&this.maxRadius===null;
        const min=defaultRadius?40:2*(this.radius??this.minRadius??0),max=defaultRadius?40:2*(this.radius??this.maxRadius??Infinity);
        return new AnimatedContainer({constraints:new BoxConstraints(min,max,min,max),duration:200,
            decoration:new BoxDecoration({color:(this.backgroundColor??materialSchemeColor(theme.colorScheme,'primaryContainer')).toARGB32(),shape:'circle',
                image:this.backgroundImage===null?null:new DecorationImage({image:this.backgroundImage,onError:this.onBackgroundImageError,fit:'cover'})}),
            foregroundDecoration:this.foregroundImage===null?null:new BoxDecoration({shape:'circle',image:new DecorationImage({image:this.foregroundImage,onError:this.onForegroundImageError,fit:'cover'})}),
            child:this.child===null?null:new Center(MediaQuery.withNoTextScaling({child:new IconTheme(theme.iconTheme.copyWith({color:foreground}),new DefaultTextStyle(style,this.child))}))});
    }
}
