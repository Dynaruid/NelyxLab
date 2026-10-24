// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Browser DOM contact for pinned engine platform_dispatcher/system_color_palette_detector.dart.
import {Color} from '@nelyx/core/ui/color';
import {bindSystemColorProvider} from '@nelyx/core/internal/ui/system-color-binding';
import type {Disposable} from '@nelyx/core/foundation/disposable';
const systemColorNames=["AccentColor","AccentColorText","ActiveText","ButtonBorder","ButtonFace","ButtonText","Canvas","CanvasText","Field","FieldText","GrayText","Highlight","HighlightText","LinkText","Mark","MarkText","SelectedItem","SelectedItemText","VisitedText"] as const;
export function parseSystemCssRgb(rgbString:string):Color|null{
    const rgb=rgbString.trim(),isRgb=rgb.startsWith('rgb('),isRgba=rgb.startsWith('rgba(');
    if((!isRgb&&!isRgba)||!rgb.endsWith(')'))return null;
    const values=rgb.slice(isRgb?4:5,-1).split(',').map(v=>v.trim());
    if(values.length!==(isRgb?3:4)||values.slice(0,3).some(v=>!/^[-+]?(?:\d+|0[xX][0-9a-fA-F]+)$/.test(v)))return null;
    const [r,g,b]=values.slice(0,3).map(value=>{const negative=value[0]==='-',unsigned=value.replace(/^[-+]/,'');return (negative?-1:1)*Number(unsigned);});
    if([r,g,b].some(v=>v===undefined||v<0||v>255))return null;
    if(isRgba&&!/^[+-]?(?:NaN|Infinity|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/.test(values[3]!))return null;
    const alpha=isRgb?1:Number(values[3]);
    if(alpha<0||alpha>1)return null;
    return Color.fromRGBO(r!,g!,b!,alpha);
}
export function installBrowserSystemColors(view:Window):Disposable{
    const palettes=new Map<'light'|'dark',ReadonlyMap<string,Color|null>>();
    return bindSystemColorProvider({color(brightness,name){
        let palette=palettes.get(brightness);
        if(!palette){
            const doc=view.document,host=doc.createElement('div'),detectors=new Map<string,HTMLElement>(),values=new Map<string,Color|null>();
            host.style.position='absolute';host.style.transform='translate(-10000px, -10000px)';host.style.setProperty('color-scheme',brightness);
            if(!doc.body)throw new Error('System color detection requires the actual View document body');
            try{
                doc.body.appendChild(host);
                for(const color of systemColorNames){const detector=doc.createElement('div');detector.style.backgroundColor=color;detector.innerText=color+' detector';host.appendChild(detector);detectors.set(color,detector);}
                const css=(view as Window&{readonly CSS:{supports(property:string,value:string):boolean}}).CSS;
                for(const [color,detector]of detectors)values.set(color,css.supports('color',color)?parseSystemCssRgb(view.getComputedStyle(detector).backgroundColor):null);
                palette=values;palettes.set(brightness,palette);
            }finally{host.remove();}
        }
        return palette.get(name)??null;
    }});
}
