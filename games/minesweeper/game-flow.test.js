import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createBoard,neighbors,deduce} from './engine.js';
import {SessionStore,sessionKey} from './sessions.js';
import {seededRandom} from './generation.js';
class Element{
 constructor(){this.children=[];this.hidden=true;this.dataset={};this.style={setProperty(){}};this.textContent='';this.classes=new Set();this.added=[];this.classList={add:(...x)=>x.forEach(v=>{this.added.push(v);this.classes.add(v);}),remove:(...x)=>x.forEach(v=>this.classes.delete(v)),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}removeAttribute(){}querySelector(){return null;}querySelectorAll(){return [];}addEventListener(){}focus(){}remove(){}contains(){return true;}decode(){return Promise.resolve();}
}
function setup(storage=new Map()){
 const elements=new Map();const element=s=>{if(!elements.has(s))elements.set(s,new Element());return elements.get(s);};
 element('#board').children=Array.from({length:64},()=>new Element());const sounds=[],waits=[],events=new Map();let now=10000;
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 class TestStore extends SessionStore{constructor(){super(localStorage);}}
 const context=vm.createContext({console,Math,Date,JSON,Set,Map,Promise,Number,String,Array,Error,performance:{now:()=>now},Image:class{decode(){return Promise.resolve();}},structuredClone,SessionStore:TestStore,addEventListener:(name,fn)=>events.set(name,fn),
 document:{querySelector:element,createElement:()=>new Element(),hidden:false,addEventListener:(name,fn)=>events.set(name,fn)},
 localStorage,matchMedia:()=>({matches:false}),
 setTimeout:(fn,ms)=>{waits.push(ms);return setImmediate(fn);},clearTimeout:clearImmediate,clearInterval(){},setInterval(){return 1;},
 GameAudio:class{settings={music:.3,effects:1};play(name){sounds.push(name);}stopEffects(){}unlock(){}visibility(){}},
 BoardGenerator:class{cancel(){}warm(){}},neighbors,deduce,playFrameAnimation:()=>Promise.resolve(),settleWithin:async p=>p});
 const source=readFileSync(new URL('./app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInContext(source+`\nglobalThis.flow={setBoard:b=>{board=b;level=0;state='playing';started=5000;elapsed=0;},reveal,showPoisons,home,updateCount,chooseLevel,continueGame,start,saveAll,prepareToClose,getBoard:()=>board,getElapsed:()=>currentElapsed(),getLevel:()=>level,state:()=>state};`,context);
 const board=createBoard(0,8,seededRandom(123));const last=board.findIndex(c=>!c.mine&&c.number>0);board.forEach((c,i)=>c.open=!c.mine&&i!==last);context.flow.setBoard(board);
 return {flow:context.flow,api:context.MinesweeperGame,context,storage,events,board,last,element,sounds,waits,setNow:value=>now=value};
}
test('victory confirms all remaining closed cells before ending, counter reaches zero',async()=>{
 const e=setup();const mines=e.board.flatMap((c,i)=>c.mine?[i]:[]);e.board[mines[0]].known=true;e.board[mines[1]].known=true;e.flow.updateCount();assert.equal(e.element('#mines').textContent,'06');
 await e.flow.reveal(e.last);
 assert.equal(e.flow.state(),'won');assert.equal(e.element('#mines').textContent,'00');assert.ok(mines.every(i=>e.board[i].known));assert.equal(e.element('#ending').hidden,false);
 assert.deepEqual(e.sounds,['open2','end']);assert.ok(!e.element('#tea').added.includes('brewing'));assert.ok(e.waits.includes(1400));assert.equal(e.element('#time').textContent,'0:05');
});
test('repeated detection does not subtract the same poison twice',async()=>{
 const e=setup();const mines=e.board.flatMap((c,i)=>c.mine?[i]:[]);await e.flow.showPoisons(mines.slice(0,3));assert.equal(e.element('#mines').textContent,'05');await e.flow.showPoisons(mines.slice(0,3));assert.equal(e.element('#mines').textContent,'05');
});
test('leaving during victory animations never opens an old result screen',async()=>{
 const e=setup();const pending=e.flow.reveal(e.last);e.flow.home();await pending;assert.equal(e.flow.state(),'home');assert.equal(e.element('#ending').hidden,true);assert.ok(!e.sounds.includes('end'));
});

test('exit and continue preserve layout, known poisons and accumulated time',async()=>{
 const e=setup();const mine=e.board.findIndex(c=>c.mine);e.board[mine].known=true;
 const before=JSON.stringify(e.board);e.flow.home();e.setNow(1000000);
 await e.flow.continueGame(0);
 assert.equal(JSON.stringify(e.flow.getBoard()),before);assert.equal(e.flow.getElapsed(),5000);
 e.setNow(1001500);assert.equal(e.flow.getElapsed(),6500);assert.equal(e.element('#mines').textContent,'07');
});
test('each difficulty keeps its own saved round and timer',async()=>{
 const e=setup();e.flow.home();await e.flow.start(1);e.setNow(12000);e.flow.home();
 assert.equal(e.flow.getLevel(),1);await e.flow.continueGame(0);assert.equal(e.flow.getLevel(),0);assert.equal(e.flow.getElapsed(),5000);
 e.flow.home();await e.flow.continueGame(1);assert.equal(e.flow.getLevel(),1);assert.equal(e.flow.getElapsed(),2000);assert.ok(e.flow.getBoard().every(c=>c.mine===undefined));
});
test('difficulty with a save prompts before replacing the layout',()=>{
 const e=setup();e.flow.home();e.flow.chooseLevel(0);assert.equal(e.flow.state(),'home');assert.equal(e.element('#modal').hidden,false);assert.equal(e.element('#modal-title').textContent,'发现未完成的排查');
 const actions=e.element('#modal-content').children.at(-1).children;assert.deepEqual(actions.map(b=>b.textContent),['继续排查','重新开始']);
});
test('safe close persists all slots and stops play, with a resume option',async()=>{
 const e=setup();const result=await e.api.prepareToClose();assert.equal(result.ok,true);assert.equal(result.readyToClose,true);assert.equal(e.flow.state(),'suspended');assert.ok(e.storage.has(sessionKey));
 e.setNow(100000);await e.api.resume();assert.equal(e.flow.state(),'playing');assert.equal(e.flow.getElapsed(),5000);
});
test('safe close refuses readiness on storage error and leaves gameplay running',async()=>{
 const e=setup();e.context.localStorage.setItem=()=>{throw Error('Storage full');};const result=await e.api.prepareToClose();assert.equal(result.ok,false);assert.equal(result.readyToClose,false);assert.equal(e.flow.state(),'playing');
});
test('hidden page pauses the clock and resumes without charging time away',()=>{
 const e=setup();e.context.document.hidden=true;e.events.get('visibilitychange')();assert.equal(e.flow.state(),'paused');e.setNow(1000000);e.context.document.hidden=false;e.events.get('visibilitychange')();assert.equal(e.flow.getElapsed(),5000);
});
test('pagehide synchronously checkpoints the active board',()=>{
 const e=setup();e.events.get('pagehide')();assert.ok(e.storage.has(sessionKey));const saved=JSON.parse(e.storage.get(sessionKey));assert.equal(saved.slots[0].elapsedMs,5000);assert.equal(saved.slots[0].board.length,64);
});
test('finishing a round removes its resumable checkpoint',async()=>{
 const e=setup();e.flow.saveAll();assert.ok(JSON.parse(e.storage.get(sessionKey)).slots[0]);await e.flow.reveal(e.last);assert.equal(JSON.parse(e.storage.get(sessionKey)).slots[0],undefined);
});
test('new page instance restores the persisted board and timing',async()=>{
 const first=setup();const mine=first.board.findIndex(c=>c.mine);first.board[mine].known=true;first.flow.home();
 const reloaded=setup(first.storage);reloaded.setNow(50000);await reloaded.flow.continueGame(0);assert.equal(reloaded.flow.getBoard()[mine].known,true);assert.equal(reloaded.flow.getElapsed(),5000);
});
test('new game replaces only its own difficulty slot',async()=>{
 const e=setup();e.flow.home();await e.flow.start(1);e.setNow(12000);e.flow.home();await e.flow.start(0);e.flow.home();
 const slots=JSON.parse(e.storage.get(sessionKey)).slots;assert.equal(slots[0].board,null);assert.equal(slots[0].elapsedMs,0);assert.equal(slots[1].elapsedMs,2000);
});
