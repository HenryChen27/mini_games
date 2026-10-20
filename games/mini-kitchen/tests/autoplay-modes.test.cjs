const assert=require('node:assert/strict');
const {Kitchen}=require('../engine.js');
const {planBatch,validJob,scheduleBatch}=require('../dev-autoplay.js');
const apply=(k,a)=>a.kind==='ingredient'?k.autoCook(a.value)>=0:a.kind==='pot'?k.take(a.i).ok:a.kind==='storage'?k.takeStorage(a.i).ok:k.serve(a.value).ok;
const results={};
for(const mode of ['ordinary','greedy','fastest']){
 let seed=71;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32),k=new Kitchen(random);let queue=[],lastButtons=new Map(),decisions=0,actions=0,parallel=0;
 for(let frame=0;frame<5400&&!k.ended;frame++){
  const now=frame/60;k.tick(1/60);
  if(!queue.length){queue=scheduleBatch(planBatch(k.snapshot(),mode),mode,now*1000,mode==='ordinary'?850:mode==='greedy'?260:0,lastButtons);decisions++;}
  let batch=0;while(queue.length&&queue[0].due<=now*1000){const job=queue.shift();if(validJob(job,k.snapshot())){assert(apply(k,job.action));actions++;batch++;}}
  parallel=Math.max(parallel,batch);
 }
 results[mode]={score:k.score,completed:k.completed,actions,parallel,decisions};
 assert(k.elapsed>89.9&&k.elapsed<=90);assert(actions>0);assert(parallel>1);
}
assert(results.fastest.score>results.greedy.score);assert(results.greedy.score>results.ordinary.score);
console.log('Decision-latency modes (90s):',results);

const jobs=[{action:{kind:'ingredient',value:'water'},i:0},{action:{kind:'ingredient',value:'water'},i:1},{action:{kind:'ingredient',value:'raw_beef'},i:3}];
for(const [mode,gap] of [['ordinary',320],['greedy',150],['fastest',0]]){const q=scheduleBatch(jobs,mode,1000,200);assert.equal(q.find(j=>j.i===0).due,1200);assert.equal(q.find(j=>j.i===3).due,1200);assert.equal(q.find(j=>j.i===1).due,1200+gap);}
