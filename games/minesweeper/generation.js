import {createBoard,neighbors} from './engine.js';
const adjacent=Array.from({length:64},(_,i)=>neighbors(i));
export function seededRandom(seed){let value=seed>>>0;return ()=>{value+=0x6D2B79F5;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
// Generator-only solver. Only opened clues enter deduction. The real layout
// is used to reveal proven-safe cells and to assert the deductions are sound.
export function solveBoard(board,first,total){
 const opened=new Set(),marked=new Set();let rounds=0,subsetSteps=0;
 const reveal=cells=>{const queue=[...cells];while(queue.length){const i=queue.pop();if(opened.has(i)||marked.has(i))continue;if(board[i].mine)throw Error('Solver opened an unproven mine');opened.add(i);if(board[i].number===0)queue.push(...adjacent[i]);}};
 reveal([first]);
 while(opened.size<64-total&&rounds++<128){
  const constraints=[],keys=new Set();
  const add=(cells,count)=>{if(count<0||count>cells.length)throw Error('Invalid generated constraint');if(!cells.length)return;const key=cells.join(',');if(!keys.has(key)){keys.add(key);constraints.push({cells,count,set:new Set(cells)});}};
  for(const i of opened){const ns=adjacent[i];add(ns.filter(j=>!opened.has(j)&&!marked.has(j)),board[i].number-ns.filter(j=>marked.has(j)).length);}
  add(Array.from({length:64},(_,i)=>i).filter(i=>!opened.has(i)&&!marked.has(i)),total-marked.size);
  const safe=new Set(),mines=new Set();
  const infer=(cells,count)=>{if(count===0)cells.forEach(i=>safe.add(i));else if(count===cells.length)cells.forEach(i=>mines.add(i));};
  constraints.forEach(c=>infer(c.cells,c.count));
  if(!safe.size&&!mines.size){
   for(const a of constraints)for(const b of constraints){
    if(a.cells.length>=b.cells.length||!a.cells.every(i=>b.set.has(i)))continue;
    const cells=b.cells.filter(i=>!a.set.has(i)),count=b.count-a.count;
    infer(cells,count);
   }
   if(safe.size||mines.size)subsetSteps++;
  }
  if(!safe.size&&!mines.size)break;
  for(const i of mines){if(!board[i].mine)throw Error('Solver marked a safe cell');marked.add(i);}
  reveal(safe);
 }
 if(opened.size===64-total)return {kind:'logic',rounds,subsetSteps,opened:opened.size};
 const unknown=Array.from({length:64},(_,i)=>i).filter(i=>!opened.has(i)&&!marked.has(i));
 // A genuine final 50/50: just one safe cell remains, and swapping the two
 // candidates leaves every visible clue unchanged. No earlier guess needed.
 const pair=unknown.length===2&&opened.size===63-total&&total-marked.size===1&&[...opened].every(i=>adjacent[i].includes(unknown[0])===adjacent[i].includes(unknown[1]));
 return {kind:pair?'one-guess':'blocked',rounds,subsetSteps,opened:opened.size,pair:pair?unknown:undefined};
}
export function inspectCandidate(first,total,seed){const board=createBoard(first,total,seededRandom(seed));return {board,analysis:solveBoard(board,first,total),seed};}
