import type { AssetRef } from '@nelyx/core/foundation/assets';

export interface AppAssetNotice {
  readonly path: string;
  readonly sha256?: string;
}
export interface AppPackageAssetSource {
  readonly package: string;
  readonly path: string;
  readonly noticePath?: string;
}
export interface AppAsset extends Omit<AssetRef, 'sha256'> {
  readonly path: string;
  readonly sha256?: string;
  readonly fontFamily?: string;
  readonly notice?: AppAssetNotice;
  readonly packageSource?: AppPackageAssetSource;
}
/** Runtime metadata produced from actual asset bytes by runner preparation. */
export interface ResolvedAppAsset extends AppAsset {
  readonly sha256: string;
  readonly notice?: AppAssetNotice & { readonly sha256: string };
}
export interface PwaIcon {
  readonly src: string;
  readonly sizes: '192x192' | '512x512';
  readonly type: 'image/png';
  readonly purpose?: 'any' | 'maskable' | 'any maskable';
}
export interface PwaConfig {
  readonly component: string;
  readonly id: string;
  readonly shortName: string;
  readonly themeColor: string;
  readonly icons?: readonly PwaIcon[];
}
export interface NelyxConfig {
  readonly schema: 'nelyx.app/v3';
  readonly name: string;
  readonly displayName?: string;
  readonly appEntry: string;
  readonly assets: readonly AppAsset[];
  readonly pwa: PwaConfig;
}
function localPath(value: string): void {
  if (
    typeof value !== 'string' ||
    !/^\.\/[a-zA-Z0-9_./-]+$/.test(value) ||
    value
      .slice(2)
      .split('/')
      .some((part) => !part || part === '.' || part === '..')
  )
    throw new Error(`Invalid app-relative path: ${value}`);
}
function defineAssets(value: unknown): readonly AppAsset[] {
  if (!Array.isArray(value) || value.length > 64)
    throw new Error('App assets must be an array of at most 64 references');
  const ids = new Set<string>();
  const assets = (value as AppAsset[]).map((asset) => {
    if (
      !asset ||
      typeof asset.id !== 'string' ||
      !asset.id ||
      ids.has(asset.id) ||
      (asset.sha256 !== undefined &&
        (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256))) ||
      !['font', 'image'].includes(asset.kind) ||
      (asset.kind === 'font' && (typeof asset.fontFamily !== 'string' || !asset.fontFamily))
    )
      throw new Error(`Invalid/duplicate app asset: ${asset?.id}`);
    ids.add(asset.id);
    localPath(asset.path);
    if (asset.notice !== undefined) {
      if (
        !asset.notice ||
        (asset.notice.sha256 !== undefined &&
          (typeof asset.notice.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.notice.sha256)))
      )
        throw new Error(`Invalid asset notice: ${asset.id}`);
      localPath(asset.notice.path);
      if (asset.notice.path === asset.path)
        throw new Error(`Asset notice must be a separate file: ${asset.id}`);
    }
    if (asset.packageSource !== undefined) {
      const source = asset.packageSource;
      if (
        !source ||
        Object.keys(source).some((k) => !['package', 'path', 'noticePath'].includes(k)) ||
        !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(source.package)
      )
        throw new Error(`Invalid package asset source: ${asset.id}`);
      localPath(source.path);
      if (source.noticePath !== undefined) localPath(source.noticePath);
      if ((asset.notice !== undefined) !== (source.noticePath !== undefined))
        throw new Error(`Package asset notice must have both source and destination: ${asset.id}`);
    }
    return Object.freeze({
      ...asset,
      ...(asset.notice ? { notice: Object.freeze({ ...asset.notice }) } : {}),
      ...(asset.packageSource ? { packageSource: Object.freeze({ ...asset.packageSource }) } : {}),
    });
  });
  return Object.freeze(assets);
}
/** Validate generated runtime metadata; user configuration needs no hashes. */
export function defineAssetManifest(value: unknown): readonly ResolvedAppAsset[] {
  return Object.freeze(
    defineAssets(value).map((asset) => {
      const { notice, ...reference } = asset;
      if (reference.sha256 === undefined || (notice && notice.sha256 === undefined))
        throw new Error('Prepare runner assets before registration: ' + asset.id);
      return Object.freeze({
        ...reference,
        sha256: reference.sha256,
        ...(notice ? { notice: Object.freeze({ ...notice, sha256: notice.sha256! }) } : {}),
      });
    }),
  );
}
/** Validate JSON configuration, including the `nelyx` field in an application package.json. */
export function defineConfig(configuration: unknown): NelyxConfig {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration))
    throw new Error('Application package.json requires an nelyx configuration object');
  const value = configuration as Omit<NelyxConfig, 'schema'> & {
    schema: string;
    targets?: { web?: { component: string; profile?: string; cohort?: string } };
  };
  if (!['nelyx.app/v2', 'nelyx.app/v3'].includes(value.schema))
    throw new Error(
      'Use nelyx.app/v3 with a PWA component and web/runner. Convert Deno/raw platform imports to @nelyx/sdk/platforms/web.',
    );
  if (typeof value.name !== 'string' || !/^[A-Z][A-Za-z0-9]*$/.test(value.name))
    throw new Error('Invalid app schema/name');
  /* oxlint-disable no-control-regex -- Control code points are deliberately matched for input validation or normalization. */
  if (
    value.displayName !== undefined &&
    (typeof value.displayName !== 'string' ||
      !value.displayName.trim() ||
      /[\u0000-\u001f]/.test(value.displayName))
  )
    throw new Error('Invalid app displayName');
  /* oxlint-enable no-control-regex */
  localPath(value.appEntry);
  const assets = defineAssets(value.assets);
  const pwa = value.schema === 'nelyx.app/v2' ? readLegacyPwa(value) : value.pwa;
  if (
    !pwa ||
    typeof pwa !== 'object' ||
    Array.isArray(pwa) ||
    typeof pwa.id !== 'string' ||
    !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(pwa.id) ||
    typeof pwa.shortName !== 'string' ||
    !pwa.shortName.trim() ||
    typeof pwa.themeColor !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(pwa.themeColor)
  )
    throw new Error('PWA requires a component, same-origin id, shortName and #RRGGBB themeColor');
  if (value.schema === 'nelyx.app/v3' && value.targets !== undefined)
    throw new Error('Select an OS at the CLI with --platform and configure it in src-tauri');
  localPath(pwa.component);
  let icons: readonly PwaIcon[] | undefined;
  if (pwa.icons !== undefined) {
    if (
      !Array.isArray(pwa.icons) ||
      pwa.icons.length > 16 ||
      !['192x192', '512x512'].every((size) =>
        pwa.icons!.some((icon) => icon?.sizes === size && icon.purpose !== 'maskable'),
      )
    )
      throw new Error('PWA requires 192x192 and 512x512 PNG icons for regular display');
    icons = Object.freeze(
      pwa.icons.map((icon) => {
        if (
          !icon ||
          !['192x192', '512x512'].includes(icon.sizes) ||
          icon.type !== 'image/png' ||
          (icon.purpose !== undefined &&
            !['any', 'maskable', 'any maskable'].includes(icon.purpose))
        )
          throw new Error('Invalid PWA icon declaration');
        localPath(icon.src);
        return Object.freeze({ ...icon });
      }),
    );
  }
  const { name, displayName, appEntry } = value;
  return Object.freeze({
    schema: 'nelyx.app/v3',
    name,
    ...(displayName === undefined ? {} : { displayName }),
    appEntry,
    assets,
    pwa: Object.freeze({
      component: pwa.component,
      id: pwa.id,
      shortName: pwa.shortName,
      themeColor: pwa.themeColor,
      ...(icons ? { icons } : {}),
    }),
  });
}
function readLegacyPwa(value: {
  name: string;
  displayName?: string;
  targets?: { web?: { component: string; profile?: string; cohort?: string } };
}): PwaConfig {
  const web = value.targets?.web;
  if (!web?.component)
    throw new Error(
      'Add web/runner from the PWA starter, declare nelyx.pwa (or targets.web in v2), and replace platform imports with @nelyx/sdk/platforms/web/application and /surface',
    );
  if (web.profile !== undefined && web.profile !== 'ganesh-webgl2')
    throw new Error('Use the ganesh-webgl2 PWA profile and rebuild the app');
  if (web.cohort !== undefined && web.cohort !== 'web-react-dom-19.2.0')
    throw new Error(
      'The old Web cohort requires upgrading web/runner with nelyx supply, installing it and removing targets.web.cohort before rebuilding',
    );
  return {
    component: web.component,
    id: '/apps/' + value.name.toLowerCase(),
    shortName: value.displayName ?? value.name,
    themeColor: '#101827',
  };
}
export function migrateConfig(value: unknown): NelyxConfig {
  return defineConfig(value);
}
