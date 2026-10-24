// SPDX-License-Identifier: BSD-3-Clause
// Own bounded transition lifetime over canonical Route entries and Core tickers.
import type {RouteEntry,Route,NavigatorController} from './navigation.ts';
import type {BuildContext,Widget} from './framework.ts';
import type {TickerProvider} from '../animation/ticker.ts';
import {AnimationController} from '../animation/animation-controller.ts';
import {AnimationStatus} from '../animation/animation.ts';
import type {Animation} from '../animation/animation.ts';
import {ProxyAnimation,TrainHoppingAnimation,kAlwaysDismissedAnimation} from '../animation/animations.ts';
import {TickerCanceled} from '../animation/ticker-future.ts';
import type {RouteTransitionPolicy} from './route-transition-policy.ts';
import {invariant} from '../../foundation/errors.ts';
import {Builder,ColoredBox,SizedBox,Stack} from './basic.ts';
import {AnimatedBuilder} from './transitions.ts';
import {GestureDetector} from './gesture-detector.ts';
import {Semantics,BlockSemantics,ExcludeSemantics} from './semantics.ts';
import {Color} from '../../ui/color.ts';
import {Curves} from '../animation/curves.ts';
import {HitTestBehavior} from '../rendering/pointer-listener.ts';
import {FoundationPlatform} from '../../foundation/platform.ts';
import {Listenable} from '../../foundation/notifier.ts';
import {GlobalKey} from './global-key.ts';
import {RepaintBoundary} from './repaint-boundary.ts';
interface Motion {
    readonly policy:RouteTransitionPolicy;
    readonly primary:AnimationController;
    readonly secondary:ProxyAnimation;
    readonly changed:()=>void;
    readonly barrierId:string;
    readonly retirementListeners:Set<()=>void>;
    secondaryTarget:symbol|null;
    removeTrainHopping:(()=>void)|null;
}
let nextNavigationIdentity=0;
export class NavigationTransitions {
    private readonly identity=++nextNavigationIdentity;
    private nextBarrierIdentity=0;
    private live:readonly RouteEntry[]=[];
    private rendered:readonly RouteEntry[]=[];
    private readonly exiting=new Set<symbol>();
    private readonly motions=new Map<symbol,Motion>();
    private readonly pages=new Map<symbol,{readonly builder:RouteEntry['builder'];readonly widget:Widget}>();
    private readonly adjacencies=new Map<symbol,{readonly previous:Route|null;readonly next:Route|null}>();
    private readonly pendingRetirements=new Set<symbol>();
    private closed=false;
    constructor(private readonly vsync:TickerProvider,private readonly changed:()=>void,private readonly gesture:()=>boolean,private readonly canPopGesture:(token:symbol)=>boolean,private readonly reportError:(error:unknown)=>void,private readonly navigator:()=>NavigatorController){}
    reconcile(entries:readonly RouteEntry[],context:BuildContext,initial=false):void{
        invariant(!this.closed,'closed-route-transitions','Navigator transition owner is closed');
        const previous=this.live,oldRendered=this.rendered,nextTokens=new Set(entries.map(e=>e.token)),simplePop=previous.length===entries.length+1&&entries.every((e,i)=>previous[i]?.token===e.token);
        this.live=entries;
        // Retired routes keep their original keyed subtree until reverse finishes.
        for(const old of previous)if(!nextTokens.has(old.token)){
            const motion=this.motions.get(old.token);
            if(simplePop&&motion){this.exiting.add(old.token);entries.at(-1)?.route.didPopNext(old.route);void motion.primary.reverse().orCancel.catch(error=>{if(!(error instanceof TickerCanceled))this.reportError(error);});if(motion.primary.isDismissed)this.queueRetirement(old.token);}
            else this.release(old.token);
        }
        const fresh:Motion[]=[];
        for(const entry of entries){const policy=entry.route.transitionPolicy;if(!policy)continue;
            const existing=this.motions.get(entry.token);if(existing){invariant(existing.policy===policy,'route-policy-change','A retained route token cannot change transition owner');continue;}
            const primary=new AnimationController({vsync:this.vsync,value:initial||previous.length===0?1:0,duration:300,reverseDuration:300,debugLabel:'Navigator route '+entry.name}),secondary=new ProxyAnimation(kAlwaysDismissedAnimation),retirementListeners=new Set<()=>void>(),changed=()=>{if(primary.isDismissed&&this.exiting.has(entry.token))this.queueRetirement(entry.token);this.changed();};
            let attached=false;
            try{policy.attach({animation:primary,secondaryAnimation:secondary,context,navigator:this.navigator(),isCurrent:()=>this.live.at(-1)?.token===entry.token,isActive:()=>this.live.some(e=>e.token===entry.token),isFirst:()=>this.live[0]?.token===entry.token,popGestureInProgress:this.gesture,canPopGesture:()=>this.canPopGesture(entry.token),addRetirementListener:listener=>{retirementListeners.add(listener);return ()=>{retirementListeners.delete(listener);};}});attached=true;primary.duration=policy.transitionDuration(context);primary.reverseDuration=policy.reverseTransitionDuration(context);invariant([primary.duration,primary.reverseDuration].every(v=>v!==null&&Number.isFinite(v)&&v>=0),'invalid-route-duration','Route durations must be finite nonnegative milliseconds');primary.addStatusListener(changed);const motion:Motion={policy,primary,secondary,changed,retirementListeners,barrierId:'navigator-'+this.identity+'-barrier-'+(++this.nextBarrierIdentity),secondaryTarget:null,removeTrainHopping:null};this.motions.set(entry.token,motion);if(primary.value===0)fresh.push(motion);}
            catch(error){secondary.parent=null;primary.dispose();if(attached)try{policy.detach();}catch(cleanup){throw new AggregateError([error,cleanup],'Route transition admission failed');}throw error;}
        }
        const rendered=[...entries];
        for(const old of oldRendered)if(this.exiting.has(old.token)&&!nextTokens.has(old.token))rendered.splice(Math.min(oldRendered.indexOf(old),rendered.length),0,old);
        this.rendered=rendered;
        for(const motion of fresh)void motion.primary.forward().orCancel.catch(error=>{if(!(error instanceof TickerCanceled))this.reportError(error);});
        this.coordinate();
    }
    private coordinate():void{
        for(const [i,entry]of this.live.entries()){
            const nextEntry=this.live[i+1]??this.rendered.slice(this.rendered.findIndex(e=>e.token===entry.token)+1).find(e=>this.exiting.has(e.token));
            const previous=this.live[i-1]?.route??null,nextRoute=nextEntry?.route??null,old=this.adjacencies.get(entry.token);
            if(!old||old.previous!==previous)entry.route.didChangePrevious(previous);
            if(!old||old.next!==nextRoute)entry.route.didChangeNext(nextRoute);
            this.adjacencies.set(entry.token,{previous,next:nextRoute});
            const motion=this.motions.get(entry.token);if(!motion)continue;
            const next=nextEntry&&this.motions.get(nextEntry.token),allowed=next&&motion.policy.canTransitionTo(next.policy)&&next.policy.canTransitionFrom(motion.policy);
            this.updateSecondary(motion,allowed?nextEntry!.token:null,allowed?next.primary:null);
        }
    }
    private queueRetirement(token:symbol):void{
        if(this.closed||this.pendingRetirements.has(token))return;this.pendingRetirements.add(token);
        void Promise.resolve().then(()=>{this.pendingRetirements.delete(token);const motion=this.motions.get(token);if(this.closed||!this.exiting.has(token)||!motion||!motion.primary.isDismissed||motion.primary.isAnimating)return;this.release(token);this.rendered=this.rendered.filter(e=>e.token!==token);this.coordinate();this.changed();}).catch(this.reportError);
    }
    // Source TransitionRoute's train handoff over the existing canonical owner.
    // A newly pushed route can replace a still reversing secondary transition.
    private updateSecondary(motion:Motion,target:symbol|null,next:Animation<number>|null):void{
        if(motion.secondaryTarget===target)return;
        const previousRemover=motion.removeTrainHopping;motion.removeTrainHopping=null;motion.secondaryTarget=target;
        try{
            const current=motion.secondary.parent,currentTrain=current instanceof TrainHoppingAnimation?current.currentTrain:current;
            if(next===null){motion.secondary.parent=kAlwaysDismissedAnimation;return;}
            if(currentTrain===null||currentTrain.value===next.value||!next.isAnimating){motion.secondary.parent=next;return;}
            let hopping:TrainHoppingAnimation|null=null,removed=false;
            const remove=()=>{if(removed)return;removed=true;next.removeStatusListener(jumpOnEnd);hopping?.dispose();};
            const finish=()=>{if(this.closed||motion.removeTrainHopping!==remove)return;motion.secondary.parent=next;motion.removeTrainHopping=null;remove();};
            const jumpOnEnd=(status:AnimationStatus)=>{if(!status.isAnimating)finish();};
            motion.removeTrainHopping=remove;next.addStatusListener(jumpOnEnd);
            hopping=new TrainHoppingAnimation(currentTrain,next,{onSwitchedTrain:finish});motion.secondary.parent=hopping;
        }finally{previousRemover?.();}
    }
    get entries():readonly RouteEntry[]{return this.rendered;}
    page(entry:RouteEntry):Widget{let page=this.pages.get(entry.token);if(!page||page.builder!==entry.builder){page={builder:entry.builder,widget:new Builder(context=>new RepaintBoundary(entry.route.transitionPolicy?.buildPage(context)??entry.builder(context)),{key:new GlobalKey()})};this.pages.set(entry.token,page);}return page.widget;}
    firstVisibleIndex():number{
        for(let i=this.rendered.length-1;i>=0;i--){const entry=this.rendered[i]!,motion=this.motions.get(entry.token);if(entry.opaque&&(!motion||motion.primary.status===AnimationStatus.completed&&!motion.primary.isAnimating&&!this.exiting.has(entry.token)))return i;}
        return 0;
    }
    wrap(entry:RouteEntry,context:BuildContext,child:Widget,onDismiss:()=>void):Widget{
        const motion=this.motions.get(entry.token);if(!motion)return child;
        const policy=motion.policy,dismissible=policy.barrierDismissible&&this.live.at(-1)?.token===entry.token,semanticsDismissible=dismissible&&['android','iOS','macOS'].includes(FoundationPlatform.defaultTargetPlatform),action=semanticsDismissible&&policy.barrierLabel!==null?onDismiss:null;
        const semantics=new Semantics({transportId:motion.barrierId,label:semanticsDismissible?policy.barrierLabel:null,onTap:action,onDismiss:action,child:new GestureDetector(SizedBox.expand(),{behavior:HitTestBehavior.opaque,...(dismissible?{onTap:onDismiss}:{})})});
        const barrier=new AnimatedBuilder({animation:motion.primary,child:new BlockSemantics({child:new ExcludeSemantics({excluding:!semanticsDismissible,child:semantics})}),builder:(_context,child)=>new ColoredBox({color:Color.lerp(null,policy.barrierColor,Curves.ease.transform(motion.primary.value))?.toARGB32()??0,child})});
        const transitions=new AnimatedBuilder({animation:Listenable.merge([motion.primary,motion.secondary]),child,builder:(context,child)=>motion.policy.buildTransitions(context,motion.primary,motion.secondary,child!)});
        return new Stack([barrier,transitions]);
    }
    private release(token:symbol):void{
        this.exiting.delete(token);this.pages.delete(token);this.adjacencies.delete(token);this.pendingRetirements.delete(token);const motion=this.motions.get(token);if(!motion)return;this.motions.delete(token);
        const errors:unknown[]=[];
        for(const listener of [...motion.retirementListeners])try{listener();}catch(error){errors.push(error);}motion.retirementListeners.clear();
        for(const other of this.motions.values())if(other.secondaryTarget===token)try{other.secondary.parent=kAlwaysDismissedAnimation;other.secondaryTarget=null;const remove=other.removeTrainHopping;other.removeTrainHopping=null;remove?.();}catch(error){errors.push(error);}
        for(const cleanup of [()=>motion.primary.removeStatusListener(motion.changed),()=>{motion.secondary.parent=null;},()=>{const remove=motion.removeTrainHopping;motion.removeTrainHopping=null;remove?.();},()=>motion.policy.detach(),()=>motion.primary.dispose()])try{cleanup();}catch(error){errors.push(error);}
        if(errors.length)throw new AggregateError(errors,'Route transition retirement failed');
    }
    dispose():void{if(this.closed)return;this.closed=true;const errors:unknown[]=[];for(const token of [...this.motions.keys()])try{this.release(token);}catch(error){errors.push(error);}this.live=[];this.rendered=[];this.pages.clear();this.adjacencies.clear();this.pendingRetirements.clear();if(errors.length)throw new AggregateError(errors,'Navigator transition teardown failed');}
}
