// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional basicLocaleListResolution port on Nelyx's locale-tag ABI.
import {invariant} from '../../foundation/errors.ts';
import {languageAliases,regionAliases} from './locale-data.generated.ts';
interface LocaleParts {readonly language:string;readonly script:string|null;readonly region:string|null}
function parts(value:string):LocaleParts {
  const values=value.replaceAll('_','-').split('-'),language=values[0]!.toLowerCase();
  invariant(/^[a-z]{2,8}$/.test(language),'invalid-app-locale','Locale requires a language subtag');
  let index=1;const script=/^[a-zA-Z]{4}$/.test(values[index]??'')?values[index++]!.toLowerCase():null;
  const region=/^([a-zA-Z]{2}|[0-9]{3})$/.test(values[index]??'')?values[index]!.toUpperCase():null;
  return {language:languageAliases[language]??language,script,region:region===null?null:regionAliases[region]??region};
}
export function canonicalLocaleTag(locale:string):string{const p=parts(locale),script=p.script===null?null:p.script[0]!.toUpperCase()+p.script.slice(1);return [p.language,script,p.region].filter(value=>value!==null).join('-');}
export type LocaleListResolutionCallback=(preferred:readonly string[]|null,supported:readonly string[])=>string|null;
export type LocaleResolutionCallback=(preferred:string|null,supported:readonly string[])=>string|null;
/** Supported order resolves duplicate tuples. Tags remain application strings. */
export function resolveLocale(preferred:readonly string[]|null,supported:readonly string[]):string {
  invariant(supported.length>0,'empty-supported-locales','WidgetsApp requires supported locales');
  const choices=supported.map(parts);if(!preferred?.length)return supported[0]!;
  const users=preferred.map(parts),exact=new Map<string,string>(),script=new Map<string,string>(),region=new Map<string,string>(),language=new Map<string,string>(),country=new Map<string,string>();
  const put=(map:Map<string,string>,key:string,value:string)=>{if(!map.has(key))map.set(key,value);};
  for(let i=0;i<choices.length;i++){const p=choices[i]!,value=supported[i]!;put(exact,`${p.language}_${p.script}_${p.region}`,value);put(script,`${p.language}_${p.script}`,value);put(region,`${p.language}_${p.region}`,value);put(language,p.language,value);put(country,String(p.region),value);}
  let languageMatch:string|undefined,countryMatch:string|undefined;
  for(let i=0;i<users.length;i++){
    const p=users[i]!,perfect=exact.get(`${p.language}_${p.script}_${p.region}`);if(perfect!==undefined)return perfect;
    const byScript=p.script===null?undefined:script.get(`${p.language}_${p.script}`);if(byScript!==undefined)return byScript;
    const byRegion=p.region===null?undefined:region.get(`${p.language}_${p.region}`);if(byRegion!==undefined)return byRegion;
    if(languageMatch!==undefined)return languageMatch;
    languageMatch=language.get(p.language);
    if(languageMatch!==undefined&&i===0&&users[i+1]?.language!==p.language)return languageMatch;
    if(countryMatch===undefined&&p.region!==null)countryMatch=country.get(p.region);
  }
  return languageMatch??countryMatch??supported[0]!;
}
export function resolveAppLocale(preferred:readonly string[]|null,supported:readonly string[],list?:LocaleListResolutionCallback,single?:LocaleResolutionCallback):string {
  invariant(supported.length>0,'empty-supported-locales','WidgetsApp requires supported locales');
  const resolved=list?.(preferred,supported)??single?.(preferred?.[0]??null,supported)??resolveLocale(preferred,supported);parts(resolved);return resolved;
}
export function localeDirection(locale:string):'ltr'|'rtl'{const p=parts(locale);if(p.script!==null)return ['arab','hebr','thaa','nkoo','adlm','syrc'].includes(p.script)?'rtl':'ltr';return ['ar','fa','he','ur','ps','sd','ug','yi','dv'].includes(p.language)?'rtl':'ltr';}
