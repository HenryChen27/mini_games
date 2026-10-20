/* Pure game rules; no browser or host dependencies. */
(function(root){
const names={soup:'清汤',corn_soup:'玉米汤',carrot_soup:'胡萝卜汤',beef:'煎牛肉',tomato_beef:'番茄牛肉',potato_beef:'土豆牛肉',rice:'米饭',bread:'面包',candy:'糖果'};
const prices={soup:70,corn_soup:120,carrot_soup:110,beef:80,tomato_beef:120,potato_beef:115,rice:50,bread:45,candy:40};
const profile=root.BonbonOrderProfile||(typeof require!=='undefined'?require('./order-profile.js'):null);
const templates=profile.normal.concat(profile.frenzy);
const duration=90,frenzyAt=60;
function makeSchedule(random){
 const schedule=[];
 for(const [phase,rows,start,duration] of [['normal',profile.normal,0,frenzyAt],['frenzy',profile.frenzy,frenzyAt,30]]){
  const gap=duration/rows.length;
  // Shuffle locally: retain the recorded progression and exact phase frequencies.
  for(let base=0;base<rows.length;base+=5){
   const bag=rows.slice(base,base+5).map(d=>d.slice());
   for(let j=bag.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[bag[j],bag[k]]=[bag[k],bag[j]];}
   bag.forEach((dishes,j)=>{const i=base+j,u=i/rows.length;const at=start+duration*(1.2*u-.2*u*u)+(i===0?0:(random()-.5)*gap*.1);schedule.push({phase,dishes,at});});
  }
 }
 return schedule;
}
class Kitchen {
 constructor(random=Math.random){this.random=random;this.reset()}
 reset(){this.elapsed=0;this.score=0;this.completed=0;this.missed=0;this.served=0;this.wasted=0;this.orders=[];this.pots=Array.from({length:6},(_,i)=>({type:i<3?'soup':'beef',dish:null,age:0,state:'empty'}));this.storage=Array(6).fill(null);this.schedule=makeSchedule(this.random);this.cursor=0;this.next=0;this.waitingForSpace=false;this.recipeBags={normal:[],frenzy:[]};this.recipeCursors={normal:0,frenzy:0};this.serial=0;this.ended=false;this.frenzy=false;}
 arrivalDelay(){const base=this.frenzy?1.8-.6*Math.min(1,(this.elapsed-frenzyAt)/30):3.1-Math.min(1,this.elapsed/frenzyAt);return base*(.9+this.random()*.2);}
 chooseDishes(phase){const bag=this.recipeBags[phase],entries=this.schedule.filter(e=>e.phase===phase),index=Math.max(0,entries.findLastIndex(e=>e.at<=this.elapsed)),start=Math.floor(index/5)*5,end=Math.min(profile[phase].length,start+5);if(this.recipeCursors[phase]!==end){bag.length=0;this.recipeCursors[phase]=end;}if(!bag.length)bag.push(...profile[phase].slice(start,end).map(d=>d.slice()));return bag.splice(Math.floor(this.random()*bag.length),1)[0];}
 spawn(avoidSlot=-1){const free=Array.from({length:5},(_,i)=>i).filter(i=>!this.orders.some((o,j)=>(o.slot??j)===i)),slot=free.find(i=>i!==avoidSlot)??free[0];if(slot===undefined||this.elapsed>=duration)return;this.cursor=Math.min(this.schedule.length,this.cursor+1);const dishes=this.chooseDishes(this.elapsed>=frenzyAt?'frenzy':'normal');this.orders.push({id:++this.serial,slot,dishes,done:dishes.map(()=>false),age:0,paper:94+Math.floor(this.random()*5)});this.waitingForSpace=this.orders.length===5;this.next=this.waitingForSpace?Infinity:this.arrivalDelay();}
 tick(dt){if(this.ended)return;dt=Math.max(0,Math.min(dt,duration-this.elapsed));const normalDt=Math.max(0,Math.min(dt,frenzyAt-this.elapsed));this.elapsed+=dt;this.frenzy=this.elapsed>=frenzyAt;
 for(const p of this.pots){if(p.state==='empty'||p.state==='burnt')continue;p.age+=normalDt;if(p.state==='cooking'&&p.age>=3){p.age-=3;p.state='ready';}if(p.state==='ready'&&p.age>=18)p.state='burnt';if(this.frenzy&&p.state==='cooking'){p.state='ready';p.age=0;}}
 const previousCount=this.orders.length,wasFull=previousCount>=5;for(const o of this.orders)o.age+=dt;this.orders=this.orders.filter(o=>{if(o.age>=30){this.missed++;return false;}return true;});
 if(wasFull&&this.orders.length<5){this.waitingForSpace=false;this.next=this.arrivalDelay();}else if(this.orders.length>=5){this.waitingForSpace=true;this.next=Infinity;}else{this.next-=dt;if(this.orders.length<previousCount)this.next=Math.max(1,this.next);}
 if((this.next<=0&&this.orders.length<5||this.orders.length===0)&&this.elapsed<duration)this.spawn();if(this.elapsed>=duration)this.ended=true;}
 cook(i,ingredient){const p=this.pots[i];if(p.state==='empty'&&ingredient===(i<3?'water':'raw_beef')){Object.assign(p,{dish:p.type,age:0,state:this.frenzy?'ready':'cooking'});return true;}const additions=i<3?{corn:'corn_soup',carrot:'carrot_soup'}:{tomato:'tomato_beef',potato:'potato_beef'};if(p.state==='ready'&&p.dish===p.type&&additions[ingredient]){p.dish=additions[ingredient];return true;}return false;}
 autoCook(ingredient){
  const soup=['water','corn','carrot'].includes(ingredient),base=ingredient==='water'||ingredient==='raw_beef';
  const candidates=this.pots.map((p,i)=>({p,i})).filter(({p,i})=>(soup?i<3:i>=3)&&(base?p.state==='empty':p.state==='ready'&&p.dish===p.type));
  if(!base)candidates.sort((a,b)=>b.p.age-a.p.age||a.i-b.i);
  const target=candidates[0];return target&&this.cook(target.i,ingredient)?target.i:-1;
 }
 serve(dish){for(const o of this.orders){const idx=o.dishes.findIndex((d,i)=>d===dish&&!o.done[i]);if(idx<0)continue;o.done[idx]=true;this.served++;let award=0;const target={orderId:o.id,slot:o.slot??this.orders.indexOf(o),index:idx,order:{...o,dishes:o.dishes.slice(),done:o.done.slice()}};if(o.done.every(Boolean)){award=o.dishes.reduce((s,d)=>s+prices[d],0)+Math.round(10+30*(1-o.age/30));this.score+=award;this.completed++;this.orders.splice(this.orders.indexOf(o),1);if(this.waitingForSpace){this.waitingForSpace=false;this.next=this.arrivalDelay();}else this.next=Math.max(.9,Math.min(this.next,this.arrivalDelay()));if(!this.orders.length&&this.elapsed<duration)this.spawn(o.slot??-1);}return {ok:true,award,dish,target};}return {ok:false,award:0};}
 take(i){const p=this.pots[i];if(p.state==='burnt'){Object.assign(p,{state:'empty',dish:null,age:0});this.wasted++;return {ok:true,trash:true};}if(p.state!=='ready')return {ok:false};let result=this.serve(p.dish);if(!result.ok){const slot=this.storage.findIndex((d,j)=>!d&&(i<3?j<3:j>=3));if(slot<0)return {ok:false,full:true};this.storage[slot]=p.dish;result={ok:true,stored:true};}Object.assign(p,{state:'empty',dish:null,age:0});return result;}
 takeStorage(i){if(!this.storage[i])return {ok:false};const r=this.serve(this.storage[i]);this.storage[i]=null;if(r.ok)return r;this.wasted++;return {ok:true,trash:true};}
 serialize(){return JSON.parse(JSON.stringify({version:2,state:{...this.snapshot(),schedule:this.schedule,cursor:this.cursor,next:this.next,waitingForSpace:this.waitingForSpace,recipeBags:this.recipeBags,recipeCursors:this.recipeCursors,serial:this.serial}}));}
 static migrateSave(save){
  if(save?.version!==1)return save;
  if(!save.state||!Number.isFinite(save.state.elapsed)||!Array.isArray(save.state.schedule)||!save.state.schedule.every(o=>o&&Number.isFinite(o.at)))return null;
  const migrated=JSON.parse(JSON.stringify(save)),s=migrated.state;migrated.version=2;
  s.elapsed=s.elapsed<90?s.elapsed*2/3:s.elapsed-30;
  s.schedule=s.schedule.map(o=>({...o,at:o.phase==='normal'?o.at*2/3:o.at-30}));
  return migrated;
 }
 static isValidSave(save){
  save=Kitchen.migrateSave(save);
  const s=save?.version===2&&save.state,finite=Number.isFinite,integer=n=>Number.isSafeInteger(n)&&n>=0,dish=d=>Object.hasOwn(names,d),recipe=a=>Array.isArray(a)&&a.length>=1&&a.length<=6&&a.every(dish);
  if(!s||!finite(s.elapsed)||s.elapsed<0||s.elapsed>=duration||s.ended!==false)return false;
  if(!['score','completed','missed','served','wasted','cursor','serial'].every(k=>integer(s[k])))return false;
  if(!Array.isArray(s.pots)||s.pots.length!==6||!Array.isArray(s.storage)||s.storage.length!==6||!Array.isArray(s.orders)||s.orders.length>5)return false;
  const fits=(d,i)=>dish(d)&&(i<3?['soup','corn_soup','carrot_soup'].includes(d):['beef','tomato_beef','potato_beef'].includes(d));
  if(!s.storage.every((d,i)=>d===null||fits(d,i)))return false;
  if(!s.pots.every((p,i)=>p&&p.type===(i<3?'soup':'beef')&&['empty','cooking','ready','burnt'].includes(p.state)&&finite(p.age)&&p.age>=0&&p.age<=120&&(p.state==='empty'?p.dish===null:fits(p.dish,i))))return false;
  if(!s.orders.every(o=>o&&integer(o.id)&&o.id>0&&o.id<=s.serial&&integer(o.slot)&&o.slot<5&&recipe(o.dishes)&&Array.isArray(o.done)&&o.done.length===o.dishes.length&&o.done.every(d=>typeof d==='boolean')&&finite(o.age)&&o.age>=0&&o.age<30&&Number.isInteger(o.paper)&&o.paper>=94&&o.paper<=98))return false;
  if(new Set(s.orders.map(o=>o.slot)).size!==s.orders.length||new Set(s.orders.map(o=>o.id)).size!==s.orders.length)return false;
  if(!Array.isArray(s.schedule)||s.schedule.length!==55||s.cursor>s.schedule.length||!s.schedule.every((o,i)=>o&&recipe(o.dishes)&&finite(o.at)&&o.at>=0&&o.at<duration&&(o.phase==='normal'?o.at<frenzyAt:o.phase==='frenzy'&&o.at>=frenzyAt)&&(i===0||o.at>s.schedule[i-1].at)))return false;
  if(!(s.next===null||finite(s.next)&&s.next>=-120&&s.next<=120)||typeof s.waitingForSpace!=='boolean')return false;
  if(!s.recipeBags||!s.recipeCursors||!['normal','frenzy'].every(phase=>Array.isArray(s.recipeBags[phase])&&s.recipeBags[phase].length<=5&&s.recipeBags[phase].every(recipe)&&integer(s.recipeCursors[phase])&&s.recipeCursors[phase]<=profile[phase].length))return false;
  return true;
 }
 restore(save){if(!Kitchen.isValidSave(save))return false;save=Kitchen.migrateSave(save);const s=JSON.parse(JSON.stringify(save.state));for(const key of ['elapsed','score','completed','missed','served','wasted','orders','pots','storage','schedule','cursor','waitingForSpace','recipeBags','recipeCursors','serial'])this[key]=s[key];this.next=s.next===null?Infinity:s.next;this.frenzy=this.elapsed>=frenzyAt;this.ended=false;return true;}
 snapshot(){return JSON.parse(JSON.stringify({elapsed:this.elapsed,score:this.score,completed:this.completed,missed:this.missed,served:this.served,wasted:this.wasted,orders:this.orders,pots:this.pots,storage:this.storage,frenzy:this.frenzy,ended:this.ended}));}
}
root.BonbonRules={Kitchen,names,prices,templates,profile,makeSchedule,duration,frenzyAt};if(typeof module!=='undefined')module.exports=root.BonbonRules;
})(typeof globalThis!=='undefined'?globalThis:this);
