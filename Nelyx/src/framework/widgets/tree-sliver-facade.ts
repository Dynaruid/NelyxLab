// SPDX-License-Identifier: BSD-3-Clause
// Bridge the existing immutable-ID API to the source library's private state.
import {SourceTreeSliverNode,SourceTreeSliverController} from './sliver-tree.generated.ts';
import {TreeSliverState} from './tree-sliver.ts';
import {Element} from './framework.ts';
import {registerFixedTreeExtent} from '../rendering/tree-sliver-source-adapter.ts';
export function treeFixedRowExtent(extent:number):()=>number{const builder=()=>extent;registerFixedTreeExtent(builder,extent);return builder;}
export function setTreeIdExpansion(node:SourceTreeSliverNode<string>,expanded:boolean):void{node._dart_8cfd46f68e2cffcc_expanded=node.children.length>0&&expanded;}
export function treeIdIndex(controller:SourceTreeSliverController,node:SourceTreeSliverNode<string>|undefined):number|null{
  const state=controller._dart_8cfd46f68e2cffcc_state;
  return node&&state instanceof TreeSliverState?state.indexForNode(node):null;
}
export function reconcileTreeIds(controller:SourceTreeSliverController):void{
  const state=controller._dart_8cfd46f68e2cffcc_state;
  if(!(state instanceof TreeSliverState)||!state.mounted||!(state.context as Element).active)return;
  state.setState(()=>{state._dart_8cfd46f68e2cffcc_unpackActiveNodes();state._dart_8cfd46f68e2cffcc_updateActiveAnimations();});
}
