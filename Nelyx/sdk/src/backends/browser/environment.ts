// SPDX-License-Identifier: BSD-3-Clause
import type {ViewEnvironment} from '@nelyx/core/ui/types';
import {freezeEnvironment} from '@nelyx/core/ui/frame';
/** Visual viewport overlap is labelled as occlusion; it is not proof that an IME is open. */
export function createBrowserEnvironment(canvas:HTMLCanvasElement){
  const probe=document.createElement('div');probe.setAttribute('aria-hidden','true');
  probe.style.cssText='position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;';
  for(const side of ['top','right','bottom','left'])probe.style.setProperty('padding-'+side,`env(safe-area-inset-${side}, 0px)`,'important');
  canvas.parentElement!.appendChild(probe);
  return {read():ViewEnvironment{
    const css=getComputedStyle(probe),rect=canvas.getBoundingClientRect(),x=rect.width?canvas.clientWidth/rect.width:1,y=rect.height?canvas.clientHeight/rect.height:1;
    const clamp=(value:number,max:number)=>Math.max(0,Math.min(max,value));
    const value=(side:string)=>Number.parseFloat(css.getPropertyValue('padding-'+side))||0;
    const safeArea={top:clamp(value('top')-rect.top,rect.height)*y,right:clamp(rect.right-(window.innerWidth-value('right')),rect.width)*x,bottom:clamp(rect.bottom-(window.innerHeight-value('bottom')),rect.height)*y,left:clamp(value('left')-rect.left,rect.width)*x};
    const viewport=window.visualViewport;
    return freezeEnvironment({safeArea,safeAreaSource:CSS.supports('padding-top','env(safe-area-inset-top)')?'css':'application',keyboardInset:viewport?clamp(rect.bottom-(viewport.offsetTop+viewport.height),rect.height)*y:0,keyboardSource:viewport?'visual-viewport-occlusion':'unavailable',textScale:1,textScaleSource:'application'});
  },dispose(){probe.remove();}};
}
