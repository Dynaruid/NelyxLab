import {installAutofillMessages} from '../../runtime/autofill.ts';
// SPDX-License-Identifier: BSD-3-Clause
import type {AppLifecycleState} from '@nelyx/core/services/binding';
import type {ReactNativePlatform} from '@nelyx/core/hosting/platform';
import {PlatformException,MissingPluginException,MethodCall} from '@nelyx/core/services/message-codec';
import {JSONMethodCodec} from '@nelyx/core/services/message-codecs';
import {FlutterError} from '@nelyx/core/foundation/flutter-error';
import {FlutterErrorDetails} from '@nelyx/core/foundation/assertions';
import {PluginPlatformMessagePort} from '../../runtime/plugin-port.ts';
import {installOsServices} from '../../runtime/os-services.ts';
import type {ReactNativeAppStatePort} from './lifecycle.ts';
import {nativeLocaleModule,readNativeLocales} from './locales.ts';
import {installNativeKeyboardState} from './keyboard-state.ts';
import {installNativeMouseCursor} from './mouse-cursor.ts';
import type {NativeMouseCursorPort} from './mouse-cursor.ts';
import {installNativeAccessibility} from './accessibility.ts';
import type {NativeAccessibilityView} from './accessibility.ts';
import {installNativeRestoration} from './restoration.ts';
import {readNativeAccessibilityFeatures} from './accessibility-features.ts';

type NativeServices=Pick<typeof import('react-native'),'Clipboard'|'Appearance'|'PixelRatio'|'Dimensions'|'NativeModules'|'AppState'|'BackHandler'>&Partial<Pick<typeof import('react-native'),'Linking'>>;
const backOwners=new WeakMap<object,PluginPlatformMessagePort>();
/** Public RN modules dispatch to each platform's actual OS implementation. */
export function createReactNativePlatformMessages(native:NativeServices,target:ReactNativePlatform,visibility:ReactNativeAppStatePort=native.AppState,cursor?:NativeMouseCursorPort,accessibility?:NativeAccessibilityView,restoration?:{readonly key:string},accessibilityEnabled=true):PluginPlatformMessagePort {
  const port=new PluginPlatformMessagePort();
  installAutofillMessages(port,target,native.NativeModules.NelyxPlatformServices,accessibility);
  if(restoration&&(target==='windows'||target==='android'))installNativeRestoration(port,native.NativeModules.NelyxPlatformServices,restoration.key);
  let linking:{remove():void}|undefined,linksLive=true,linkEpoch=0,linkingModule:NativeServices['Linking'];
  let stopLinkRead!:()=>void;const linkReadsClosed=new Promise<null>(resolve=>{stopLinkRead=()=>resolve(null);});
  try{linkingModule=native.Linking;}catch{/* A missing optional native module exposes no deep-link capability. */}
  const initialRoute=()=>{
    const module=target==='windows'?native.NativeModules.NelyxPlatformServices as {getNavigationProtocol?:()=>number;getInitialRouteInformation?:()=>PromiseLike<string|null>}|undefined:undefined;
    if(module?.getNavigationProtocol!==undefined||module?.getInitialRouteInformation!==undefined){
      if(typeof module.getNavigationProtocol!=='function'||module.getNavigationProtocol()!==1||typeof module.getInitialRouteInformation!=='function')throw new PlatformException({code:'native-navigation-cohort',message:'Navigation protocol1 requires matching rebuilt Windows SDK sources'});
      const operation=module.getInitialRouteInformation();if(!operation||typeof operation.then!=='function')throw new TypeError('Native initial route requires an acknowledgement');return operation;
    }
    return linkingModule?.getInitialURL();
  };
  const releaseLinks=()=>{linkEpoch++;const old=linking;linking=undefined;old?.remove();};
  port.onListening((channel,listening)=>{
    if(channel!=='flutter/navigation')return;releaseLinks();
    if(listening&&linksLive&&linkingModule){const codec=new JSONMethodCodec(),epoch=linkEpoch;linking=linkingModule.addEventListener('url',event=>{
      if(!linksLive||!linking||epoch!==linkEpoch)return;
      void port.emit('flutter/navigation',codec.encodeMethodCall(new MethodCall('pushRouteInformation',new Map<string,unknown>([['uri',event.url],['state',null]])))).catch(exception=>{if(linksLive)FlutterError.reportError(new FlutterErrorDetails({exception,library:'SDK deep links'}));});
    });}
  });
  port.onStop(()=>{linksLive=false;stopLinkRead();releaseLinks();});port.own({dispose:releaseLinks});
  const feedback=async(kind:'sound'|'haptic',type:string|null)=>{
    if(!accessibility?.isLive())return;
    const rootTag=accessibility.rootTag();if(rootTag===null)return;
    const module=native.NativeModules.NelyxPlatformServices as {getFeedbackProtocol?:()=>number;dispatchPlatformFeedback?:(rootTag:number,kind:string,type:string|null)=>PromiseLike<boolean>}|undefined;
    if(typeof module?.getFeedbackProtocol!=='function'||module.getFeedbackProtocol()!==1||typeof module.dispatchPlatformFeedback!=='function')throw new PlatformException({code:'native-feedback-cohort',message:'Feedback protocol1 requires matching rebuilt SDK native sources'});
    const operation=module.dispatchPlatformFeedback(rootTag,kind,type);if(!operation||typeof operation.then!=='function')throw new TypeError('Native feedback requires an acknowledgement');
    if(typeof await operation!=='boolean')throw new TypeError('Invalid native feedback acknowledgement');
  };
  installNativeKeyboardState(port,native.NativeModules,target);
  if(cursor)installNativeMouseCursor(port,cursor);
  if(accessibilityEnabled&&accessibility)installNativeAccessibility(port,native.NativeModules,target,accessibility);
  let clipboard:NativeServices['Clipboard']|undefined;if(target!=='windows')try{clipboard=native.Clipboard;}catch{/* Missing native clipboard is an unavailable capability. */}
  const windows=native.NativeModules.NelyxPlatformServices as {getClipboardText?:()=>PromiseLike<string>;setClipboardText?:(text:string)=>PromiseLike<void>}|undefined;
  if(target==='windows'&&(typeof windows?.getClipboardText!=='function'||typeof windows.setClipboardText!=='function'))throw new PlatformException({code:'native-clipboard-cohort',message:'Windows requires the SDK acknowledged clipboard native port; rebuild the host with matching SDK sources'});
  const nativeClipboard=clipboard,read=target==='windows'||typeof nativeClipboard?.getString==='function',write=target==='windows'||read&&typeof nativeClipboard?.setString==='function';
  const readText=async()=>{const value=await(target==='windows'?windows!.getClipboardText!():nativeClipboard!.getString());if(typeof value!=='string')throw new PlatformException({code:'platform-error',message:'Native clipboard returned non-text'});return value;};
  const linuxHost=(globalThis as unknown as {NelyxLinuxHost?:unknown}).NelyxLinuxHost;
  const preferred=nativeLocaleModule(native.NativeModules.NelyxPlatformServices??(target==='linux'?linuxHost:undefined));
  const nativePop=typeof preferred?.popSystemNavigator==='function'?(animated:boolean|null)=>preferred.popSystemNavigator!(animated??false):undefined;
  let back:{remove():void}|undefined,backRevision=0,backLive=true;
  const releaseBack=()=>{backRevision++;back?.remove();back=undefined;if(backOwners.get(native.BackHandler)===port)backOwners.delete(native.BackHandler);};
  const setBack=(enabled:boolean)=>{
    if(!enabled){releaseBack();return;}
    if(!backLive)throw new PlatformException({code:'closed-owner',message:'Back handler owner is closing'});
    const previous=backOwners.get(native.BackHandler);if(previous&&previous!==port)throw new PlatformException({code:'back-owner-conflict',message:'Another application owns system Back'});
    if(back)return;backOwners.set(native.BackHandler,port);
    const codec=new JSONMethodCodec();
    try{back=native.BackHandler.addEventListener('hardwareBackPress',()=>{if(!backLive||!back||backOwners.get(native.BackHandler)!==port)return false;const revision=backRevision;void port.emit('flutter/navigation',codec.encodeMethodCall(new MethodCall('popRoute'))).then(response=>{if(!backLive||revision!==backRevision||backOwners.get(native.BackHandler)!==port)return;const handled=response===null?false:codec.decodeEnvelope(response);if(typeof handled!=='boolean')throw new TypeError('Navigation popRoute must return a boolean');if(!handled)native.BackHandler.exitApp();}).catch(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'SDK system navigation'})));return true;});}catch(error){if(backOwners.get(native.BackHandler)===port)backOwners.delete(native.BackHandler);throw error;}
  };
  port.onListening((channel,listening)=>{if(channel==='flutter/navigation'&&!listening)releaseBack();});
  // Back is host ingress: block it synchronously before pending plugin drain.
  port.onStop(()=>{backLive=false;releaseBack();});
  port.own({dispose(){backLive=false;releaseBack();}});
  const locale=():{locales:readonly string[]|null;localeSource:'native'|'runtime'|'unavailable'}=>{
    if(preferred){const locales=readNativeLocales(preferred);return {locales,localeSource:locales?'native':'unavailable'};}
    const settings=native.NativeModules.SettingsManager?.getConstants?.()?.settings??native.NativeModules.SettingsManager?.settings;
    const identifier=native.NativeModules.I18nManager?.getConstants?.()?.localeIdentifier;
    const constants:unknown=settings?.AppleLanguages??(typeof identifier==='string'?[identifier.replaceAll('_','-')]:undefined);
    if(Array.isArray(constants)&&constants.length&&constants.every(item=>typeof item==='string'))return {locales:[...constants],localeSource:'native'};
    // Hermes Intl provides the runtime's effective locale, not a preferred OS list.
    try{const value=Intl.DateTimeFormat().resolvedOptions().locale;if(value)return {locales:[value],localeSource:'runtime'};}catch{}
    return {locales:null,localeSource:'unavailable'};
  };
  const lifecycle=():AppLifecycleState|null=>{if(!visibility.isAvailable)return null;switch(visibility.currentState){case 'active':return 'resumed';case 'background':return 'paused';case 'inactive':return 'inactive';default:return null;}};
  const accessibilityFeatures=()=>accessibilityEnabled?readNativeAccessibilityFeatures(native.NativeModules.NelyxPlatformServices,target):undefined;
  installOsServices(port,{
    ...(target==='android'?{playSystemSound:(type:string)=>feedback('sound',type),vibrateHapticFeedback:(type:string|null)=>feedback('haptic',type)}:{}),
    readEnvironment(){const brightness=native.Appearance.getColorScheme(),accessibility=accessibilityFeatures();return {...locale(),...(accessibility?{accessibility}:{}),localeObservation:preferred?'poll':'resume',brightness:brightness==='light'||brightness==='dark'?brightness:null,lifecycle:lifecycle(),textScale:native.PixelRatio.getFontScale(),capabilities:{clipboardRead:read?'available':'unavailable',clipboardWrite:write?'available':'unavailable',navigation:target==='android'||nativePop?'available':'unavailable'}};},
    observe(changed,memoryPressure,failed){
      const subscriptions:{remove():void}[]=[];
      let observing=true;const update=()=>{if(observing)changed();};
      try {
        subscriptions.push(native.Appearance.addChangeListener(update));
        subscriptions.push(native.Dimensions.addEventListener('change',update));
        if(visibility.isAvailable)subscriptions.push(visibility.addEventListener('change',update));
        if(native.AppState.isAvailable)subscriptions.push(native.AppState.addEventListener('memoryWarning',()=>{if(observing)memoryPressure();}));
        // Preferred-language APIs do not expose a uniform RN event. Re-read
        // actual OS snapshots only while this owner has environment listeners.
        const poll=Boolean(preferred)||(accessibilityEnabled&&(target==='android'||target==='windows'));
        const observed=()=>JSON.stringify({locales:preferred?locale():undefined,accessibility:accessibilityFeatures()});
        let previous=poll?observed():undefined;
        let previousError:string|undefined;
        const polling=poll?setInterval(()=>{if(!observing)return;try{const next=observed(),recovered=previousError!==undefined;previousError=undefined;if(recovered||next!==previous){previous=next;update();}}catch(error){const signature=String(error);if(signature!==previousError){previousError=signature;failed(error);}}},1000):undefined;
        return {dispose(){observing=false;if(polling!==undefined)clearInterval(polling);const errors:unknown[]=[];for(const subscription of subscriptions)try{subscription.remove();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Native services observer cleanup failed');}};
      }catch(error){observing=false;const errors:unknown[]=[error];for(const subscription of subscriptions)try{subscription.remove();}catch(cleanup){errors.push(cleanup);}if(errors.length>1)throw new AggregateError(errors,'Native services observer initialization failed');throw error;}
    },
    ...(read?{readText,hasStrings:async()=>(await readText()).length>0}:{}),
    ...(write?{writeText:async(text:string)=>{if(target==='windows')await windows!.setClipboardText!(text);else{nativeClipboard!.setString(text);await readText();/* Ordered native read acknowledges the queued write before drain. */}}}:{}),
    ...(target==='android'?{pop:nativePop??(()=>{native.BackHandler.exitApp();})}:nativePop?{pop:nativePop}:{}),
    ...(target==='android'?{setFrameworkHandlesBack:setBack}:{}),
    // Pinned SystemNavigator history methods are ignored on non-Web targets.
    async navigation(method){if(method==='getRouteInformation'){const uri=await Promise.race([initialRoute(),linkReadsClosed]);if(uri!==null&&uri!==undefined&&typeof uri!=='string')throw new TypeError('Native initial URL must be a string');return uri?new Map<string,unknown>([['uri',uri],['state',null]]):null;}if(['selectSingleEntryHistory','selectMultiEntryHistory','routeInformationUpdated'].includes(method))return null;throw new MissingPluginException();},
  });
  return port;
}
