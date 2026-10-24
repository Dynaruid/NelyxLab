// SPDX-License-Identifier: BSD-3-Clause
import {describeError} from '@nelyx/core/foundation/errors';
import React,{useMemo,useState} from 'react';
import {ApplicationSurface} from '@nelyx/sdk/platforms/windows/surface';
import {NativeLayer,NativeText} from '@nelyx/sdk/platforms/windows/controls';
import {main} from '../../src/index.ts';

export default function App(){
  const shared=useMemo(()=>main(),[]),[error,setError]=useState('');
  return <NativeLayer style={{flex:1,backgroundColor:'#101827'}}>
    {error?<NativeText style={{color:'#ffb4ab'}}>{error}</NativeText>:null}
    <ApplicationSurface definition={shared.definition} generation={1} onReady={()=>{}} onError={error=>{const message=describeError(error);console.error(message,error);setError(message);}}/>
  </NativeLayer>;
}
