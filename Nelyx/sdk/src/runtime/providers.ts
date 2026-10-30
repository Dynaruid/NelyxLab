import type { BackendIdentity, PlatformId } from '@nelyx/core/hosting/platform';
import { coreVersion } from '@nelyx/core/version';
const [coreMajor, coreMinor] = coreVersion.split('.').map(Number);
const compatibleCoreRange = `>=${coreVersion} <${coreMajor}.${coreMinor! + 1}.0`;
import { sdkVersion } from '../version.ts';
import { matchesVersion, matchesToolVersion } from './compatibility.ts';
import { nativeCohort, windowsV8Cohort, windowsJscCohort, validateCohort } from './cohorts.ts';
import type { ProviderCohort, ProviderCohortEnvironment } from './cohorts.ts';

export type ProviderOperation = 'doctor' | 'build' | 'run' | 'dev' | 'pack';
export type ProviderArchitecture = 'x86_64' | 'arm64' | 'wasm32';
export type ProviderOperatingSystem =
  | 'windows'
  | 'darwin'
  | 'linux'
  | 'android'
  | 'ios'
  | 'browser';
export interface ProviderAbi {
  readonly host: number | null;
  readonly skia: number;
}
export interface ProviderCapabilities {
  readonly rendering: Readonly<{
    admission: 'bounded' | 'rate-limited-only' | 'unavailable';
    completion: 'gpu-retired' | 'native-retained' | 'unobserved' | 'unavailable';
    present: 'native-observed' | 'unobserved';
    notifications: 'submitted-and-retired' | 'submitted-only' | 'unavailable';
    nativeIdentity: boolean;
    textRanges: boolean;
  }>;
  readonly editing: Readonly<{
    indexUnit: 'utf16';
    composing: 'observed' | 'unavailable';
    selectionDirection: 'observed' | 'unavailable';
    nativeRevision: 'observed' | 'event-count' | 'unavailable';
  }>;
  readonly semantics: 'native-controls' | 'dom' | 'unavailable';
}
export interface ProviderQualification {
  readonly status: 'scoped' | 'notVerified';
  readonly scope: string;
  readonly architectures: readonly ProviderArchitecture[];
  readonly evidence: readonly string[];
  readonly limitations: readonly string[];
}
export interface ProviderArtifactReference {
  readonly entry: string | null;
  readonly kind: 'binary' | 'recipe';
  readonly required: readonly string[];
}
export interface ProviderTool {
  readonly id: string;
  readonly kind: 'executable' | 'package' | 'sdk' | 'component';
  readonly versionRange: string | null;
  readonly operations: readonly ProviderOperation[];
  readonly hostOperatingSystems: readonly ProviderOperatingSystem[];
}
export interface ProviderProfile {
  readonly id: string;
  readonly identity: BackendIdentity;
  readonly status: 'implemented' | 'unsupported';
  readonly reason: string;
  readonly cohorts: readonly string[];
  readonly executionOperatingSystems: readonly ProviderOperatingSystem[];
  readonly architectures: readonly ProviderArchitecture[];
  readonly artifactManifest: ProviderArtifactReference;
  readonly nativeAbi: ProviderAbi;
  readonly wireAbi: number;
  readonly capabilities: ProviderCapabilities;
  readonly qualification: ProviderQualification;
}
export interface ProviderDescriptor {
  readonly schema: 'nelyx.provider/v4';
  readonly id: string;
  readonly version: string;
  readonly coreRange: string;
  readonly protocolVersion: number;
  readonly target: PlatformId;
  readonly runtime: BackendIdentity['runtime'];
  readonly host: BackendIdentity['host'];
  readonly renderer: BackendIdentity['renderer'];
  readonly entry: string;
  readonly defaultProfile: string;
  readonly cohorts: readonly ProviderCohort[];
  readonly defaultCohort: string;
  readonly hostOperatingSystems: Readonly<
    Partial<Record<ProviderOperation, readonly ProviderOperatingSystem[]>>
  >;
  readonly operations: readonly ProviderOperation[];
  readonly architectures: readonly ProviderArchitecture[];
  readonly tooling: readonly ProviderTool[];
  readonly artifactManifest: ProviderArtifactReference;
  readonly nativeAbi: ProviderAbi;
  readonly wireAbi: number;
  readonly capabilities: ProviderCapabilities;
  readonly qualification: ProviderQualification;
  readonly profiles: readonly ProviderProfile[];
}
export interface ProviderCompatibility {
  readonly coreVersion: string;
  readonly sdkVersion: string;
  readonly protocolVersion: number;
  readonly skiaAbi: number;
  readonly wireAbi: number;
}
const targets = ['web', 'ios', 'android', 'windows', 'macos', 'linux'] as const;
const operations = ['doctor', 'build', 'run', 'dev', 'pack'] as const;
const systems = ['windows', 'darwin', 'linux', 'android', 'ios', 'browser'] as const;
const buildSystems = ['windows', 'darwin', 'linux'] as const;
const architectures = ['x86_64', 'arm64', 'wasm32'] as const;
const compatibility: ProviderCompatibility = {
  coreVersion,
  sdkVersion,
  protocolVersion: 1,
  skiaAbi: 1,
  wireAbi: 10,
};
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    allowed.some((key) => !Object.hasOwn(value, key))
  )
    throw new Error(`Invalid ${label} property`);
}
function strings(
  value: unknown,
  label: string,
  allowed?: readonly string[],
  empty = false,
): string[] {
  if (
    !Array.isArray(value) ||
    (!empty && !value.length) ||
    value.some(
      (item) => typeof item !== 'string' || !item || (allowed && !allowed.includes(item)),
    ) ||
    new Set(value).size !== value.length
  )
    throw new Error(`Invalid ${label}`);
  return value;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Invalid ${label}`);
  return value;
}
function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(`Invalid ${label}`);
  return value as number;
}
function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => equal(value, right[index]))
    );
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const l = left as Record<string, unknown>,
    r = right as Record<string, unknown>,
    names = Object.keys(l);
  return (
    names.length === Object.keys(r).length &&
    names.every((name) => Object.hasOwn(r, name) && equal(l[name], r[name]))
  );
}
function abi(value: unknown): ProviderAbi {
  const input = record(value, 'nativeAbi');
  keys(input, ['host', 'skia'], 'nativeAbi');
  return Object.freeze({
    host: input.host === null ? null : integer(input.host, 'host ABI'),
    skia: integer(input.skia, 'Skia ABI'),
  });
}
function artifact(value: unknown): ProviderArtifactReference {
  const input = record(value, 'artifactManifest');
  keys(input, ['entry', 'kind', 'required'], 'artifactManifest');
  if (
    !['binary', 'recipe'].includes(input.kind as string) ||
    (input.entry !== null &&
      (typeof input.entry !== 'string' ||
        !/^@nelyx\/(sdk|skia-rn|skia-web)\/[A-Za-z0-9_./-]+\.json$/.test(input.entry) ||
        input.entry.includes('..')))
  )
    throw new Error('Invalid artifact manifest entry/kind');
  return Object.freeze({
    entry: input.entry as string | null,
    kind: input.kind as 'binary' | 'recipe',
    required: Object.freeze([...strings(input.required, 'artifact declarations')]),
  });
}
function capabilities(value: unknown): ProviderCapabilities {
  const input = record(value, 'capabilities');
  keys(input, ['rendering', 'editing', 'semantics'], 'capabilities');
  const rendering = record(input.rendering, 'rendering capabilities'),
    editing = record(input.editing, 'editing capabilities');
  keys(
    rendering,
    ['admission', 'completion', 'present', 'notifications', 'nativeIdentity', 'textRanges'],
    'rendering capabilities',
  );
  keys(
    editing,
    ['indexUnit', 'composing', 'selectionDirection', 'nativeRevision'],
    'editing capabilities',
  );
  if (
    !['submitted-and-retired', 'submitted-only', 'unavailable'].includes(
      rendering.notifications as string,
    ) ||
    (rendering.admission === 'unavailable' && rendering.notifications !== 'unavailable')
  )
    throw new Error('Invalid provider renderer notifications');
  if (
    !['bounded', 'rate-limited-only', 'unavailable'].includes(rendering.admission as string) ||
    !['gpu-retired', 'native-retained', 'unobserved', 'unavailable'].includes(
      rendering.completion as string,
    ) ||
    !['native-observed', 'unobserved'].includes(rendering.present as string) ||
    typeof rendering.nativeIdentity !== 'boolean' ||
    typeof rendering.textRanges !== 'boolean' ||
    editing.indexUnit !== 'utf16' ||
    !['observed', 'unavailable'].includes(editing.composing as string) ||
    !['observed', 'unavailable'].includes(editing.selectionDirection as string) ||
    !['observed', 'event-count', 'unavailable'].includes(editing.nativeRevision as string) ||
    !['native-controls', 'dom', 'unavailable'].includes(input.semantics as string)
  )
    throw new Error('Invalid provider capabilities');
  return Object.freeze({
    rendering: Object.freeze({ ...rendering }),
    editing: Object.freeze({ ...editing }),
    semantics: input.semantics,
  }) as unknown as ProviderCapabilities;
}
function qualification(
  value: unknown,
  status: ProviderProfile['status'],
  arch: readonly string[],
): ProviderQualification {
  const input = record(value, 'qualification');
  keys(input, ['status', 'scope', 'architectures', 'evidence', 'limitations'], 'qualification');
  const verified = strings(input.architectures, 'qualified architectures', architectures, true),
    evidence = strings(input.evidence, 'qualification evidence', undefined, true),
    limitations = strings(input.limitations, 'qualification limitations');
  if (
    !['scoped', 'notVerified'].includes(input.status as string) ||
    verified.some((value) => !arch.includes(value)) ||
    (input.status === 'scoped' &&
      (status !== 'implemented' || !verified.length || !evidence.length)) ||
    (input.status === 'notVerified' && (verified.length || evidence.length))
  )
    throw new Error('Invalid profile qualification');
  return Object.freeze({
    status: input.status,
    scope: text(input.scope, 'qualification scope'),
    architectures: Object.freeze([...verified]),
    evidence: Object.freeze([...evidence]),
    limitations: Object.freeze([...limitations]),
  }) as ProviderQualification;
}
/** Parse metadata without importing an implementation or opening native resources. */
export function validateProvider(
  value: unknown,
  expected: ProviderCompatibility = compatibility,
): ProviderDescriptor {
  const input = record(value, 'provider');
  keys(
    input,
    [
      'schema',
      'id',
      'version',
      'coreRange',
      'protocolVersion',
      'target',
      'runtime',
      'host',
      'renderer',
      'entry',
      'defaultProfile',
      'cohorts',
      'defaultCohort',
      'hostOperatingSystems',
      'operations',
      'architectures',
      'tooling',
      'artifactManifest',
      'nativeAbi',
      'wireAbi',
      'capabilities',
      'qualification',
      'profiles',
    ],
    'provider',
  );
  const target = input.target as PlatformId;
  if (
    !targets.includes(target) ||
    input.id !== `nelyx.${target}` ||
    input.schema !== 'nelyx.provider/v4'
  )
    throw new Error('Invalid provider target/schema/id');
  if (
    input.version !== expected.sdkVersion ||
    !matchesVersion(expected.coreVersion, text(input.coreRange, 'coreRange')) ||
    input.protocolVersion !== expected.protocolVersion
  )
    throw new Error('Incompatible provider version/coreRange/protocolVersion');
  if (input.entry !== `@nelyx/sdk/platforms/${target}/application`)
    throw new Error('Invalid provider implementation entry');
  const declaredAbi = abi(input.nativeAbi);
  if (declaredAbi.skia !== expected.skiaAbi || input.wireAbi !== expected.wireAbi)
    throw new Error('Incompatible provider native ABI/wire ABI');
  const declaredOperations = strings(
      input.operations,
      'operations',
      operations,
    ) as ProviderOperation[],
    declaredArchitectures = strings(
      input.architectures,
      'architectures',
      architectures,
    ) as ProviderArchitecture[];
  const hostInput = record(input.hostOperatingSystems, 'hostOperatingSystems');
  keys(hostInput, declaredOperations, 'hostOperatingSystems');
  const hostOperatingSystems = Object.freeze(
    Object.fromEntries(
      declaredOperations.map((operation) => [
        operation,
        Object.freeze([...strings(hostInput[operation], `${operation} host OS`, buildSystems)]),
      ]),
    ),
  ) as ProviderDescriptor['hostOperatingSystems'];
  if (!Array.isArray(input.cohorts) || !input.cohorts.length)
    throw new Error('Missing provider cohorts');
  const cohorts = input.cohorts.map((value) => validateCohort(value, target));
  const cohortIds = cohorts.map((value) => value.id);
  if (
    new Set(cohortIds).size !== cohortIds.length ||
    !cohortIds.includes(input.defaultCohort as string)
  )
    throw new Error('Invalid duplicate/default cohort');
  if (!Array.isArray(input.profiles) || !input.profiles.length)
    throw new Error('Missing provider profiles');
  const ids = new Set<string>();
  const profiles = input.profiles.map((value) => {
    const profile = record(value, 'profile'),
      identity = record(profile.identity, 'identity');
    keys(
      profile,
      [
        'id',
        'identity',
        'status',
        'reason',
        'cohorts',
        'executionOperatingSystems',
        'architectures',
        'artifactManifest',
        'nativeAbi',
        'wireAbi',
        'capabilities',
        'qualification',
      ],
      'profile',
    );
    keys(
      identity,
      ['target', 'runtime', 'host', 'renderer', 'gpuBackend', 'gpuImplementation', 'profile'],
      'identity',
    );
    if (
      typeof profile.id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]*$/.test(profile.id) ||
      ids.has(profile.id)
    )
      throw new Error('Invalid or duplicate profile');
    ids.add(profile.id);
    if (identity.target !== target || identity.profile !== profile.id)
      throw new Error('Profile target mismatch');
    const web = target === 'web',
      desktop = target === 'windows' || target === 'linux';
    if (
      !(web
        ? identity.runtime === 'browser'
        : identity.runtime === 'hermes' ||
          (target === 'windows' && ['v8', 'jsc'].includes(identity.runtime as string))) ||
      identity.host !== (web ? 'react-dom' : 'fabric') ||
      identity.renderer !== (web ? 'skia-ganesh' : 'skia-graphite')
    )
      throw new Error(
        'Invalid target runtime/host/renderer; native providers require an admitted VM/Fabric/Graphite',
      );
    const gpu = web ? 'webgl2' : target === 'ios' || target === 'macos' ? 'metal' : 'vulkan';
    const implementation = web ? 'browser-webgl2' : desktop ? 'native-vulkan' : 'dawn';
    if (identity.gpuBackend !== gpu || identity.gpuImplementation !== implementation)
      throw new Error('Invalid target GPU backend/implementation');
    if (profile.id === 'wgl' || profile.id.startsWith('raw-'))
      throw new Error('Removed Deno/raw profile; configure an RN runner and explicit RN profile');
    const profileCohorts = strings(profile.cohorts, 'profile cohorts', cohortIds);
    if (
      profileCohorts.some(
        (id) => cohorts.find((cohort) => cohort.id === id)!.engine !== identity.runtime,
      )
    )
      throw new Error('Profile runtime differs from its cohort engine');
    if (web && profile.id !== 'ganesh-webgl2')
      throw new Error('Unsupported Web profile; use ganesh-webgl2');
    if (!['implemented', 'unsupported'].includes(profile.status as string))
      throw new Error('Invalid profile implementation status');
    const arch = strings(
        profile.architectures,
        'profile architectures',
        architectures,
      ) as ProviderArchitecture[],
      os = strings(
        profile.executionOperatingSystems,
        'execution OS',
        systems,
      ) as ProviderOperatingSystem[];
    const expectedOs = target === 'web' ? 'browser' : target === 'macos' ? 'darwin' : target;
    const targetArchitectures =
      target === 'web' ? ['wasm32'] : target === 'ios' ? ['arm64'] : ['x86_64', 'arm64'];
    if (
      os.some((value) => value !== expectedOs) ||
      arch.some((value) => !targetArchitectures.includes(value))
    )
      throw new Error('Invalid target execution OS/architecture');
    if (arch.some((value) => !declaredArchitectures.includes(value)))
      throw new Error('Undeclared profile architecture');
    const nativeAbi = abi(profile.nativeAbi),
      artifactManifest = artifact(profile.artifactManifest),
      caps = capabilities(profile.capabilities),
      verified = qualification(
        profile.qualification,
        profile.status as ProviderProfile['status'],
        arch,
      );
    if (
      nativeAbi.skia !== expected.skiaAbi ||
      profile.wireAbi !== expected.wireAbi ||
      (profile.status === 'implemented' && !artifactManifest.entry)
    )
      throw new Error('Incompatible provider native ABI/wire ABI or missing artifact manifest');
    if (
      profile.status === 'unsupported' &&
      (caps.rendering.admission !== 'unavailable' ||
        caps.rendering.completion !== 'unavailable' ||
        caps.rendering.nativeIdentity ||
        caps.rendering.textRanges ||
        caps.editing.composing !== 'unavailable' ||
        caps.editing.selectionDirection !== 'unavailable' ||
        caps.editing.nativeRevision !== 'unavailable' ||
        caps.semantics !== 'unavailable' ||
        caps.rendering.present !== 'unobserved')
    )
      throw new Error('Unsupported profile overclaims capabilities');
    if (nativeAbi.host !== null)
      throw new Error('RN providers cannot use a legacy desktop host ABI');
    if (
      target === 'android' &&
      profile.status === 'implemented' &&
      (artifactManifest.entry !== '@nelyx/skia-rn/native-manifest.json' ||
        artifactManifest.kind !== 'recipe')
    )
      throw new Error('Incompatible Android native ABI/artifact recipe');
    const requiredArtifacts =
      target === 'android' && profile.status === 'implemented'
        ? arch.map((value) => `skia-android-${value}`)
        : undefined;
    if (
      requiredArtifacts &&
      !equal([...artifactManifest.required].sort(), requiredArtifacts.sort())
    )
      throw new Error('Invalid required provider artifact identities');
    return Object.freeze({
      id: profile.id,
      cohorts: Object.freeze([...profileCohorts]),
      identity: Object.freeze({ ...identity }) as unknown as BackendIdentity,
      status: profile.status,
      reason: text(profile.reason, 'profile reason'),
      executionOperatingSystems: Object.freeze([...os]),
      architectures: Object.freeze([...arch]),
      artifactManifest,
      nativeAbi,
      wireAbi: profile.wireAbi,
      capabilities: caps,
      qualification: verified,
    }) as ProviderProfile;
  });
  const selected = profiles.find((profile) => profile.id === input.defaultProfile);
  if (!selected) throw new Error('Invalid default profile');
  if (!selected.cohorts.includes(input.defaultCohort as string))
    throw new Error('Default profile does not support default cohort');
  for (const field of ['runtime', 'host', 'renderer'] as const)
    if (input[field] !== selected.identity[field])
      throw new Error('Default provider identity mismatch');
  for (const field of [
    'artifactManifest',
    'nativeAbi',
    'wireAbi',
    'capabilities',
    'qualification',
  ] as const)
    if (!equal(input[field], selected[field]))
      throw new Error(`Default provider ${field} mismatch`);
  if (!Array.isArray(input.tooling) || !input.tooling.length)
    throw new Error('Missing provider tooling');
  const tools = new Set<string>(),
    tooling = input.tooling.map((value) => {
      const tool = record(value, 'tooling');
      keys(tool, ['id', 'kind', 'versionRange', 'operations', 'hostOperatingSystems'], 'tooling');
      if (
        typeof tool.id !== 'string' ||
        !/^[a-z0-9][a-z0-9.-]*$/.test(tool.id) ||
        tools.has(tool.id) ||
        !['executable', 'package', 'sdk', 'component'].includes(tool.kind as string)
      )
        throw new Error('Invalid or duplicate provider tool');
      tools.add(tool.id);
      const uses = strings(tool.operations, 'tool operations', declaredOperations),
        os = strings(tool.hostOperatingSystems, 'tool host OS', buildSystems);
      if (tool.versionRange !== null)
        matchesToolVersion('0.0.0', text(tool.versionRange, 'tool version range'));
      return Object.freeze({
        id: tool.id,
        kind: tool.kind,
        versionRange: tool.versionRange,
        operations: Object.freeze([...uses]),
        hostOperatingSystems: Object.freeze([...os]),
      }) as ProviderTool;
    });
  return Object.freeze({
    schema: 'nelyx.provider/v4',
    id: input.id,
    version: input.version,
    coreRange: input.coreRange,
    protocolVersion: input.protocolVersion,
    target,
    runtime: selected.identity.runtime,
    host: selected.identity.host,
    renderer: selected.identity.renderer,
    entry: input.entry,
    defaultProfile: selected.id,
    cohorts: Object.freeze(cohorts),
    defaultCohort: input.defaultCohort,
    hostOperatingSystems,
    operations: Object.freeze([...declaredOperations]),
    architectures: Object.freeze([...declaredArchitectures]),
    tooling: Object.freeze(tooling),
    artifactManifest: selected.artifactManifest,
    nativeAbi: selected.nativeAbi,
    wireAbi: selected.wireAbi,
    capabilities: selected.capabilities,
    qualification: selected.qualification,
    profiles: Object.freeze(profiles),
  }) as ProviderDescriptor;
}
export class ProviderRegistry {
  private readonly providers = new Map<PlatformId, ProviderDescriptor>();
  constructor(descriptors: readonly unknown[], expected: ProviderCompatibility = compatibility) {
    for (const descriptor of descriptors) {
      const value = validateProvider(descriptor, expected);
      if (this.providers.has(value.target))
        throw new Error(`Duplicate provider target: ${value.target}`);
      this.providers.set(value.target, value);
    }
  }
  descriptor(target: PlatformId): ProviderDescriptor {
    const descriptor = this.providers.get(target);
    if (!descriptor) throw new Error(`Missing provider target: ${target}`);
    return descriptor;
  }
  profile(target: PlatformId, id?: string): ProviderProfile {
    const descriptor = this.descriptor(target),
      profile = descriptor.profiles.find((value) => value.id === (id ?? descriptor.defaultProfile));
    if (!profile)
      throw new Error(
        `Unknown profile: ${target}/${id}; Deno/raw profiles were removed; configure an RN runner and explicit RN profile`,
      );
    return profile;
  }
  cohort(
    target: PlatformId,
    environment: ProviderCohortEnvironment = {},
    profileId?: string,
  ): ProviderCohort {
    const descriptor = this.descriptor(target),
      profile = this.profile(target, profileId),
      id =
        environment.cohort ??
        (profile.cohorts.includes(descriptor.defaultCohort)
          ? descriptor.defaultCohort
          : profile.cohorts[0]);
    const cohort = descriptor.cohorts.find((value) => value.id === id);
    if (!id || !cohort || !profile.cohorts.includes(id))
      throw new Error(`Unsupported provider cohort: ${target}/${profile.id}/${id}`);
    if (environment.reactVersion !== undefined && environment.reactVersion !== cohort.react)
      throw new Error(
        `Incompatible React cohort: ${environment.reactVersion}; requires ${cohort.react}`,
      );
    if (
      environment.reactNativeVersion !== undefined &&
      environment.reactNativeVersion !== cohort.reactNative
    )
      throw new Error(
        `Incompatible React Native cohort: ${environment.reactNativeVersion}; requires ${cohort.reactNative}`,
      );
    if (
      environment.nativeReactNativeVersion !== undefined &&
      environment.nativeReactNativeVersion !== cohort.nativeReactNative
    )
      throw new Error(
        `Incompatible native React Native cohort: ${environment.nativeReactNativeVersion}; requires ${cohort.nativeReactNative ?? 'an observed native version before admission'}`,
      );
    return cohort;
  }
  select(
    target: PlatformId,
    profileId: string | undefined,
    environment: ProviderCohortEnvironment & {
      readonly os: string;
      readonly artifacts: readonly string[];
      readonly architecture?: string;
      readonly operation?: ProviderOperation;
    },
  ): ProviderProfile {
    const descriptor = this.descriptor(target),
      profile = this.profile(target, profileId);
    this.cohort(target, environment, profile.id);
    if (profile.status === 'unsupported')
      throw new Error(`Unsupported profile: ${target}/${profile.id}: ${profile.reason}`);
    if (!profile.executionOperatingSystems.includes(environment.os as ProviderOperatingSystem))
      throw new Error(`Provider cannot execute on ${environment.os}`);
    if (
      environment.architecture &&
      !profile.architectures.includes(environment.architecture as ProviderArchitecture)
    )
      throw new Error(`Unsupported provider architecture: ${environment.architecture}`);
    if (environment.operation && !descriptor.operations.includes(environment.operation))
      throw new Error(`Unsupported operation: ${environment.operation}`);
    if (environment.operation && !['run', 'dev'].includes(environment.operation))
      throw new Error('Runtime selection requires run/dev; use plan for build-host operations');
    for (const artifact of profile.artifactManifest.required)
      if (!environment.artifacts.includes(artifact))
        throw new Error(`Missing provider artifact: ${artifact}`);
    return profile;
  }
  /** CLI planning validates build-host rules separately from target execution rules. */
  plan(
    target: PlatformId,
    environment: ProviderCohortEnvironment & {
      readonly operation: ProviderOperation;
      readonly os: ProviderOperatingSystem;
      readonly architecture: ProviderArchitecture;
      readonly profile?: string;
      readonly tools?: Readonly<Record<string, string>>;
    },
  ) {
    const descriptor = this.descriptor(target),
      profile = this.profile(target, environment.profile),
      operation = environment.operation;
    if (
      !descriptor.operations.includes(operation) ||
      !descriptor.hostOperatingSystems[operation]?.includes(environment.os)
    )
      throw new Error(`Unsupported ${operation} host OS: ${target}/${environment.os}`);
    if (!profile.architectures.includes(environment.architecture))
      throw new Error(`Unsupported provider architecture: ${environment.architecture}`);
    if (profile.status === 'unsupported' && operation !== 'doctor')
      throw new Error(`Unsupported profile: ${target}/${profile.id}: ${profile.reason}`);
    const cohort = this.cohort(target, environment, profile.id);
    const tooling = descriptor.tooling.filter(
      (tool) =>
        tool.operations.includes(operation) && tool.hostOperatingSystems.includes(environment.os),
    );
    if (environment.tools)
      for (const tool of tooling) {
        const version = environment.tools[tool.id];
        if (!version) throw new Error(`Missing provider tool: ${tool.id}`);
        if (tool.versionRange === null)
          throw new Error(`Unqualified provider tool version: ${tool.id}`);
        if (!matchesToolVersion(version, tool.versionRange))
          throw new Error(
            `Incompatible provider tool ${tool.id}: ${version}; requires ${tool.versionRange}`,
          );
      }
    return Object.freeze({
      descriptor,
      profile,
      cohort,
      operation,
      architecture: environment.architecture,
      hostOperatingSystem: environment.os,
      tooling: Object.freeze(tooling),
    });
  }
}
function caps(_target: PlatformId, implemented: boolean): ProviderCapabilities {
  return {
    rendering: {
      admission: implemented ? 'bounded' : 'unavailable',
      completion: implemented ? 'gpu-retired' : 'unavailable',
      present: 'unobserved',
      notifications: implemented ? 'submitted-and-retired' : 'unavailable',
      nativeIdentity: implemented,
      textRanges: implemented,
    },
    editing: {
      indexUnit: 'utf16',
      composing: 'unavailable',
      selectionDirection: 'unavailable',
      nativeRevision: implemented ? 'event-count' : 'unavailable',
    },
    semantics: implemented ? 'native-controls' : 'unavailable',
  };
}
/** Provider metadata declares capabilities separately from runtime qualification. */
export function createProviderRegistry(): ProviderRegistry {
  const hosts: ProviderOperatingSystem[] = ['windows', 'darwin', 'linux'];
  return new ProviderRegistry(
    targets.map((target) => {
      const web = target === 'web',
        android = target === 'android',
        linux = target === 'linux',
        windows = target === 'windows',
        apple = target === 'ios' || target === 'macos',
        implemented = web || android || linux || windows || apple;
      const cohorts: ProviderCohort[] = web
        ? [
            validateCohort(
              {
                id: 'web-0.21.3',
                react: '19.2.0',
                reactNative: null,
                nativeReactNative: null,
                framework: 'react-native-web',
                frameworkVersion: '0.21.3',
                frameworkRevision: null,
                engine: 'browser',
                engineVersion: null,
                engineRevision: null,
                bytecodeVersion: null,
              },
              target,
            ),
          ]
        : android
          ? [nativeCohort(target), nativeCohort(target, true)]
          : windows
            ? [nativeCohort(target), windowsV8Cohort(), windowsJscCohort()]
            : [nativeCohort(target)];
      const defaultCohort = cohorts[0]!.id;
      const ids = web
        ? ['ganesh-webgl2']
        : android
          ? ['graphite-vulkan', 'emulator-vulkan']
          : windows
            ? ['rn-graphite-vulkan', 'rn-v8-graphite-vulkan', 'rn-jsc-graphite-vulkan']
            : target === 'linux'
              ? ['rn-graphite-vulkan-x11', 'rn-graphite-vulkan-wayland']
              : [
                  target === 'ios'
                    ? 'graphite-metal'
                    : target === 'macos'
                      ? 'rn-graphite-metal'
                      : 'rn-graphite-vulkan',
                ];
      const reason = windows
        ? 'Owned RNW module/session, per-view backing and SDK owner drain required; runtime/display qualification remains separate'
        : linux
          ? 'Owned native Linux hardware host/status and per-view backing gates required; GPU execution qualification notVerified'
          : apple
            ? 'Owned Apple host protocol3, exact RN cohort, JS Metal GPU preparation and per-view/runtime drain gates required; code-only scope, native execution notVerified'
            : implemented
              ? 'Existing implementation retained in its declared cohort; wider qualification pending'
              : 'SDK registration and native resource/lifecycle composition unavailable';
      const profiles: ProviderProfile[] = ids.map((id) => {
        const emulator = id === 'emulator-vulkan';
        const arch: ProviderArchitecture[] = web
          ? ['wasm32']
          : target === 'ios'
            ? ['arm64']
            : emulator || linux || windows
              ? ['x86_64']
              : ['x86_64', 'arm64'];
        const required = web
          ? ['canvaskit.js', 'canvaskit.wasm']
          : android
            ? arch.map((value) => `skia-android-${value}`)
            : target === 'ios' || target === 'macos'
              ? [`skia-${target}-framework`]
              : [`skia-${target}-rn`];
        const qualification: ProviderQualification = {
          status: 'notVerified',
          scope: web
            ? 'Browser Ganesh/WebGL2 implementation'
            : android
              ? 'Android Hermes/Graphite implementation'
              : windows
                ? 'Windows RNW/Vulkan implementation'
                : linux
                  ? 'Linux RNL/Vulkan source implementation'
                  : 'Apple RN/Metal source implementation',
          architectures: [],
          evidence: [],
          limitations: windows
            ? [
                'Only the pinned x86_64 RNW recipe is admitted',
                'Stock Core full reload and native loss recovery remain incomplete',
                'Physical input, accessibility, scanout, signing and clean-machine acceptance are not verified',
              ]
            : linux
              ? [
                  'Only the pinned x86_64 X11/Wayland recipe is admitted; GPU execution is not verified',
                  'ARM64, full reload/loss recovery, deployment and physical input/accessibility remain incomplete',
                  'Hardware preparation and matching native runtime generations are required',
                ]
              : apple
                ? [
                    'Native build, runtime, Metal and signing are not verified',
                    'Exact protocol3 patched RN/RNM source and hardware Metal/Dawn preparation are required',
                    'Forced teardown, native loss recovery and physical acceptance remain incomplete',
                  ]
                : android
                  ? [
                      'Hardware and ARM64/Release qualification remain incomplete',
                      'Korean composing, accessibility, native loss recovery and scanout remain unverified',
                    ]
                  : [
                      'Browser context loss, physical input/accessibility and complete memory accounting require further qualification',
                    ],
        };
        const capabilities = caps(target, implemented);
        return {
          id,
          cohorts:
            id === 'rn-jsc-graphite-vulkan'
              ? ['rn-0.83.10-jsc']
              : id === 'rn-v8-graphite-vulkan'
                ? ['rn-0.83.10-v8']
                : android
                  ? cohorts.map((cohort) => cohort.id)
                  : [defaultCohort],
          identity: {
            target,
            runtime: web
              ? 'browser'
              : id === 'rn-jsc-graphite-vulkan'
                ? 'jsc'
                : id === 'rn-v8-graphite-vulkan'
                  ? 'v8'
                  : 'hermes',
            host: web ? 'react-dom' : 'fabric',
            renderer: web ? 'skia-ganesh' : 'skia-graphite',
            gpuBackend: web
              ? 'webgl2'
              : target === 'ios' || target === 'macos'
                ? 'metal'
                : 'vulkan',
            gpuImplementation: web
              ? 'browser-webgl2'
              : target === 'windows' || target === 'linux'
                ? 'native-vulkan'
                : 'dawn',
            profile: id,
          },
          status: implemented ? 'implemented' : 'unsupported',
          reason,
          executionOperatingSystems: [web ? 'browser' : target === 'macos' ? 'darwin' : target],
          architectures: arch,
          artifactManifest: {
            entry: implemented
              ? web
                ? '@nelyx/skia-web/native-manifest.json'
                : '@nelyx/skia-rn/native-manifest.json'
              : target === 'ios' || target === 'macos'
                ? '@nelyx/skia-rn/apple/native-supply.json'
                : null,
            kind: web ? 'binary' : 'recipe',
            required,
          },
          nativeAbi: { host: null, skia: 1 },
          wireAbi: 10,
          capabilities: web
            ? {
                ...capabilities,
                editing: {
                  ...capabilities.editing,
                  composing: 'observed',
                  selectionDirection: 'observed',
                  nativeRevision: 'observed',
                },
                semantics: 'dom',
              }
            : capabilities,
          qualification,
        };
      });
      const first = profiles[0]!;
      const buildHosts: ProviderOperatingSystem[] =
        target === 'ios' || target === 'macos'
          ? ['darwin']
          : target === 'windows'
            ? ['windows']
            : target === 'linux'
              ? ['linux']
              : hosts;
      const hostOperatingSystems = Object.fromEntries(
        operations.map((operation) => [
          operation,
          operation === 'doctor' || operation === 'pack' ? hosts : buildHosts,
        ]),
      );
      const tooling: ProviderTool[] = [
        {
          id: 'node',
          kind: 'executable',
          versionRange: '>=24.3.0 <25.0.0',
          operations: [...operations],
          hostOperatingSystems: hosts,
        },
        {
          id: 'npm',
          kind: 'executable',
          versionRange: '>=11.0.0 <12.0.0',
          operations: ['doctor', 'build', 'dev', 'pack'],
          hostOperatingSystems: hosts,
        },
      ];
      if (!web)
        tooling.push({
          id: 'react-native',
          kind: 'package',
          versionRange: cohorts[0]!.reactNative,
          operations: ['build', 'dev'],
          hostOperatingSystems: buildHosts,
        });
      if (target === 'windows')
        tooling.push(
          {
            id: 'react-native-windows',
            kind: 'package',
            versionRange: '0.83.2',
            operations: ['build', 'dev'],
            hostOperatingSystems: buildHosts,
          },
          {
            id: 'windows-sdk',
            kind: 'sdk',
            versionRange: '10.0.26100.0',
            operations: ['build'],
            hostOperatingSystems: buildHosts,
          },
        );
      if (target === 'linux')
        tooling.push(
          {
            id: 'cmake',
            kind: 'executable',
            versionRange: '>=3.25.0 <5.0.0',
            operations: ['build'],
            hostOperatingSystems: buildHosts,
          },
          {
            id: 'gtk4',
            kind: 'sdk',
            versionRange: '>=4.14.0 <5.0.0',
            operations: ['build'],
            hostOperatingSystems: buildHosts,
          },
        );
      if (target === 'android')
        tooling.push(
          {
            id: 'jdk',
            kind: 'executable',
            versionRange: '>=21.0.0 <22.0.0',
            operations: ['build', 'dev'],
            hostOperatingSystems: hosts,
          },
          {
            id: 'android-ndk',
            kind: 'sdk',
            versionRange: '27.1.12297006',
            operations: ['build'],
            hostOperatingSystems: hosts,
          },
          {
            id: 'android-build-tools',
            kind: 'sdk',
            versionRange: '36.0.0',
            operations: ['build'],
            hostOperatingSystems: hosts,
          },
          {
            id: 'adb',
            kind: 'executable',
            versionRange: '>=1.0.41 <2.0.0',
            operations: ['run', 'dev'],
            hostOperatingSystems: hosts,
          },
        );
      if (target === 'ios' || target === 'macos')
        tooling.push({
          id: 'xcode',
          kind: 'component',
          versionRange: null,
          operations: ['build', 'run', 'dev'],
          hostOperatingSystems: ['darwin'],
        });
      return {
        schema: 'nelyx.provider/v4',
        id: `nelyx.${target}`,
        version: sdkVersion,
        coreRange: compatibleCoreRange,
        protocolVersion: 1,
        target,
        runtime: first.identity.runtime,
        host: first.identity.host,
        renderer: first.identity.renderer,
        entry: `@nelyx/sdk/platforms/${target}/application`,
        defaultProfile: first.id,
        cohorts,
        defaultCohort,
        hostOperatingSystems,
        operations: [...operations],
        architectures: [...new Set(profiles.flatMap((profile) => profile.architectures))],
        tooling,
        artifactManifest: first.artifactManifest,
        nativeAbi: first.nativeAbi,
        wireAbi: first.wireAbi,
        capabilities: first.capabilities,
        qualification: first.qualification,
        profiles,
      };
    }),
  );
}
