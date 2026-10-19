export const SIZE=8;
export function neighbors(i){const out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=i%8+dx,y=Math.floor(i/8)+dy;if((dx||dy)&&x>=0&&x<8&&y>=0&&y<8)out.push(y*8+x);}return out;}
export function createBoard(first,count,random=Math.random){const excluded=new Set([first,...neighbors(first)]);const choices=Array.from({length:64},(_,i)=>i).filter(i=>!excluded.has(i));for(let i=choices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}const bombs=new Set(choices.slice(0,count));return Array.from({length:64},(_,i)=>({mine:bombs.has(i),number:neighbors(i).filter(j=>bombs.has(j)).length,open:false,known:false}));}
// Only the requested local rule: closed neighbor count equals the visible number.
// Known poisoned cells are still sealed and remain part of that count.
export function deduce(visible){
  const mines=new Set();
  visible.forEach((cell,i)=>{
    if(!cell.open || !(cell.number>0))return;
    const closed=neighbors(i).filter(j=>!visible[j].open);
    if(closed.length===cell.number)closed.forEach(j=>mines.add(j));
  });
  return {mines:[...mines]};
}
