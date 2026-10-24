// SPDX-License-Identifier: BSD-3-Clause
export interface AppAssetNotice {readonly path:string;readonly sha256?:string;}
export interface AppAsset {readonly id:string;readonly kind:'image'|'font';readonly path:string;readonly sha256?:string;readonly fontFamily?:string;readonly notice?:AppAssetNotice;readonly packageSource?:{readonly package:string;readonly path:string;readonly noticePath?:string};}
export interface ResolvedAppAsset extends AppAsset {readonly sha256:string;readonly notice?:AppAssetNotice & {readonly sha256:string};}
export interface VerifiedAppAsset extends ResolvedAppAsset {readonly file:string;readonly bytes:number;readonly notice?:AppAssetNotice & {readonly sha256:string;readonly file:string;readonly bytes:number};}
export function verifyAppAssets(projectRoot:string,assets:readonly AppAsset[]):readonly VerifiedAppAsset[];
export function copyAppNotices(projectRoot:string,assets:readonly AppAsset[],destination:string):readonly {readonly path:string;readonly sha256:string;readonly bytes:number}[];
export function materializeAppAssets(projectRoot:string,assets:readonly AppAsset[],resolveModule:(specifier:string)=>string):readonly VerifiedAppAsset[];
export function prepareAppAssetConfiguration(projectRoot:string,runnerRoot:string):{readonly name:string;readonly assets:readonly ResolvedAppAsset[]};
export interface AndroidFontAssetRecord {readonly id:string;readonly family:string;readonly sha256:string;readonly bytes:number;readonly file:string;}
export interface AndroidFontAssetManifest {readonly schema:'nelyx.android-font-assets/v1';readonly fonts:readonly AndroidFontAssetRecord[];}
export function copyAndroidFontAssets(projectRoot:string,assets:readonly AppAsset[],destination:string):AndroidFontAssetManifest;
