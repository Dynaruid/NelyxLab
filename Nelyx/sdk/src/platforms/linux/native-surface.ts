// SPDX-License-Identifier: BSD-3-Clause
import type {NativeSyntheticEvent} from 'react-native';
import type {LinuxSurfaceStatus} from '@nelyx/skia-rn/views/types';
import type {ReactNativeSurfaceBinding} from '../../backends/react-native/surface.tsx';

/** Native binding/backing metrics gate; a Yoga layout alone cannot open the SDK renderer. */
export function createLinuxNativeSurfaceProps(binding:ReactNativeSurfaceBinding,verifyHost:()=>void) {
  let failed=false,lastGeneration=0;
  const reject=(reason:string)=>{if(failed)return;failed=true;binding.failed(new Error(reason));};
  return {onLinuxSurfaceStatus(event:NativeSyntheticEvent<LinuxSurfaceStatus>) {
    if(failed)return;const status=event.nativeEvent;
    if(status.phase==='failed'){reject(status.reason || 'Linux native surface failed');return;}
    if(!['layout','bound','unsupported'].includes(status.phase))return;
    try{verifyHost();}catch(error){reject(error instanceof Error?error.message:String(error));return;}
    binding.visibility(status.mapped && status.width>0 && status.height>0);
    if(!status.bound)return;
    if(!status.gpuPrepared){reject('Linux native Vulkan/DMA-BUF GPU is not initialized; product surface admission denied');return;}
    if(status.logicalWidth<=0 || status.logicalHeight<=0 || status.width<=0 || status.height<=0)return;
    if(![status.logicalWidth,status.logicalHeight,status.width,status.height,status.scale].every(Number.isFinite) ||
      status.scale<=0 || status.scale>8 || status.width>4096 || status.height>4096 ||
      Math.round(status.logicalWidth*status.scale)!==status.width || Math.round(status.logicalHeight*status.scale)!==status.height ||
      !Number.isSafeInteger(status.surfaceGeneration) || status.surfaceGeneration<=0){reject('Linux native backing metrics failed admission');return;}
    if(status.surfaceGeneration<lastGeneration){reject('Linux native surface generation regressed');return;}
    if(status.surfaceGeneration===lastGeneration)return;lastGeneration=status.surfaceGeneration;
    binding.ready(Object.freeze({logicalWidth:status.logicalWidth,logicalHeight:status.logicalHeight,
      physicalWidth:status.width,physicalHeight:status.height,scale:status.scale,nativeSurfaceGeneration:status.surfaceGeneration}));
  }};
}
