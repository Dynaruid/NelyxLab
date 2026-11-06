// SPDX-License-Identifier: BSD-3-Clause
export const originalLayerFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {EngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {State,StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Stack,Padding,SizedBox,ColoredBox} from '@nelyx/core/framework/widgets/basic';
import {GestureDetector} from '@nelyx/core/framework/widgets/gesture-detector';
import {CompositedTransformTarget,CompositedTransformFollower} from '@nelyx/core/framework/widgets/composited-transform';
import {LayerLink,LeaderLayer,FollowerLayer} from '@nelyx/core/framework/rendering/layer';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {RenderFollowerLayer} from '@nelyx/core/framework/rendering/proxy-layer';
import {Alignment} from '@nelyx/core/framework/painting/alignment';
let context:EngineV2AppContext;
let live:DemoState|undefined;
const probe=(event:MessageEvent)=>{if(event.data?.kind==='probe-source-layer')live?.probe(event.data.id);};
class Demo extends StatefulWidget {createState(){return new DemoState();}}
class DemoState extends State<Demo> {
 readonly link=new LayerLink();readonly followerKey=new GlobalKey();left=30;linked=true;taps=0;
 override initState(){super.initState();live=this;}
 override dispose(){if(live===this)live=undefined;super.dispose();}
 probe(id:number){const render=this.followerKey.currentContext?.findRenderObject() as RenderFollowerLayer|undefined,layer=render?.layer;context.notify({kind:'layer-probe',id,leader:this.link.leader instanceof LeaderLayer,leaderSize:this.link.leaderSize,follower:layer instanceof FollowerLayer,transform:layer?.getLastTransform()??null,current:render?.getCurrentTransform()??null,linkedOffset:layer?.linkedOffset??null});}
 report(action:string){context.notify({kind:'link-state',action,left:this.left,linked:this.linked,taps:this.taps});}
 tap(){this.setState(()=>{this.taps++;if(this.taps===1)this.left=70;else this.linked=false;});this.report('tap');}
 restore(){this.setState(()=>{this.left=50;this.linked=true;});this.report('restore');}
 box(width:number,height:number,color:number){return new SizedBox(width,height,new ColoredBox({color}));}
 build(){return new Directionality('ltr',new Stack([
   this.linked?new Padding({left:this.left,top:30},new CompositedTransformTarget(this.box(80,40,0xff123456),{link:this.link})):new SizedBox(1,1),
   new Padding({left:220,top:160},new CompositedTransformFollower(new GestureDetector(this.box(40,20,0xffbb4466),{label:'Linked target',onTap:()=>this.tap()}),{key:this.followerKey,link:this.link,showWhenUnlinked:false,targetAnchor:Alignment.bottomRight,followerAnchor:Alignment.center,offset:{x:10,y:10}})),
   new Padding({left:30,top:240},new GestureDetector(this.box(80,40,0xff33aa77),{label:'Restore link',onTap:()=>this.restore()}))
 ],{textDirection:'ltr',alignment:Alignment.topLeft,fit:'loose',clipBehavior:'none'}));}
}
export default defineOriginalEngineV2App({build(ctx){context=ctx;return new Demo();},ready(){globalThis.addEventListener('message',probe);},dispose(){globalThis.removeEventListener('message',probe);}});`;
