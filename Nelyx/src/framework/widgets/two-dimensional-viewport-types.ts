// SPDX-License-Identifier: BSD-3-Clause
import {SourceTwoDimensionalViewport,SourceRenderTwoDimensionalViewport,SourceTwoDimensionalViewportParentData} from './two-dimensional-viewport.generated.ts';
import {ScrollPosition} from './scroll-position.ts';
export function isSourceTwoDimensionalViewport(v:unknown):v is SourceTwoDimensionalViewport{return v instanceof SourceTwoDimensionalViewport;}
export function castSourceTwoDimensionalViewport(v:unknown):SourceTwoDimensionalViewport{if(!isSourceTwoDimensionalViewport(v))throw new TypeError('Expected TwoDimensionalViewport');return v;}
export function isSourceRenderTwoDimensionalViewport(v:unknown):v is SourceRenderTwoDimensionalViewport{return v instanceof SourceRenderTwoDimensionalViewport;}
export function castSourceRenderTwoDimensionalViewport(v:unknown):SourceRenderTwoDimensionalViewport{if(!isSourceRenderTwoDimensionalViewport(v))throw new TypeError('Expected RenderTwoDimensionalViewport');return v;}
export function isSourceTwoDimensionalViewportParentData(v:unknown):v is SourceTwoDimensionalViewportParentData{return v instanceof SourceTwoDimensionalViewportParentData;}
export function castSourceTwoDimensionalViewportParentData(v:unknown):SourceTwoDimensionalViewportParentData{if(!isSourceTwoDimensionalViewportParentData(v))throw new TypeError('Expected TwoDimensionalViewportParentData');return v;}
export function isScrollPosition(v:unknown):v is ScrollPosition{return v instanceof ScrollPosition;}
export function castScrollPosition(v:unknown):ScrollPosition{if(!isScrollPosition(v))throw new TypeError('Expected ScrollPosition');return v;}
