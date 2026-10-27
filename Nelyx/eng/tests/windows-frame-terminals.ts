// SPDX-License-Identifier: BSD-3-Clause
// Appended to the native fixture before bundling; also exercised directly by Node.
export interface NativeFrameObservation {
  readonly stage:number;readonly view:number;readonly contextGeneration:number;
  readonly submission:number;readonly ownerGeneration:number;readonly frameSequence:number;
  readonly surfaceGeneration:number;
}
export function validateNativeFrameTerminals(entries:readonly NativeFrameObservation[]){
  const groups=new Map<string,{started:boolean;packet:NativeFrameObservation[]}>();
  let completed=0,superseded=0;
  for(const entry of entries){
    if(entry.stage>=6)continue;
    if(entry.stage===5)throw Error('Native frame failed: '+JSON.stringify(entry));
    const key=entry.view+':'+entry.contextGeneration+':'+entry.submission;
    let group=groups.get(key);if(!group)groups.set(key,group={started:false,packet:[]});
    // Capture may begin during a packet. Only that initial prefix is partial;
    // after seeing a submission every stage of each replay must be present.
    if(!group.started&&entry.stage!==0)continue;
    if(entry.stage===0){
      if(group.packet.length)throw Error('Native packet restarted before retirement: '+JSON.stringify([...group.packet,entry]));
      group.started=true;group.packet.push(entry);continue;
    }
    const index=group.packet.length,valid=index===1?entry.stage===1:index===2?entry.stage===2||entry.stage===4:index===3&&entry.stage===3;
    if(!valid)throw Error('Invalid native terminal order: '+JSON.stringify([...group.packet,entry]));
    group.packet.push(entry);
    if(entry.stage!==3)continue;
    if(group.packet.some(value=>value.ownerGeneration<1||value.frameSequence<1||value.contextGeneration<1||value.surfaceGeneration<1))throw Error('Native boundary lost the immutable Core frame identity');
    completed++;if(group.packet[2]!.stage===4)superseded++;group.packet=[];
  }
  // An admitted tail can still be in flight at this observation boundary.
  return {completed,superseded};
}
