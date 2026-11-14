// SPDX-License-Identifier: BSD-3-Clause
/** Shared by the Source binding and actual Hermes VM/native-unit checks. */
export function layoutEncoderFixture() {
  return `
    const layoutEncoderResult=(()=>{
      const check=(condition,label)=>{if(!condition)throw Error('Layout encoder: '+label);};
      const node={slot:7,generation:2},reads=[];let handleReads=0,caught;
      const tracked={get slot(){++handleReads;return 7;},get generation(){++handleReads;return 2;}};
      try{layoutCommands.layout(tracked,{
        get flex(){reads.push('flex');return NaN;},
        padding:{get left(){reads.push('left');return 1;},get top(){reads.push('top');return 2;},get right(){reads.push('right');return 3;},get bottom(){reads.push('bottom');return 4;}},
        get inlineScale(){reads.push('scale');return 1;},
      });}catch(error){caught=error;}
      check(caught instanceof RangeError&&caught.message==='Invalid engine scalar','non-finite validation');
      check(reads.join(',')==='scale,flex,left,top,right,bottom,scale'&&handleReads===0,'aggregate reads precede scalar validation and handle access');
      const sentinel={layoutGetter:true};let scales=0; caught=undefined;
      try{layoutCommands.layout(node,{flex:NaN,get inlineScale(){if(++scales===2)throw sentinel;return 1;}});}catch(error){caught=error;}
      check(caught===sentinel&&scales===2,'late producer exception precedes an earlier invalid scalar');
      let positionedReads=0;
      const positioned=layoutCommands.layout(node,{get positioned(){const n=++positionedReads;return {left:n,top:n,right:n,bottom:n,width:n,height:n};}});
      const positionedView=new DataView(positioned.buffer,positioned.byteOffset,positioned.byteLength);
      check(positionedReads===6&&positionedView.getUint32(16+layoutProtocol.layoutFields.positionedFlags,true)===63,'positioned getter count and flags');
      for(let i=0;i<6;++i)check(positionedView.getFloat64(16+layoutProtocol.layoutFields.positioned+i*8,true)===i+1,'positioned getter order');
      const zero=layoutCommands.layout(node,{flex:-0,gap:-0,runGap:-0,padding:{left:-0,top:-0,right:-0,bottom:-0},alignment:{x:-0,y:-0},widthFactor:-0,heightFactor:-0,inlineScale:-0,positioned:{left:-0,top:-0,right:-0,bottom:-0,width:-0,height:-0}});
      const zeroView=new DataView(zero.buffer,zero.byteOffset,zero.byteLength);
      for(let i=0;i<12;++i)check(Object.is(zeroView.getFloat64(16+32+i*8,true),-0),'scalar signed zero');
      for(let i=0;i<6;++i)check(Object.is(zeroView.getFloat64(16+layoutProtocol.layoutFields.positioned+i*8,true),-0),'positioned signed zero');
      check(zero.length===16+layoutProtocol.layoutBytes,'wire length');
      return {cases:4,bytes:zero.length,scalarReads:reads.length,positionedReads};
    })();
  `;
}
