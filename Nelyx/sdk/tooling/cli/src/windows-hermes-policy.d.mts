import type {ProviderCohort} from '@nelyx/sdk/runtime/cohorts';
export type WindowsHermesProfile='debug'|'optimized';
export interface WindowsHermesPolicy {readonly id:string;readonly profile:WindowsHermesProfile;readonly flags:readonly string[];}
export declare function windowsHermesPolicy(profile:WindowsHermesProfile|undefined,cohort:ProviderCohort):WindowsHermesPolicy;
