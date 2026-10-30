import type { AssetRef } from '@nelyx/core/foundation/assets';
import type { PlatformId } from '@nelyx/core/hosting/platform';

export interface AppAssetNotice { readonly path: string; readonly sha256?: string }
export interface AppPackageAssetSource {readonly package:string;readonly path:string;readonly noticePath?:string}
export interface AppAsset extends Omit<AssetRef, 'sha256'> { readonly path: string; readonly sha256?: string; readonly fontFamily?: string; readonly notice?: AppAssetNotice;readonly packageSource?:AppPackageAssetSource }
/** Runtime metadata produced from actual asset bytes by runner preparation. */
export interface ResolvedAppAsset extends AppAsset { readonly sha256: string; readonly notice?: AppAssetNotice & {readonly sha256:string} }
export interface AppTarget { readonly profile?: string; readonly cohort?: string; readonly component: string }
export interface NelyxConfig {
  readonly schema: 'nelyx.app/v2';
  readonly name: string;
  readonly displayName?: string;
  readonly appEntry: string;
  readonly assets: readonly AppAsset[];
  readonly targets: Readonly<Partial<Record<PlatformId, AppTarget>>>;
}
function localPath(value: string): void {
  if (typeof value !== 'string' || !/^\.\/[a-zA-Z0-9_./-]+$/.test(value) || value.slice(2).split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Invalid app-relative path: ${value}`);
}
function defineAssets(value:unknown):readonly AppAsset[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error('App assets must be an array of at most 64 references');
  const ids = new Set<string>();
  const assets = (value as AppAsset[]).map(asset => {
    if (!asset || typeof asset.id !== 'string' || !asset.id || ids.has(asset.id) || (asset.sha256 !== undefined && (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256))) || !['font', 'image'].includes(asset.kind) || (asset.kind === 'font' && (typeof asset.fontFamily !== 'string' || !asset.fontFamily))) throw new Error(`Invalid/duplicate app asset: ${asset?.id}`);
    ids.add(asset.id); localPath(asset.path);
    if (asset.notice !== undefined) {
      if (!asset.notice || (asset.notice.sha256 !== undefined && (typeof asset.notice.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.notice.sha256)))) throw new Error(`Invalid asset notice: ${asset.id}`);
      localPath(asset.notice.path);
      if (asset.notice.path === asset.path) throw new Error(`Asset notice must be a separate file: ${asset.id}`);
    }
    if(asset.packageSource!==undefined){const source=asset.packageSource;if(!source||Object.keys(source).some(k=>!['package','path','noticePath'].includes(k))||! /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(source.package))throw new Error(`Invalid package asset source: ${asset.id}`);localPath(source.path);if(source.noticePath!==undefined)localPath(source.noticePath);if((asset.notice!==undefined)!==(source.noticePath!==undefined))throw new Error(`Package asset notice must have both source and destination: ${asset.id}`);}
    return Object.freeze({ ...asset, ...(asset.notice ? {notice: Object.freeze({...asset.notice})} : {}),...(asset.packageSource?{packageSource:Object.freeze({...asset.packageSource})}:{}) });
  });
  return Object.freeze(assets);
}
/** Validate generated runtime metadata; user configuration needs no hashes. */
export function defineAssetManifest(value:unknown):readonly ResolvedAppAsset[] {
  return Object.freeze(defineAssets(value).map(asset=>{
    const {notice,...reference}=asset;
    if(reference.sha256===undefined||notice&&notice.sha256===undefined)throw new Error('Prepare runner assets before registration: '+asset.id);
    return Object.freeze({...reference,sha256:reference.sha256,...(notice?{notice:Object.freeze({...notice,sha256:notice.sha256!})}:{})});
  }));
}
/** Validate JSON configuration, including the `nelyx` field in an application package.json. */
export function defineConfig(configuration: unknown): NelyxConfig {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) throw new Error('Application package.json requires an nelyx configuration object');
  const value = configuration as NelyxConfig;
  if (value.schema !== 'nelyx.app/v2') throw new Error('Removed app schema; migrate to nelyx.app/v2 with an RN component, cohort and explicit RN profile. Deno/raw config cannot be aliased.');
  if (typeof value.name !== 'string' || !/^[A-Z][A-Za-z0-9]*$/.test(value.name)) throw new Error('Invalid app schema/name');
  // oxlint-disable-next-line no-control-regex -- Control code points are deliberately matched for input validation or normalization.
  if (value.displayName !== undefined && (typeof value.displayName !== 'string' || !value.displayName.trim() || /[\u0000-\u001f]/.test(value.displayName))) throw new Error('Invalid app displayName');
  if (!value.targets || typeof value.targets !== 'object' || Array.isArray(value.targets)) throw new Error('App targets must be an object');
  localPath(value.appEntry);
  const assets=defineAssets(value.assets);
  const targets: Partial<Record<PlatformId, AppTarget>> = {};
  for (const [target, settings] of Object.entries(value.targets)) {
    if (!['web', 'ios', 'android', 'windows', 'macos', 'linux'].includes(target) || !settings || typeof settings !== 'object' || Array.isArray(settings) || (settings.profile!==undefined && (typeof settings.profile !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(settings.profile)))) throw new Error(`Invalid configured target: ${target}`);
    if(Object.keys(settings).some(key=>!['profile','cohort','component'].includes(key)))throw new Error(`Unknown target setting: ${target}`);
    if(settings.profile==='wgl'||settings.profile?.startsWith('raw-'))throw new Error('Removed Deno/raw profile; use an independent RN runner and RN component/profile in nelyx.app/v2');
    if(settings.cohort!==undefined&&(typeof settings.cohort !== 'string'||!/^[a-z0-9][a-z0-9.-]*$/.test(settings.cohort)))throw new Error('Invalid target cohort');
    if(target==='web' && settings.profile!==undefined && settings.profile!=='ganesh-webgl2')throw new Error('Unsupported Web profile; migrate canvaskit-webgl to ganesh-webgl2');
    if (settings.component) localPath(settings.component);
    if (!settings.component) throw new Error(`Missing component for ${target}`);
    targets[target as PlatformId] = Object.freeze({ ...settings });
  }
  if (!Object.keys(targets).length) throw new Error('App requires at least one target');
  return Object.freeze({ ...value, assets: Object.freeze(assets), targets: Object.freeze(targets) });
}
/** Migration is explicit: no raw host, profile, artifact or evidence aliases are installed. */
export function migrateConfig(value:unknown):NelyxConfig {
  if(!value||typeof value!=='object'||!('schema' in value)||value.schema!=='nelyx.app/v2')throw new Error('Removed nelyx.app/v1 config; declare nelyx.app/v2, an RN component and RN profile/cohort. Existing Deno startup and qualification cannot be reused.');
  return defineConfig(value as NelyxConfig);
}
