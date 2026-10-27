// SPDX-License-Identifier: BSD-3-Clause
import {InheritedWidget,Element,StatelessWidget} from './framework.ts';
import {InheritedTheme} from './inherited-theme.ts';
import {InheritedModel} from './inherited-model.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import type {Insets} from '../../ui/geometry.ts';
import {allInsets} from '../../ui/geometry.ts';
import {TextScaler} from '../painting/text-scaler.ts';
import {markTraversalDirection} from './focus-traversal-context.ts';
import {DeviceGestureSettings} from '../gestures/gesture-settings.ts';
import type {BorderRadius} from '../painting/border-radius.ts';
import {EdgeInsets} from '../painting/edge-insets.ts';
import {invariant} from '../../foundation/errors.ts';
const defaultGestureSettings=new DeviceGestureSettings();
const mediaAspects={safeArea:Symbol('MediaQuery.safeArea'),padding:Symbol('MediaQuery.padding'),viewPadding:Symbol('MediaQuery.viewPadding'),viewInsets:Symbol('MediaQuery.viewInsets'),brightness:Symbol('MediaQuery.platformBrightness'),contrast:Symbol('MediaQuery.highContrast'),radii:Symbol('MediaQuery.displayCornerRadii'),text:Symbol('MediaQuery.textScaler'),scale:Symbol('MediaQuery.devicePixelRatio'),textMetrics:Symbol('MediaQuery.textMetrics'),gesture:Symbol('MediaQuery.gestureSettings'),navigation:Symbol('MediaQuery.navigationMode')};
export const NavigationMode=Object.freeze({traditional:'traditional',directional:'directional'} as const);
export type NavigationMode=typeof NavigationMode[keyof typeof NavigationMode];
export interface MediaData {readonly padding?:EdgeInsets;readonly viewPadding?:EdgeInsets;readonly viewInsets?:EdgeInsets;readonly displayCornerRadii?:BorderRadius|null;readonly platformBrightness?:'light'|'dark';readonly width:number;readonly height:number;readonly scale:number;readonly textScale:number;readonly textScaler?:TextScaler;readonly safeArea:Insets;readonly keyboardInset:number;readonly safeAreaSource?:'native'|'css'|'application';readonly keyboardSource?:'native-ime'|'visual-viewport-occlusion'|'unavailable';readonly textScaleSource?:'native'|'application';readonly accessibleNavigation?:boolean;readonly disableAnimations?:boolean;readonly invertColors?:boolean;readonly boldText?:boolean;readonly reduceMotion?:boolean;readonly highContrast?:boolean;readonly onOffSwitchLabels?:boolean;readonly supportsAnnounce?:boolean;readonly autoPlayAnimatedImages?:boolean;readonly autoPlayVideos?:boolean;readonly deterministicCursor?:boolean;readonly navigationMode?:NavigationMode;readonly gestureSettings?:DeviceGestureSettings}
export interface MediaQueryRemovePaddingOptions extends WidgetOptions {
  readonly context:BuildContext;readonly child:Widget;
  readonly removeLeft?:boolean;readonly removeTop?:boolean;readonly removeRight?:boolean;readonly removeBottom?:boolean;
}
export interface MediaQueryClampedTextScalingOptions extends WidgetOptions {
  readonly child:Widget;
  /** @dartType double */ readonly minScaleFactor?:number;
  /** @dartType double */ readonly maxScaleFactor?:number;
}
/** Legacy safeArea stores host view padding; keyboardInset is the host bottom occlusion. */
function mediaViewPadding(data:MediaData):EdgeInsets{return data.viewPadding??new EdgeInsets(data.safeArea.left,data.safeArea.top,data.safeArea.right,data.safeArea.bottom);}
function mediaViewInsets(data:MediaData):EdgeInsets{return data.viewInsets??EdgeInsets.only({bottom:data.keyboardInset});}
function mediaPadding(data:MediaData):EdgeInsets{
  if(data.padding)return data.padding;
  const view=mediaViewPadding(data),insets=mediaViewInsets(data);
  return new EdgeInsets(Math.max(0,view.left-insets.left),Math.max(0,view.top-insets.top),Math.max(0,view.right-insets.right),Math.max(0,view.bottom-insets.bottom));
}
function removeMediaPadding(data:MediaData,{removeLeft=false,removeTop=false,removeRight=false,removeBottom=false}:Omit<MediaQueryRemovePaddingOptions,'context'|'child'|'key'>):MediaData{
  if(!(removeLeft||removeTop||removeRight||removeBottom))return data;
  const padding=mediaPadding(data),view=mediaViewPadding(data),remaining=padding.copyWith({left:removeLeft?0:null,top:removeTop?0:null,right:removeRight?0:null,bottom:removeBottom?0:null});
  const viewPadding=view.copyWith({left:removeLeft?Math.max(0,view.left-padding.left):null,top:removeTop?Math.max(0,view.top-padding.top):null,right:removeRight?Math.max(0,view.right-padding.right):null,bottom:removeBottom?Math.max(0,view.bottom-padding.bottom):null});
  return {...data,padding:remaining,viewPadding,safeArea:{left:viewPadding.left,top:viewPadding.top,right:viewPadding.right,bottom:viewPadding.bottom}};
}
function mediaAspectData(context:BuildContext,aspect:symbol,lookup:typeof MediaQuery=MediaQuery):MediaData{
  // Keep existing inherited static-of overrides conservative. The canonical
  // MediaQuery supports every private aspect at its nearest provider.
  return lookup===MediaQuery?context.dependOn(MediaQuery,aspect).data:lookup.of(context);
}
function maybeMediaAspectData(context:BuildContext,aspect:symbol):MediaData|undefined{return context.maybeDependOn(MediaQuery,aspect)?.data;}
function equalMediaValue(a:unknown,b:unknown):boolean{return a===b||a!==null&&typeof a==='object'&&typeof (a as {equals?:unknown}).equals==='function'&&(a as {equals(other:unknown):boolean}).equals(b);}
function mediaAspectChanged(a:MediaData,b:MediaData,aspect:symbol):boolean{
  switch(aspect){
    case mediaAspects.safeArea:return (['left','top','right','bottom'] as const).some(side=>a.safeArea[side]!==b.safeArea[side]);
    case mediaAspects.padding:return !mediaPadding(a).equals(mediaPadding(b));
    case mediaAspects.viewPadding:return !mediaViewPadding(a).equals(mediaViewPadding(b));
    case mediaAspects.viewInsets:return !mediaViewInsets(a).equals(mediaViewInsets(b));
    case mediaAspects.brightness:return (a.platformBrightness??'light')!==(b.platformBrightness??'light');
    case mediaAspects.contrast:return (a.highContrast??false)!==(b.highContrast??false);
    case mediaAspects.radii:return !equalMediaValue(a.displayCornerRadii??null,b.displayCornerRadii??null);
    case mediaAspects.text:return !(a.textScaler??TextScaler.linear(a.textScale)).equals(b.textScaler??TextScaler.linear(b.textScale));
    case mediaAspects.scale:return a.scale!==b.scale;
    case mediaAspects.textMetrics:return a.scale!==b.scale||a.textScale!==b.textScale||a.textScaler!==b.textScaler||(a.boldText??false)!==(b.boldText??false);
    case mediaAspects.gesture:return !equalMediaValue(a.gestureSettings??defaultGestureSettings,b.gestureSettings??defaultGestureSettings);
    case mediaAspects.navigation:return (a.navigationMode??'traditional')!==(b.navigationMode??'traditional');
    default:return true;
  }
}
export class MediaQuery extends InheritedModel<symbol> {
  static withNoTextScaling(options:WidgetOptions&{readonly child:Widget}):Widget{return new MediaQueryNoTextScaling(options.child,options);}
  /** @dartParam minScaleFactor double
   * @dartParam maxScaleFactor double */
  static withClampedTextScaling(options:MediaQueryClampedTextScalingOptions):Widget {
    const min=options.minScaleFactor??0,max=options.maxScaleFactor??Infinity;
    invariant(Number.isFinite(min)&&min>=0&&!Number.isNaN(max)&&max>=min,'invalid-text-scaling-clamp','Invalid text scaling bounds');
    // The pinned source accepts key but does not apply it to its returned Builder.
    return new MediaQueryClampedTextScaling(options.child,min,max);
  }
  constructor(readonly data:MediaData,child:Widget,options:WidgetOptions={}){super(child,options.key??null);}
  /** @internal Raw host insets for adapters that preserve the safeArea contract. */
  static _safeAreaOf(context:BuildContext):Insets{return mediaAspectData(context,mediaAspects.safeArea,this).safeArea;}
  static paddingOf(context:BuildContext):EdgeInsets{return mediaPadding(mediaAspectData(context,mediaAspects.padding,this));}
  static viewPaddingOf(context:BuildContext):EdgeInsets{return mediaViewPadding(mediaAspectData(context,mediaAspects.viewPadding,this));}
  static viewInsetsOf(context:BuildContext):EdgeInsets{return mediaViewInsets(mediaAspectData(context,mediaAspects.viewInsets,this));}
  static maybePaddingOf(context:BuildContext):EdgeInsets|null{const data=maybeMediaAspectData(context,mediaAspects.padding);return data?mediaPadding(data):null;}
  static maybeViewPaddingOf(context:BuildContext):EdgeInsets|null{const data=maybeMediaAspectData(context,mediaAspects.viewPadding);return data?mediaViewPadding(data):null;}
  static maybeViewInsetsOf(context:BuildContext):EdgeInsets|null{const data=maybeMediaAspectData(context,mediaAspects.viewInsets);return data?mediaViewInsets(data):null;}
  static removePadding({context,child,key=null,...sides}:MediaQueryRemovePaddingOptions):MediaQuery{return new MediaQuery(removeMediaPadding(this.of(context),sides),child,{key});}
  static maybePlatformBrightnessOf(context:BuildContext):'light'|'dark'|null{const data=maybeMediaAspectData(context,mediaAspects.brightness);return data?data.platformBrightness??'light':null;}
  static maybeHighContrastOf(context:BuildContext):boolean|null{const data=maybeMediaAspectData(context,mediaAspects.contrast);return data?data.highContrast??false:null;}
  static of(context:BuildContext):MediaData{return context.dependOn(MediaQuery).data;}
  static displayCornerRadiiOf(context:BuildContext):BorderRadius|null{return mediaAspectData(context,mediaAspects.radii,this).displayCornerRadii??null;}
  static textScalerOf(context:BuildContext):TextScaler{const data=mediaAspectData(context,mediaAspects.text,this);return data.textScaler??TextScaler.linear(data.textScale);}
  static maybeTextScalerOf(context:BuildContext):TextScaler|null{const data=maybeMediaAspectData(context,mediaAspects.text);return data?data.textScaler??TextScaler.linear(data.textScale):null;}
  static devicePixelRatioOf(context:BuildContext):number{return mediaAspectData(context,mediaAspects.scale,this).scale;}
  static maybeDevicePixelRatioOf(context:BuildContext):number|null{return maybeMediaAspectData(context,mediaAspects.scale)?.scale??null;}
  /** @internal Section estimates observe typography; constraints supply their width. */
  static _maybeTextMetricsOf(context:BuildContext):Pick<MediaData,'scale'|'textScale'|'textScaler'|'boldText'>|null{return maybeMediaAspectData(context,mediaAspects.textMetrics)??null;}
  static maybeGestureSettingsOf(context:BuildContext):DeviceGestureSettings|null{const data=maybeMediaAspectData(context,mediaAspects.gesture);return data?data.gestureSettings??defaultGestureSettings:null;}
  static gestureSettingsOf(context:BuildContext):DeviceGestureSettings{return mediaAspectData(context,mediaAspects.gesture).gestureSettings??defaultGestureSettings;}
  static maybeNavigationModeOf(context:BuildContext):NavigationMode|null{const data=maybeMediaAspectData(context,mediaAspects.navigation);return data?data.navigationMode??'traditional':null;}
  static navigationModeOf(context:BuildContext):NavigationMode{return mediaAspectData(context,mediaAspects.navigation).navigationMode??'traditional';}
  updateShouldNotify(old:this):boolean{
    const oldCaptured=captureMediaData(old.data),captured=captureMediaData(this.data);
    const {textScaler:before,safeArea:oldSafe,padding:_oldPadding,viewPadding:_oldViewPadding,viewInsets:_oldViewInsets,...oldData}=oldCaptured;
    const {textScaler:after,safeArea:safe,padding:_padding,viewPadding:_viewPadding,viewInsets:_viewInsets,...data}=captured;
    return !(before??TextScaler.linear(old.data.textScale)).equals(after??TextScaler.linear(this.data.textScale))
      ||!mediaPadding(old.data).equals(mediaPadding(this.data))||!mediaViewPadding(old.data).equals(mediaViewPadding(this.data))||!mediaViewInsets(old.data).equals(mediaViewInsets(this.data))
      ||oldSafe.left!==safe.left||oldSafe.top!==safe.top||oldSafe.right!==safe.right||oldSafe.bottom!==safe.bottom||JSON.stringify(oldData)!==JSON.stringify(data)
      ||mediaAspectChanged(oldCaptured,captured,mediaAspects.radii)||mediaAspectChanged(oldCaptured,captured,mediaAspects.gesture);
  }
  updateShouldNotifyDependent(old:this,aspects:ReadonlySet<symbol>):boolean{for(const aspect of aspects)if(mediaAspectChanged(old.data,this.data,aspect))return true;return false;}
}
class MediaQueryNoTextScaling extends StatelessWidget {
  constructor(readonly child:Widget,options:WidgetOptions){super(options.key??null);}
  build(context:BuildContext):Widget {
    return new MediaQuery({...captureMediaData(MediaQuery.of(context)),textScale:1,textScaler:TextScaler.noScaling},this.child);
  }
}
// MediaData also permits class getters. Read those on their original receiver.
function captureMediaData(data:MediaData):MediaData {
    const projected={...data};
    for(const name of ['padding','viewPadding','viewInsets','displayCornerRadii','platformBrightness','width','height','scale','safeArea','keyboardInset',
      'safeAreaSource','keyboardSource','textScaleSource','accessibleNavigation','disableAnimations','invertColors','boldText','reduceMotion','highContrast',
      'onOffSwitchLabels','supportsAnnounce','autoPlayAnimatedImages','autoPlayVideos','deterministicCursor','navigationMode','gestureSettings','textScale','textScaler'] satisfies readonly (keyof MediaData)[])
      if(!Object.hasOwn(projected,name))Object.defineProperty(projected,name,{enumerable:true,value:data[name]});
    return projected;
}
class MediaQueryClampedTextScaling extends StatelessWidget {
  constructor(readonly child:Widget,readonly min:number,readonly max:number){super();}
  build(context:BuildContext):Widget {
    const data=captureMediaData(MediaQuery.of(context)),scaler=(data.textScaler??TextScaler.linear(data.textScale)).clamp({minScaleFactor:this.min,maxScaleFactor:this.max});
    return new MediaQuery({...data,textScale:scaler.textScaleFactor,textScaler:scaler},this.child);
  }
}
export class Directionality extends InheritedWidget {
  constructor(readonly direction:'ltr'|'rtl',child:Widget){super(child);markTraversalDirection(this,direction);}
  static of(context:BuildContext):'ltr'|'rtl'{return context.dependOn(Directionality).direction;}
  static maybeOf(context:BuildContext):'ltr'|'rtl'|null{return context.maybeDependOn(Directionality)?.direction??null;}
  updateShouldNotify(old:this):boolean{return old.direction!==this.direction;}
}
export interface AppThemeData {readonly background:number;readonly surface:number;readonly foreground:number;readonly accent:number;readonly onAccent?:number;readonly radius:number}
export const darkAppTheme:AppThemeData=Object.freeze({background:0xff101827,surface:0xff1e2c43,foreground:0xffe8eef8,accent:0xff64d8be,onAccent:0xff101827,radius:12});
export const lightAppTheme:AppThemeData=Object.freeze({background:0xfff5f8fc,surface:0xffe2eaf4,foreground:0xff153250,accent:0xff087f6c,onAccent:0xffffffff,radius:12});
export class AppTheme extends InheritedTheme {
  constructor(readonly data:AppThemeData,child:Widget){super(child);}
  static of(context:BuildContext):AppThemeData{return context.dependOn(AppTheme).data;}
  wrap(_context:BuildContext,child:Widget):Widget{return new AppTheme(this.data,child);}
  updateShouldNotify(old:this):boolean{return old.data!==this.data;}
}
export class Localizations extends InheritedWidget {
  constructor(readonly locale:string,readonly messages:Readonly<Record<string,Readonly<Record<string,string>>>>,readonly fallback:string,child:Widget){super(child);}
  static of(context:BuildContext):Localizations{return context.dependOn(Localizations);}
  text(key:string):string{return this.messages[this.locale]?.[key]??this.messages[this.locale.split('-')[0]!]?.[key]??this.messages[this.fallback]?.[key]??key;}
  updateShouldNotify(old:this):boolean{return old.locale!==this.locale||old.messages!==this.messages||old.fallback!==this.fallback;}
}
export function mediaFromView(context:BuildContext,textScale?:number):MediaData{const metrics=context.services.readMetrics(),environment=metrics.environment,binding=context instanceof Element?context.owner.maybeSemanticsBinding:undefined,features=binding?.accessibilityEnabled?binding.accessibilityFeatures:undefined;return {platformBrightness:context.services.platformServices?.environment?.brightness??'light',...(features?{accessibleNavigation:features.accessibleNavigation,invertColors:features.invertColors,disableAnimations:binding!.disableAnimations,boldText:features.boldText,reduceMotion:features.reduceMotion,highContrast:features.highContrast,onOffSwitchLabels:features.onOffSwitchLabels,supportsAnnounce:features.supportsAnnounce,autoPlayAnimatedImages:features.autoPlayAnimatedImages,autoPlayVideos:features.autoPlayVideos,deterministicCursor:features.deterministicCursor}:{}),width:metrics.logicalWidth,height:metrics.logicalHeight,scale:metrics.scale,textScale:textScale??environment?.textScale??1,safeArea:environment?.safeArea??allInsets(0),keyboardInset:environment?.keyboardInset??0,safeAreaSource:environment?.safeAreaSource??'application',keyboardSource:environment?.keyboardSource??'unavailable',textScaleSource:textScale===undefined?environment?.textScaleSource??'application':'application',gestureSettings:DeviceGestureSettings.fromView({devicePixelRatio:metrics.scale,gestureSettings:environment?.gestureSettings??{physicalTouchSlop:null}})};}
