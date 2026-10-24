import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PageRouteBuilder} from '@nelyx/core/framework/widgets/pages';
import {SizedBox,ColoredBox} from '@nelyx/core/framework/widgets/basic';
import {MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {BorderRadius} from '@nelyx/core/framework/painting/border-radius';
import {PredictiveBackEvent} from '@nelyx/core/services/predictive-back-event';
import {AnimationStatus} from '@nelyx/core/framework/animation/animation';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {PredictiveBackPageTransitionsBuilder,PredictiveBackFullscreenPageTransitionsBuilder} from '../dist/predictive-back-page-transitions-builder.js';
import {engineFixture} from './engine-fixture.mjs';
import {Motion} from './zoom-engine-fixture.mjs';
import {readSourcePixels,equalSourcePixels} from './zoom-source-reference.mjs';
import {paintOriginalPredictive} from './predictive-source-reference.mjs';
import {AnimatedOpacity} from '@nelyx/core/framework/widgets/implicit-animations';

const event=(progress,edge,y=80)=>PredictiveBackEvent.fromMap(new Map([['progress',progress],['swipeEdge',edge],['touchOffset',[100,y]]]));
const wrap=(row,child)=>new MediaQuery({width:240,height:640,scale:1,textScale:1,safeArea:{top:0,left:0,right:0,bottom:0},keyboardInset:0,displayCornerRadii:row.radius===null?null:BorderRadius.circular(row.radius)},new ColoredBox({color:0xffffffff,child}));
function all(f,predicate){const result=[];function visit(e){if(predicate(e.widget))result.push(e.widget);e.visitChildren(visit);}if(f.root.root)visit(f.root.root);return result;}
export async function comparePredictiveSource(fixture){
    FoundationPlatform.configure({kind:'web',operatingSystem:'android'});
    const f=await engineFixture(),actual=f.ck.MakeSurface(240,160),reference=f.ck.MakeSurface(240,160),ctors={};assert(actual&&reference);
    // The public builders mount the canonical private class once; no product test export is introduced.
    class GestureRoute extends PageRouteBuilder{get popGestureInProgress(){return true;}get isCurrent(){return true;}}
    const route=new GestureRoute({pageBuilder:()=>new SizedBox()}),leaf=new ColoredBox({color:0xffff0000,child:SizedBox.expand()}),first=new Motion(1,AnimationStatus.completed),zero=new Motion();let pixels=0,scenes=0;
    try{for(const [family,Builder,name]of [['shared',PredictiveBackPageTransitionsBuilder,'PredictiveBackSharedElementPageTransition'],['fullscreen',PredictiveBackFullscreenPageTransitionsBuilder,'PredictiveBackFullscreenPageTransition']]){f.set(wrap({radius:null},new Builder().buildTransitions(route,{},first,zero,leaf)));ctors[family]=all(f,w=>w.constructor.name===name)[0]?.constructor;assert(ctors[family]);f.set(new SizedBox());}assert.equal(first.values.length,0);assert.equal(first.statuses.length,0);
        const make=(row,a,s)=>{const clear=row.group!==undefined&&['commit','cancel'].includes(row.phase);return row.family==='shared'?new ctors.shared(true,a,s,row.phase,clear?null:event(.05,row.edge),clear?null:event(1-row.primary,row.edge,row.group===undefined?400:row.phase==='update'?(row.primary===.8?160:row.primary===.6?240:400):80),leaf):new ctors.fullscreen(a,s,()=>row.current,row.phase,leaf);};
        const compare=(row,label)=>{const commands=f.frame();actual.getCanvas().clear(f.ck.WHITE);f.library.replay(actual.getCanvas(),{commands});reference.getCanvas().clear(f.ck.WHITE);paintOriginalPredictive(f.ck,reference.getCanvas(),row.commands);try{equalSourcePixels(readSourcePixels(f.ck,actual),readSourcePixels(f.ck,reference),label);}catch(error){fs.mkdirSync('.tmp',{recursive:true});fs.writeFileSync('.tmp/predictive-cpu-difference.json',JSON.stringify({label,actual:commands,source:row.commands},null,2));throw error;}if(row.family==='fullscreen'){const opacity=all(f,w=>w instanceof AnimatedOpacity).at(-1);assert.equal(opacity.opacity,row.implicitTarget);assert.equal(opacity.duration,row.implicitDuration);}pixels+=38400;scenes++;};
        for(const row of fixture.rows){const a=new Motion(row.primary,AnimationStatus.reverse),s=new Motion(row.secondary,AnimationStatus.forward);f.set(wrap(row,make(row,a,s)));f.frame();compare(row,{id:row.id,family:row.family,phase:row.phase,primary:row.primary,secondary:row.secondary,current:row.current,edge:row.edge,radius:row.radius});f.set(new SizedBox());for(const m of [a,s]){assert.equal(m.values.length,0);assert.equal(m.statuses.length,0);}}
        for(const group of new Set(fixture.traces.map(r=>r.group))){const a=new Motion(1,AnimationStatus.completed),s=new Motion();let before=0;for(const row of fixture.traces.filter(r=>r.group===group)){f.elapse(row.now-before);before=row.now;a.set(row.primary,row.phase==='commit'?AnimationStatus.reverse:AnimationStatus.forward);s.set(row.secondary,AnimationStatus.forward);f.set(wrap(row,make(row,a,s)));f.frame();compare(row,{group,family:row.family,phase:row.phase,primary:row.primary,now:row.now,edge:row.edge,radius:row.radius,current:row.current});}f.set(new SizedBox());for(const m of [a,s]){assert.equal(m.values.length,0);assert.equal(m.statuses.length,0);}}
    }finally{actual.delete();reference.delete();f.set(new SizedBox());route.dispose();await f.close();}
    return {scenes,fullPixels:pixels,differences:0};
}
