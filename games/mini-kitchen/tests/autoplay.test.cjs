const assert=require('node:assert/strict');
const {Kitchen}=require('../engine.js');
const {chooseAction}=require('../dev-autoplay.js');
const apply=(k,a)=>a.kind==='ingredient'?k.autoCook(a.value)>=0:a.kind==='pot'?k.take(a.i).ok:a.kind==='storage'?k.takeStorage(a.i).ok:k.serve(a.value).ok;
let k=new Kitchen();k.orders=[{id:1,slot:0,age:20,dishes:['corn_soup'],done:[false]}];k.pots[0]={type:'soup',dish:'soup',state:'ready',age:2};assert.deepEqual(chooseAction(k.snapshot()),{kind:'ingredient',value:'corn'});
k.pots[0].dish='corn_soup';assert.deepEqual(chooseAction(k.snapshot()),{kind:'pot',i:0});
k.storage[0]='corn_soup';assert.deepEqual(chooseAction(k.snapshot()),{kind:'storage',i:0});
k=new Kitchen();k.orders=[];k.pots[0]={type:'soup',dish:'soup',state:'ready',age:15};assert.deepEqual(chooseAction(k.snapshot()),{kind:'pot',i:0});
k.storage=['carrot_soup','corn_soup','soup',null,null,null];assert.deepEqual(chooseAction(k.snapshot()),{kind:'storage',i:0});
k=new Kitchen();k.orders=[];k.pots[0]={type:'soup',dish:'soup',state:'ready',age:1};assert.deepEqual(chooseAction(k.snapshot()),{kind:'ingredient',value:'water'});
k=new Kitchen();k.orders=[{id:1,slot:0,age:2,dishes:['soup','soup'],done:[false,false]}];k.pots[0]={type:'soup',dish:'soup',state:'cooking',age:1};assert.deepEqual(chooseAction(k.snapshot()),{kind:'ingredient',value:'water'});
for(let seed=1;seed<=5;seed++){
 let value=seed;const random=()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};k=new Kitchen(random);let actions=0;
 for(let i=0;i<=1200;i++){k.tick(.1);const action=chooseAction(k.snapshot());if(action){assert(apply(k,action),JSON.stringify(action));actions++;}}
 assert(k.ended);assert(k.completed>=40,`seed ${seed}: only ${k.completed} orders`);assert(k.score>=8000,`seed ${seed}: score ${k.score}`);assert(k.missed<=2,`seed ${seed}: missed ${k.missed}`);
 console.log(`Greedy seed ${seed}: ${k.score} points, ${k.completed} orders, ${k.missed} missed, ${actions} normal actions.`);
}
