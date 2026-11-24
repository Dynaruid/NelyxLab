import type { AssetRef } from '@nelyx/core/foundation/assets';
import { deviceFeatures } from '../devices.ts';
import type { DeviceFeature } from '../devices.ts';

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
  readonly id: string;
  readonly shortName: string;
  readonly themeColor: string;
  readonly icons?: readonly PwaIcon[];
}
export type TauriScrollEdgeEffect = 'hidden' | 'automatic' | 'soft' | 'hard';
export interface TauriScrollEdgeEffects {
  readonly top?: TauriScrollEdgeEffect;
  readonly right?: TauriScrollEdgeEffect;
  readonly bottom?: TauriScrollEdgeEffect;
  readonly left?: TauriScrollEdgeEffect;
}
export interface TauriWindowConfig {
  readonly label: string;
  readonly title?: string;
  readonly width?: number;
  readonly height?: number;
  readonly useHttpsScheme?: boolean;
  readonly clipboard?: { readonly read: boolean; readonly write: boolean };
  readonly haptics?: boolean;
  readonly androidBack?: boolean;
  readonly systemChrome?: boolean;
  /** Native iOS 26+ WebView effects. Each omitted edge defaults to hidden. */
  readonly scrollEdgeEffects?: TauriScrollEdgeEffects;
  readonly deviceServices?: readonly DeviceFeature[];
  readonly safeArea?: boolean;
  readonly windowTitle?: boolean;
  readonly commands?: readonly string[];
}
export interface TauriTargetConfig {
  readonly identifier: string;
  readonly productName?: string;
  readonly windows?: readonly TauriWindowConfig[];
  readonly deviceUsage?: Readonly<Partial<Record<'location' | 'camera' | 'nfc' | 'biometrics', string>>>;
  readonly deepLinks?: {
    readonly schemes: readonly string[];
    readonly domains?: readonly { readonly host: string; readonly pathPrefix?: string }[];
  };
}
export interface NelyxConfig {
  readonly schema: 'nelyx.app/v4';
  readonly name: string;
  readonly displayName?: string;
  readonly appEntry: string;
  readonly assets: readonly AppAsset[];
  readonly crossOriginIsolated?: boolean;
  readonly backend?: { readonly manifest: string };
  readonly targets: {
    readonly web?: { readonly pwa?: PwaConfig };
    readonly tauri?: TauriTargetConfig;
  };
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
  const value = configuration as NelyxConfig;
  if (value.schema !== 'nelyx.app/v4')
    throw new Error('Use nelyx.app/v4 with appEntry and targets.web or targets.tauri');
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
  const assets = defineAssets(value.assets === undefined ? [] : value.assets);
  if (value.crossOriginIsolated !== undefined && typeof value.crossOriginIsolated !== 'boolean')
    throw new Error('crossOriginIsolated must be a boolean');
  if (value.backend !== undefined) {
    if (!value.backend || Object.keys(value.backend).some((key) => key !== 'manifest'))
      throw new Error('backend requires a manifest path');
    localPath(value.backend.manifest);
    if (!value.backend.manifest.endsWith('/Cargo.toml'))
      throw new Error('backend.manifest must reference Cargo.toml');
  }
  const { targets } = value;
  if (
    !targets ||
    typeof targets !== 'object' ||
    Array.isArray(targets) ||
    Object.keys(targets).some((key) => key !== 'web' && key !== 'tauri') ||
    (targets.web === undefined && targets.tauri === undefined)
  )
    throw new Error('Declare targets.web or targets.tauri');
  if (
    targets.web !== undefined &&
    (!targets.web ||
      typeof targets.web !== 'object' ||
      Array.isArray(targets.web) ||
      Object.keys(targets.web).some((key) => key !== 'pwa'))
  )
    throw new Error('targets.web accepts an optional pwa object');
  const { name, displayName, appEntry } = value;
  return Object.freeze({
    schema: 'nelyx.app/v4',
    name,
    ...(displayName === undefined ? {} : { displayName }),
    appEntry,
    assets,
    crossOriginIsolated: value.crossOriginIsolated ?? true,
    ...(value.backend ? { backend: Object.freeze({ manifest: value.backend.manifest }) } : {}),
    targets: Object.freeze({
      ...(targets.web
        ? {
            web: Object.freeze(
              targets.web.pwa === undefined ? {} : { pwa: definePwa(targets.web.pwa) },
            ),
          }
        : {}),
      ...(targets.tauri === undefined ? {} : { tauri: defineTauri(targets.tauri) }),
    }),
  });
}

function definePwa(pwa: PwaConfig): PwaConfig {
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
    throw new Error('PWA requires a same-origin id, shortName and #RRGGBB themeColor');
  if (Object.keys(pwa).some((key) => !['id', 'shortName', 'themeColor', 'icons'].includes(key)))
    throw new Error('Invalid PWA option');
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
  return Object.freeze({
    id: pwa.id,
    shortName: pwa.shortName,
    themeColor: pwa.themeColor,
    ...(icons ? { icons } : {}),
  });
}

export function validDeviceFeatures(value: unknown): value is readonly DeviceFeature[] {
  return Array.isArray(value) && new Set(value).size === value.length &&
    value.every((name: unknown) => deviceFeatures.includes(name as DeviceFeature));
}

function defineDeepLinks(value: NonNullable<TauriTargetConfig['deepLinks']>) {
  if (
    !value ||
    Object.keys(value).some((key) => !['schemes', 'domains'].includes(key)) ||
    !Array.isArray(value.schemes) ||
    !value.schemes.length ||
    new Set(value.schemes).size !== value.schemes.length ||
    value.schemes.some((scheme) =>
      typeof scheme !== 'string' || !/^[a-z][a-z0-9+.-]{1,63}$/.test(scheme) ||
      ['http', 'https', 'file', 'javascript', 'data', 'about', 'tauri', 'asset', 'ipc'].includes(scheme),
    ) ||
    (value.domains !== undefined &&
      (!Array.isArray(value.domains) || value.domains.some((entry) =>
        !entry || typeof entry.host !== 'string' ||
        !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(entry.host) ||
        Object.keys(entry).some((key) => !['host', 'pathPrefix'].includes(key)) ||
        (entry.pathPrefix !== undefined &&
          (typeof entry.pathPrefix !== 'string' || !/^\/[^?#\s"<>&]*$/.test(entry.pathPrefix))),
      )))
  )
    throw new Error('Invalid targets.tauri.deepLinks schemes or domains');
  return Object.freeze({
    schemes: Object.freeze([...value.schemes]),
    ...(value.domains ? { domains: Object.freeze(value.domains.map((domain) => Object.freeze({ ...domain }))) } : {}),
  });
}

function defineTauri(tauri: TauriTargetConfig): TauriTargetConfig {
  if (
    !tauri ||
    typeof tauri !== 'object' ||
    Array.isArray(tauri) ||
    Object.keys(tauri).some((key) => !['identifier', 'productName', 'windows', 'deviceUsage', 'deepLinks'].includes(key)) ||
    typeof tauri.identifier !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/.test(tauri.identifier)
  )
    throw new Error('targets.tauri requires a reverse-DNS identifier');
  if (
    tauri.productName !== undefined &&
    (typeof tauri.productName !== 'string' ||
      !tauri.productName.trim() ||
      /[<>:"/\\|?*]/.test(tauri.productName))
  )
    throw new Error('Invalid targets.tauri.productName');
  const usage = tauri.deviceUsage;
  if (usage !== undefined && (!usage || typeof usage !== 'object' || Array.isArray(usage) ||
      Object.entries(usage).some(([key, text]) =>
        !['location', 'camera', 'nfc', 'biometrics'].includes(key) ||
        typeof text !== 'string' || !text.trim() || /[\0\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(text),
      )))
    throw new Error('Invalid targets.tauri.deviceUsage purpose text');
  const links = tauri.deepLinks === undefined ? undefined : defineDeepLinks(tauri.deepLinks);
  const base = {
    ...tauri,
    ...(usage ? { deviceUsage: Object.freeze({ ...usage }) } : {}),
    ...(links ? { deepLinks: links } : {}),
  };
  if (tauri.windows === undefined) return Object.freeze(base);
  if (!Array.isArray(tauri.windows) || !tauri.windows.length)
    throw new Error('targets.tauri.windows requires at least one window');
  const labels = new Set<string>();
  const windows = (tauri.windows as readonly TauriWindowConfig[]).map((window) => {
    if (
      !window ||
      !/^[a-zA-Z0-9_-]+$/.test(window.label) ||
      labels.has(window.label) ||
      typeof window.label !== 'string' ||
      Object.keys(window).some(
        (key) =>
          ![
            'label',
            'title',
            'width',
            'height',
            'useHttpsScheme',
            'clipboard',
            'haptics',
            'androidBack',
            'systemChrome',
            'scrollEdgeEffects',
            'deviceServices',
            'safeArea',
            'windowTitle',
            'commands',
          ].includes(key),
      ) ||
      (window.title !== undefined && (typeof window.title !== 'string' || !window.title.trim())) ||
      [window.width, window.height].some(
        (size) => size !== undefined && (!Number.isFinite(size) || size <= 0),
      ) ||
      [
        window.useHttpsScheme,
        window.safeArea,
        window.windowTitle,
        window.haptics,
        window.androidBack,
        window.systemChrome,
      ].some((setting) => setting !== undefined && typeof setting !== 'boolean') ||
      (window.scrollEdgeEffects !== undefined &&
        (window.scrollEdgeEffects === null ||
          typeof window.scrollEdgeEffects !== 'object' ||
          Array.isArray(window.scrollEdgeEffects) ||
          Object.entries(window.scrollEdgeEffects).some(
            ([edge, style]) =>
              !['top', 'right', 'bottom', 'left'].includes(edge) ||
              !['hidden', 'automatic', 'soft', 'hard'].includes(style),
          ))) ||
      (window.deviceServices !== undefined &&
        (!validDeviceFeatures(window.deviceServices) ||
          (window.deviceServices.includes('deepLinks') && !links))) ||
      (window.clipboard !== undefined &&
        (!window.clipboard ||
          typeof window.clipboard.read !== 'boolean' ||
          typeof window.clipboard.write !== 'boolean' ||
          Object.keys(window.clipboard).some((key) => key !== 'read' && key !== 'write'))) ||
      (window.commands !== undefined &&
        (!Array.isArray(window.commands) ||
          new Set(window.commands).size !== window.commands.length ||
          window.commands.some(
            (name) => typeof name !== 'string' || !/^[a-z][a-zA-Z0-9_.-]*$/.test(name),
          )))
    )
      throw new Error('Invalid or duplicate Tauri window declaration');
    labels.add(window.label);
    return Object.freeze({
      ...window,
      ...(window.clipboard ? { clipboard: Object.freeze({ ...window.clipboard }) } : {}),
      ...(window.scrollEdgeEffects
        ? { scrollEdgeEffects: Object.freeze({ ...window.scrollEdgeEffects }) }
        : {}),
      ...(window.commands ? { commands: Object.freeze([...window.commands]) } : {}),
      ...(window.deviceServices ? { deviceServices: Object.freeze([...window.deviceServices]) } : {}),
    });
  });
  return Object.freeze({ ...base, windows: Object.freeze(windows) });
}
