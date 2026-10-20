const assert=require('node:assert/strict');
const {Kitchen}=require('../engine.js');
let k=new Kitchen(()=>.2);
assert(k.cook(0,'water'));k.tick(2.99);assert.equal(k.pots[0].state,'cooking');k.tick(.01);assert.equal(k.pots[0].state,'ready');
assert(k.cook(0,'corn'));assert.equal(k.pots[0].dish,'corn_soup');k.orders=[];assert(k.take(0).stored);assert.equal(k.storage[0],'corn_soup');k.tick(20);assert.equal(k.storage[0],'corn_soup');
k=new Kitchen();k.cook(3,'raw_beef');k.tick(21);assert.equal(k.pots[3].state,'burnt');assert(k.take(3).trash);assert.equal(k.pots[3].state,'empty');
k=new Kitchen();k.orders=[{id:1,dishes:['beef','rice'],done:[false,false],age:0},{id:2,dishes:['beef'],done:[false],age:0}];assert(k.serve('beef').ok);assert.equal(k.orders[0].done[0],true);assert.equal(k.orders[1].done[0],false);assert(k.serve('rice').award>0);assert.equal(k.orders[0].id,2);
k=new Kitchen();k.storage=['soup','soup','soup',null,null,null];k.cook(0,'water');k.tick(3);k.orders=[];assert(k.take(0).full);assert.equal(k.pots[0].state,'ready');
k=new Kitchen();k.elapsed=59;k.cook(0,'water');k.tick(1);assert(k.frenzy);assert.equal(k.pots[0].state,'ready');k.tick(25);assert.equal(k.pots[0].state,'ready');assert(k.cook(4,'raw_beef'));assert.equal(k.pots[4].state,'ready');k.tick(6);assert(k.ended);assert.equal(k.elapsed,90);
k=new Kitchen();k.orders=[{id:1,dishes:['soup'],done:[false],age:29}];k.next=100;k.tick(1);assert.equal(k.missed,1);assert.equal(k.orders.length,1);
k=new Kitchen();assert.equal(k.autoCook('water'),0);assert.equal(k.autoCook('water'),1);assert.equal(k.autoCook('water'),2);assert.equal(k.autoCook('water'),-1);assert.equal(k.autoCook('corn'),-1);assert.equal(k.autoCook('raw_beef'),3);k.tick(3);assert.equal(k.autoCook('corn'),0);assert.equal(k.autoCook('carrot'),1);assert.equal(k.autoCook('potato'),3);assert.equal(k.pots[0].dish,'corn_soup');assert.equal(k.pots[1].dish,'carrot_soup');assert.equal(k.pots[3].dish,'potato_beef');
const {profile}=require('../engine.js');
k=new Kitchen();k.elapsed=59;k.pots[0]={type:'soup',dish:'soup',state:'ready',age:17.5};k.tick(1);assert.equal(k.pots[0].state,'burnt');assert(k.frenzy);
function histogram(rows){const count={};for(const d of rows.flat())count[d]=(count[d]||0)+1;return count;}
for(let run=0;run<50;run++){
 k=new Kitchen();const normal=k.schedule.filter(o=>o.phase==='normal'),frenzy=k.schedule.filter(o=>o.phase==='frenzy');
 assert.equal(normal.length,35);assert.equal(frenzy.length,20);assert.deepEqual(histogram(normal.map(o=>o.dishes)),histogram(profile.normal));assert.deepEqual(histogram(frenzy.map(o=>o.dishes)),histogram(profile.frenzy));
 assert(normal.every(o=>o.at>=0&&o.at<60));assert(frenzy.every(o=>o.at>=60&&o.at<90));assert(!frenzy.some(o=>o.dishes.includes('candy')));assert(normal.filter(o=>o.dishes.includes('candy')).every(o=>o.at>100/3));
 for(let i=1;i<k.schedule.length;i++)assert(k.schedule[i].at>k.schedule[i-1].at);
 const gaps=k.schedule.slice(1).map((o,i)=>o.at-k.schedule[i].at),mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
 assert(mean(gaps.slice(0,8))>mean(gaps.slice(25,33)));assert(mean(gaps.slice(35,40))>mean(gaps.slice(-5)));assert(mean(gaps.slice(0,34))>mean(gaps.slice(35)));
}
k=new Kitchen(()=>.5);k.spawn();assert.equal(k.orders.length,1);k.tick(1);assert.equal(k.orders.length,1);k.tick(2.5);assert.equal(k.orders.length,2);
k=new Kitchen(()=>.5);for(let i=0;i<5;i++)k.spawn();const before=k.orders.map(o=>({id:o.id,slot:o.slot})),cursor=k.cursor;k.spawn();assert.equal(k.orders.length,5);assert.equal(k.cursor,cursor);
const first=k.orders[0];for(const dish of first.dishes)k.serve(dish);const stable=k.orders.map(o=>({id:o.id,slot:o.slot}));assert.deepEqual(stable,before.slice(1));k.spawn();assert.equal(k.orders.at(-1).slot,0);assert.deepEqual(k.orders.slice(0,4).map(o=>({id:o.id,slot:o.slot})),stable);
k.orders[1].age=29.9;k.next=100;k.tick(.2);const survivors=k.orders.map(o=>({id:o.id,slot:o.slot}));for(const o of survivors)assert.equal(o.slot,before.find(b=>b.id===o.id)?.slot??0);
// Vacancies refill individually; the last completed order immediately hands off to one new order.
k=new Kitchen(()=>.5);k.spawn();const old=k.orders[0];old.dishes=['rice'];old.done=[false];k.serve('rice');assert.equal(k.orders.length,1);assert.notEqual(k.orders[0].slot,old.slot);assert(k.next>2);
for(let i=0;i<1200;i++){k.tick(.1);if(!k.ended)assert(k.orders.length>=1);assert(k.orders.length<=5);}
// Recipe choices follow the recorded time band even when orders are completed unusually quickly.
k=new Kitchen(()=>.5);for(const at of [1,12,25,40,55,70,85]){k.elapsed=at;const phase=at<60?'normal':'frenzy';for(let n=0;n<30;n++){const dishes=k.chooseDishes(phase);assert(dishes.length>0);if(at<100/3||at>=60)assert(!dishes.includes('candy'));}}
k=new Kitchen();k.storage[0]='soup';const waste=k.wasted;assert(k.takeStorage(0).trash);assert.equal(k.storage[0],null);assert.equal(k.wasted,waste+1);assert(!k.takeStorage(0).ok);assert.equal(k.wasted,waste+1);
k=new Kitchen();k.orders=[{id:10,slot:3,dishes:['rice','soup'],done:[false,false],age:2}];k.storage[0]='soup';const delivered=k.takeStorage(0);assert(delivered.ok&&!delivered.trash);assert.equal(delivered.dish,'soup');assert.equal(delivered.target.orderId,10);assert.equal(delivered.target.slot,3);assert.equal(delivered.target.index,1);assert.equal(k.storage[0],null);assert.equal(k.wasted,0);
k=new Kitchen(()=>.5);for(let i=0;i<5;i++)k.spawn();const recipeState=JSON.stringify(k.recipeCursors),pending=k.cursor;k.tick(15);assert.equal(k.cursor,pending);assert.equal(JSON.stringify(k.recipeCursors),recipeState);assert.equal(k.next,Infinity);
for(const dish of k.orders[0].dishes.slice())k.serve(dish);assert.equal(k.orders.length,4);assert(k.next>1);const wait=k.next;k.tick(wait-.1);assert.equal(k.orders.length,4);assert.equal(k.cursor,pending);k.tick(.11);assert.equal(k.orders.length,5);assert.equal(k.cursor,pending+1);
k=new Kitchen(()=>.5);for(let i=0;i<5;i++)k.spawn();k.orders[0].age=29.9;k.tick(.2);assert.equal(k.orders.length,4);assert(k.next>1);assert.equal(k.cursor,5);
k=new Kitchen();k.orders=[{id:20,slot:0,dishes:['rice'],done:[false],age:1}];k.next=.001;k.serve('rice');k.tick(.01);assert.equal(k.orders.length,1);assert(k.next>.6);
k=new Kitchen(()=>.5);const early=k.arrivalDelay();k.elapsed=55;const late=k.arrivalDelay();k.elapsed=75;k.frenzy=true;assert(early>late&&late>k.arrivalDelay());
k=new Kitchen(()=>.5);let arrivals=0,previous=0;for(let i=0;i<899;i++){k.tick(.1);assert(k.serial-previous<=1);if(k.serial!==previous)arrivals++;previous=k.serial;assert(k.orders.length>=1&&k.orders.length<=5);}assert(arrivals>10);
console.log('Passed: cooking, FIFO, stable slots, one-by-one accelerating arrivals, nonempty orders, recorded time-band recipes and phase frequencies.');
