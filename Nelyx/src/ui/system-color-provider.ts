// SPDX-License-Identifier: BSD-3-Clause
// Borrowed embedding contact for dart:ui SystemColor's realm-owned palettes.
import type {Color} from './color.ts';
import type {Disposable} from '../foundation/disposable.ts';
export interface SystemColorProvider {color(brightness:'light'|'dark',name:string):Color|null;}
const providers:{readonly provider:SystemColorProvider}[]=[];
export function bindSystemColorProvider(provider:SystemColorProvider):Disposable{
    const entry={provider};providers.push(entry);let live=true;
    return {dispose(){if(!live)return;live=false;const index=providers.indexOf(entry);if(index>=0)providers.splice(index,1);}};
}
export function currentSystemColorProvider():SystemColorProvider|null{return providers.at(-1)?.provider??null;}
