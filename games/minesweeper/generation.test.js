import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCandidate,solveBoard} from './generation.js';
import {generateBoard} from './board-generator.js';
import {fallbackSeeds} from './generation-seeds.js';
import {neighbors} from './engine.js';
import {BoardGenerator} from './generation-client.js';
for(const total of [8,11,15])test(`${total} mines: verified logic and final-pair fallback for all 64 first clicks`,()=>{
 for(let first=0;first<64;first++)for(const kind of ['logic','one-guess']){
  const result=generateBoard({first,total,kind,budgetMs:0});
  assert.equal(result.analysis.kind,kind);assert.equal(result.fallback,true);
  assert.equal(result.board.filter(c=>c.mine).length,total);
  for(const i of [first,...neighbors(first)])assert.equal(result.board[i].mine,false);
  assert.ok(result.board.every(c=>!c.open&&!c.known));
  if(kind==='one-guess'){
   assert.equal(result.analysis.opened,63-total);
   const pair=result.analysis.pair;assert.equal(pair.length,2);
   assert.equal(pair.filter(i=>result.board[i].mine).length,1);
   // Reverse the ambiguous pair, recompute numbers, and verify the solver
   // still reaches exactly the same final pair without any earlier guess.
   const swapped=result.board.map(c=>({...c}));
   [swapped[pair[0]].mine,swapped[pair[1]].mine]=[swapped[pair[1]].mine,swapped[pair[0]].mine];
   swapped.forEach((c,i)=>c.number=neighbors(i).filter(j=>swapped[j].mine).length);
   const other=solveBoard(swapped,first,total);
   assert.equal(other.kind,'one-guess');assert.deepEqual(other.pair,pair);
  }
 }
});
test('random generation only returns requested certified kinds',()=>{
 for(let seed=1;seed<=80;seed++){
  const first=seed%64,total=[8,11,15][seed%3],kind=seed%4?'logic':'one-guess';
  const r=generateBoard({first,total,kind,seed,budgetMs:50});
  assert.equal(r.analysis.kind,kind);assert.equal(solveBoard(r.board,first,total).kind,kind);
 }
});
test('worker unavailable uses a verified layout instead of raw random fallback',async()=>{
 const client=new BoardGenerator(()=>{throw Error('No worker available');});
 const r=await client.generate(27,15,'one-guess');assert.equal(r.analysis.kind,'one-guess');assert.equal(r.fallback,true);
});
test('late response from cancelled generation cannot replace the next board',async()=>{
 const workers=[];const client=new BoardGenerator(()=>{const w={postMessage(data){this.data=data;},terminate(){this.terminated=true;}};workers.push(w);return w;});
 const first=client.generate(0,8,'logic');client.cancel();assert.equal(await first,null);
 const next=client.generate(63,15,'logic');
 workers[0].onmessage({data:{id:workers[0].data.id,result:{bad:true}}});
 const expected=inspectCandidate(63,15,fallbackSeeds[15][63].logic);
 workers[1].onmessage({data:{id:workers[1].data.id,result:expected}});
 assert.equal((await next).analysis.kind,'logic');assert.equal(workers[0].terminated,true);
});
test('worker error resolves with certified fallback',async()=>{
 let worker;const client=new BoardGenerator(()=>worker={postMessage(){},terminate(){}});
 const result=client.generate(5,11,'logic');worker.onerror();assert.equal((await result).analysis.kind,'logic');
});
