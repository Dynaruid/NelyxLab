import type {ProviderCohort} from '@nelyx/sdk/runtime/cohorts';
export interface AndroidHermesPolicy {readonly id:string;readonly flags:readonly string[]}
export interface AndroidHermesBuildInput {readonly policy:AndroidHermesPolicy;readonly gradle:string;readonly gradleSha256:string;readonly compiler:string;readonly compilerSha256:string;readonly report:string}
export interface AndroidHermesBuildDetails {readonly hermesCompilerFlags:string;readonly hermesCompilerPolicy:string;readonly hermesCompilerSha256:string;readonly hermesGradleSha256:string}
export function androidHermesPolicy(cohort:ProviderCohort):AndroidHermesPolicy;
export function prepareAndroidHermesBuild(app:string,cohort:ProviderCohort):AndroidHermesBuildInput;
export function finishAndroidHermesBuild(input:AndroidHermesBuildInput):AndroidHermesBuildDetails;
export function verifyAndroidHermesDetails(cohort:ProviderCohort,details:unknown,report:unknown):void;
