/* DEVELOPMENT ONLY. Remove this file and its index.html script tag before release.
   Greedy actions use the same public input path as manual play; no score/time changes. */
(function(root){
 'use strict';
 const additions={corn_soup:'corn',carrot_soup:'carrot',tomato_beef:'tomato',potato_beef:'potato'};
 const family=d=>d==='soup'||d.endsWith('_soup')?'soup':'beef';
 const instant=new Set(['rice','bread','candy']);
 function chooseAction(state){
  if(!state||state.ended)return null;
  const pending=[];
  for(const order of state.orders){const remaining=order.done.filter(d=>!d).length;order.dishes.forEach((dish,i)=>{if(!order.done[i])pending.push({dish,priority:order.age*12+180/remaining});});}
  pending.sort((a,b)=>b.priority-a.priority);
  const available=[];
  for(const need of pending){
   state.storage.forEach((dish,i)=>{if(dish===need.dish)available.push({score:1200+need.priority,action:{kind:'storage',i}});});
   state.pots.forEach((p,i)=>{if(p.state==='ready'&&p.dish===need.dish)available.push({score:1000+need.priority+p.age*5,action:{kind:'pot',i}});});
   if(instant.has(need.dish))available.push({score:1000+need.priority,action:{kind:'instant',value:need.dish}});
  }
  if(available.length){available.sort((a,b)=>b.score-a.score);return available[0].action;}
  const burnt=state.pots.findIndex(p=>p.state==='burnt');
  if(burnt>=0)return{kind:'pot',i:burnt};
  // Rescue nearly burnt portions before preparing additional food.
  if(!state.frenzy){
   const urgent=state.pots.map((p,i)=>({...p,i})).filter(p=>p.state==='ready'&&p.age>=14).sort((a,b)=>b.age-a.age)[0];
   if(urgent){
    const sameFamily=i=>(urgent.i<3?i<3:i>=3);
    if(state.storage.some((d,i)=>sameFamily(i)&&!d))return{kind:'pot',i:urgent.i};
    const discard=state.storage.findIndex((d,i)=>sameFamily(i)&&d&&!pending.some(n=>n.dish===d));
    if(discard>=0)return{kind:'storage',i:discard};
   }
  }
  // Reserve each existing portion once, so duplicate dishes do not cause overproduction.
  const stock=[];
  state.storage.forEach((dish,i)=>{if(dish)stock.push({dish,ready:true,stored:true,i});});
  state.pots.forEach((p,i)=>{if(p.state==='ready'||p.state==='cooking')stock.push({dish:p.dish,ready:p.state==='ready',stored:false,age:p.age,i});});
  const candidates=[];
  for(const need of pending){
   if(instant.has(need.dish))continue;
   const exact=stock.find(s=>!s.used&&s.dish===need.dish);
   if(exact){exact.used=true;continue;}
   const type=family(need.dish),ingredient=additions[need.dish];
   if(ingredient){
    const base=stock.filter(s=>!s.used&&!s.stored&&s.dish===type).sort((a,b)=>Number(b.ready)-Number(a.ready)||(b.age||0)-(a.age||0))[0];
    if(base){base.used=true;if(base.ready)candidates.push({score:600+need.priority,action:{kind:'ingredient',value:ingredient}});continue;}
   }
   const free=state.pots.some((p,i)=>(type==='soup'?i<3:i>=3)&&p.state==='empty');
   if(free)candidates.push({score:400+need.priority,action:{kind:'ingredient',value:type==='soup'?'water':'raw_beef'}});
  }
  if(candidates.length){candidates.sort((a,b)=>b.score-a.score);return candidates[0].action;}
  // Reclaim blocked capacity only when that cooking family has outstanding demand.
  for(const type of ['soup','beef']){
   if(!pending.some(n=>!instant.has(n.dish)&&family(n.dish)===type))continue;
   const spare=stock.filter(s=>!s.used&&!s.stored&&s.ready&&family(s.dish)===type).sort((a,b)=>b.age-a.age)[0];
   if(!spare)continue;
   const empty=state.storage.some((dish,i)=>!dish&&(type==='soup'?i<3:i>=3));
   if(empty)return{kind:'pot',i:spare.i};
   const stale=state.storage.findIndex((dish,i)=>dish&&(type==='soup'?i<3:i>=3)&&!pending.some(n=>n.dish===dish));
   if(stale>=0)return{kind:'storage',i:stale};
  }
  // Keep all three burners in each family preparing fresh bases for future orders.
  for(const type of ['soup','beef']){
   if(state.pots.some((p,i)=>(type==='soup'?i<3:i>=3)&&p.state==='empty'))return{kind:'ingredient',value:type==='soup'?'water':'raw_beef'};
  }
  return null;
 }
 function ordinaryAction(state){
  if(!state||state.ended)return null;
  const o=state.orders[0];if(!o)return null;
  const dish=o.dishes.find((d,i)=>!o.done[i]);if(!dish)return null;
  if(instant.has(dish))return {kind:'instant',value:dish};
  const stored=state.storage.indexOf(dish);if(stored>=0)return {kind:'storage',i:stored};
  const ready=state.pots.findIndex(p=>p.state==='ready'&&p.dish===dish);if(ready>=0)return {kind:'pot',i:ready};
  const soup=family(dish)==='soup',pots=state.pots.map((p,i)=>({...p,i})).filter(p=>(p.i<3)===soup);
  const burnt=pots.find(p=>p.state==='burnt');if(burnt)return {kind:'pot',i:burnt.i};
  if(additions[dish]&&pots.some(p=>p.state==='ready'&&p.dish===(soup?'soup':'beef')))return {kind:'ingredient',value:additions[dish]};
  if(pots.some(p=>p.state==='cooking'))return null;
  if(pots.some(p=>p.state==='empty'))return {kind:'ingredient',value:soup?'water':'raw_beef'};
  const spare=pots.find(p=>p.state==='ready');
  if(spare){if(state.storage.some((d,i)=>!d&&(i<3)===soup))return {kind:'pot',i:spare.i};const slot=state.storage.findIndex((d,i)=>d&&(i<3)===soup&&!state.orders.some(o=>o.dishes.some((need,j)=>need===d&&!o.done[j])));if(slot>=0)return {kind:'storage',i:slot};}
  return null;
 }
 const signature=p=>p?`${p.state}:${p.dish}`:'none';
 function ingredientTarget(state,value){const soup=['water','corn','carrot'].includes(value),base=value==='water'||value==='raw_beef';const candidates=state.pots.map((p,i)=>({...p,i})).filter(p=>(p.i<3)===soup&&(base?p.state==='empty':p.state==='ready'&&p.dish===(soup?'soup':'beef')));if(!base)candidates.sort((a,b)=>b.age-a.age||a.i-b.i);return candidates[0]?.i??-1;}
 function planBatch(state,mode='greedy'){
  const shadow=JSON.parse(JSON.stringify(state)),jobs=[],limit=mode==='ordinary'?4:mode==='fastest'?32:8;
  const serve=dish=>{for(const o of shadow.orders){const i=o.dishes.findIndex((d,j)=>d===dish&&!o.done[j]);if(i>=0){o.done[i]=true;if(o.done.every(Boolean))shadow.orders.splice(shadow.orders.indexOf(o),1);return true;}}return false;};
  for(let n=0;n<limit;n++){
   let action;
   if(mode==='ordinary'){for(let first=0;first<shadow.orders.length&&!action;first++)action=ordinaryAction({...shadow,orders:[shadow.orders[first],...shadow.orders.filter((_,i)=>i!==first)]});}
   else action=chooseAction(shadow);
   if(!action)break;
   const i=action.kind==='ingredient'?ingredientTarget(shadow,action.value):action.i;
   const job={action,i,expected:action.kind==='storage'?shadow.storage[i]:signature(shadow.pots[i])};
   if(action.kind==='ingredient'){
    if(i<0)break;const p=shadow.pots[i],base=action.value==='water'||action.value==='raw_beef';
    p.dish=base?(i<3?'soup':'beef'):Object.keys(additions).find(d=>additions[d]===action.value);p.state=base&&!shadow.frenzy?'cooking':'ready';p.age=base?0:p.age;
   }else if(action.kind==='pot'){
    const p=shadow.pots[i];if(p.state!=='burnt'&&!serve(p.dish)){const slot=shadow.storage.findIndex((d,j)=>!d&&(j<3)===(i<3));if(slot<0)break;shadow.storage[slot]=p.dish;}p.state='empty';p.dish=null;p.age=0;
   }else if(action.kind==='storage'){serve(shadow.storage[i]);shadow.storage[i]=null;}else if(!serve(action.value))break;
   jobs.push(job);
  }return jobs;
 }
 function validJob(job,state){const {action,i,expected}=job;if(action.kind==='ingredient')return ingredientTarget(state,action.value)===i&&signature(state.pots[i])===expected;if(action.kind==='pot')return signature(state.pots[i])===expected;if(action.kind==='storage')return state.storage[i]===expected;return state.orders.some(o=>o.dishes.some((d,j)=>d===action.value&&!o.done[j]));}
 function scheduleBatch(jobs,mode,now,delay,lastButtons=new Map()){
  const resources=new Map(),gap=mode==='ordinary'?320:mode==='greedy'?150:0;
  return jobs.map(job=>{
   const a=job.action,key=`${a.kind}:${a.value??a.i}`;
   const locks=a.kind==='ingredient'?[`pot:${job.i}`]:a.kind==='pot'?[`pot:${job.i}`,'storage']:a.kind==='storage'?['storage']:[];
   const due=Math.max(now+delay,(lastButtons.get(key)??-Infinity)+gap,...locks.map(k=>resources.get(k)??-Infinity));
   lastButtons.set(key,due);for(const k of locks)resources.set(k,due);
   return {...job,decided:now,due};
  }).sort((a,b)=>a.due-b.due);
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={chooseAction,ordinaryAction,planBatch,validJob,scheduleBatch};
 if(typeof document==='undefined')return;
 const button=document.createElement('button');button.id='dev-autoplay';button.type='button';button.dataset.developmentOnly='true';button.setAttribute('aria-pressed','false');
 button.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3v3M5 8h14v11H5zM2 11v5m20-5v5M8 22v-3m8 3v-3"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M9 16h6"/></svg>';
 const picker=document.createElement('select');picker.id='dev-autoplay-mode';picker.setAttribute('aria-label','自动化策略');picker.innerHTML='<option value="ordinary">普通水平</option><option value="greedy" selected>贪心备菜</option><option value="fastest">理论最快</option>';
 document.querySelector('.controls').prepend(picker,button);
 let enabled=false,frame=0,mode='greedy',pending=[],serial=0,lastButtons=new Map();
 function sync(){button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'停止自动处理':'开启自动处理');button.style.color=enabled?'#a6de71':'';}
 function step(){const api=root.BonbonKitchen,session=api?.getSession();if(!enabled||!session?.ready||!session.running||session.paused)return false;const action=(mode==='ordinary'?ordinaryAction:chooseAction)(api.getState());return action?api.performAction(action):false;}
 function loop(now){
  if(!enabled)return;const api=root.BonbonKitchen,session=api?.getSession();
  if(!session?.ready||!session.running||session.paused){pending=[];}else{
   // Every batch is decided against a shadow state, then waits before any
   // execution. Independent buttons can execute in the same browser frame.
   if(!pending.length){const delay=mode==='fastest'?0:mode==='ordinary'?650+Math.random()*450:180+Math.random()*160;const batch=++serial;pending=scheduleBatch(planBatch(api.getState(),mode),mode,now,delay,lastButtons).map(job=>({...job,batch}));}
   while(pending.length&&pending[0].due<=now){const job=pending.shift();if(validJob(job,api.getState()))api.performAction(job.action);}
  }
  if(enabled)frame=requestAnimationFrame(loop);
 }
 function start(){if(enabled)return;enabled=true;pending=[];lastButtons.clear();sync();frame=requestAnimationFrame(loop);}
 function stop(){enabled=false;pending=[];cancelAnimationFrame(frame);frame=0;sync();}
 function toggle(){if(enabled)stop();else start();}
 function setMode(value){if(!['ordinary','greedy','fastest'].includes(value))return;mode=value;picker.value=value;pending=[];lastButtons.clear();}
 picker.onchange=()=>setMode(picker.value);button.onclick=toggle;root.addEventListener('bonbon:finish',stop);root.addEventListener('bonbon:suspend',stop);sync();
 root.BonbonDevAutoplay={chooseAction,ordinaryAction,planBatch,start,stop,toggle,step,setMode,get mode(){return mode;},get pending(){return pending.map(p=>({...p}));},get enabled(){return enabled;},dispose(){stop();button.remove();picker.remove();root.removeEventListener('bonbon:finish',stop);root.removeEventListener('bonbon:suspend',stop);delete root.BonbonDevAutoplay;}};
})(typeof globalThis!=='undefined'?globalThis:this);
