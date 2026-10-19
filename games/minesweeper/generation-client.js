import {generateBoard} from './board-generator.js';
export class BoardGenerator{
 constructor(workerFactory=()=>new Worker(new URL('./generation-worker.js',import.meta.url),{type:'module'})){this.workerFactory=workerFactory;this.worker=null;this.pending=null;this.nextId=0;}
 warm(){
  if(this.worker)return;
  try{const worker=this.workerFactory();this.worker=worker;
   worker.onmessage=({data})=>{if(this.pending?.id!==data.id)return;if(data.error)this.fallback();else this.complete(data.result);};
   worker.onerror=()=>{if(this.worker!==worker)return;this.worker?.terminate();this.worker=null;this.fallback();};
  }catch{this.worker=null;}
 }
 complete(result){const pending=this.pending;if(!pending)return;clearTimeout(pending.timer);this.pending=null;pending.resolve(result?{...result,wallMs:performance.now()-pending.start}:null);}
 fallback(){const pending=this.pending;if(!pending)return;try{const result=generateBoard({...pending.options,budgetMs:0,maxAttempts:0});this.complete(result);}catch(error){clearTimeout(pending.timer);this.pending=null;pending.reject(error);}}
 generate(first,total,kind){
  this.cancel();this.warm();
  const options={first,total,kind,seed:Math.floor(Math.random()*0x100000000)};
  return new Promise((resolve,reject)=>{
   const id=++this.nextId;this.pending={id,options,resolve,reject,start:performance.now(),timer:null};
   if(!this.worker){this.fallback();return;}
   this.pending.timer=setTimeout(()=>{this.worker?.terminate();this.worker=null;this.fallback();},1200);
   try{this.worker.postMessage({id,...options});}catch{this.worker.terminate();this.worker=null;this.fallback();}
  });
 }
 dispose(){this.cancel();this.worker?.terminate();this.worker=null;}
 cancel(){if(this.pending){this.worker?.terminate();this.worker=null;this.complete(null);}}
}
