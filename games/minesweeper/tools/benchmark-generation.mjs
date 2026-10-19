import {guessChances} from '../board-generator.js';
import {Worker} from 'node:worker_threads';
import {writeFileSync} from 'node:fs';
const worker=new Worker(new URL('./generation-benchmark-worker.mjs',import.meta.url));
let id=0;const pending=new Map();worker.on('message',data=>{const p=pending.get(data.id);pending.delete(data.id);if(data.error)p.reject(Error(data.error));else p.resolve(data.result);});
function request(options){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});worker.postMessage({id:key,...options});});}
const report={environment:`Node ${process.version} / ${process.platform} ${process.arch}`,samplesPerDifficulty:400,results:[]};
let beats=0,maxGap=0,last=performance.now();const heartbeat=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;beats++;},5);
const cold=performance.now();await request({first:27,total:15,kind:'logic',seed:1234});report.coldWorkerRoundTripMs=performance.now()-cold;
for(const [level,total] of [8,11,15].entries()){
 const samples=[],wall=[],attempts=[];let fallback=0,guess=0;
 for(let i=0;i<400;i++){
  const kind=i%100<guessChances[level]*100?'one-guess':'logic';if(kind==='one-guess')guess++;
  const start=performance.now();const r=await request({first:i%64,total,kind,seed:1000000+i*101+total});
  samples.push(r.computeMs);wall.push(performance.now()-start);attempts.push(r.attempts);fallback+=r.fallback?1:0;
 }
 const summarize=xs=>{const sorted=[...xs].sort((a,b)=>a-b);return {mean:xs.reduce((a,b)=>a+b,0)/xs.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};};
 report.results.push({total,guessBoards:guess,fallbacks:fallback,computeMs:summarize(samples),roundTripMs:summarize(wall),attempts:summarize(attempts)});
}
clearInterval(heartbeat);await worker.terminate();report.heartbeat={intervalMs:5,ticks:beats,maxGapMs:maxGap};
writeFileSync('tools/generation-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
