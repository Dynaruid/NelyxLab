import type {PlatformId} from '@nelyx/core/hosting/platform';
export interface AppPackageReferences {
  readonly native?:string;readonly rn?:string;readonly web?:string;readonly metro?:string;readonly cli?:string;
  readonly 'static-aot'?:string;
  readonly android?:string;readonly ios?:string;readonly macos?:string;
  readonly targets?:readonly PlatformId[];
  readonly profiles?:Readonly<Partial<Record<PlatformId,string>>>;
  readonly linuxPackages?:Readonly<Record<string,string>>;
  readonly material?:string;readonly cupertino?:string;
  readonly designs?:readonly ('material'|'cupertino')[];
}
export declare function createApp(destination:string,sdkReference?:string,name?:string,coreReference?:string,references?:AppPackageReferences):Promise<string>;
