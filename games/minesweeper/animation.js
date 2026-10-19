// Frame callbacks can carry a timestamp earlier than performance.now() at
// registration. Clamp the index and always settle, even if rendering stops.
export function playFrameAnimation(element,frames,{className='effect',isCurrent=()=>true,reduced=false,runtime=globalThis}={}){
 if(reduced||!element||!frames?.length)return Promise.resolve();
 return new Promise(resolve=>{
  const image=runtime.document.createElement('img');image.className=className;image.alt='';
  let frameRequest=null,timeout=null,finished=false;
  const finish=()=>{if(finished)return;finished=true;if(frameRequest!==null)runtime.cancelAnimationFrame(frameRequest);if(timeout!==null)runtime.clearTimeout(timeout);image.remove();resolve();};
  const start=runtime.performance.now();
  const duration=frames.length/30*1000;
  const tick=timestamp=>{
   if(finished)return;
   try{
    if(!isCurrent()||!image.isConnected){finish();return;}
    const index=Math.max(0,Math.floor((timestamp-start)/1000*30));
    if(index>=frames.length){finish();return;}
    if(frames[index]?.src)image.src=frames[index].src;
    frameRequest=runtime.requestAnimationFrame(tick);
   }catch(error){runtime.console?.warn('Frame animation interrupted',error);finish();}
  };
  try{image.src=frames[0].src;element.append(image);timeout=runtime.setTimeout(finish,duration+250);frameRequest=runtime.requestAnimationFrame(tick);}catch(error){runtime.console?.warn('Frame animation unavailable',error);finish();}
 });
}
export function settleWithin(promise,milliseconds){
 return new Promise(resolve=>{
  const timer=setTimeout(resolve,milliseconds);
  Promise.resolve(promise).catch(()=>{}).finally(()=>{clearTimeout(timer);resolve();});
 });
}
