import test from 'node:test';
import assert from 'node:assert/strict';
import {playFrameAnimation,settleWithin} from './animation.js';
function environment(){
 let next=0;const callbacks=new Map(),timers=new Map(),nodes=[];
 const runtime={performance:{now:()=>100},console:{warn(){}},document:{createElement(){const image={isConnected:false,remove(){this.isConnected=false;}};nodes.push(image);return image;}},requestAnimationFrame(fn){const id=++next;callbacks.set(id,fn);return id;},cancelAnimationFrame(id){callbacks.delete(id);},setTimeout(fn){const id=++next;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 const element={append(image){image.isConnected=true;}};
 return {runtime,element,nodes,callbacks,timers,tick(time){const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(time));},timeout(){[...timers.values()].forEach(fn=>fn());}};
}
test('earlier first-frame timestamp stays on frame zero and completes',async()=>{const e=environment();const p=playFrameAnimation(e.element,[{src:'zero'},{src:'one'}],{runtime:e.runtime});e.tick(99);assert.equal(e.nodes[0].src,'zero');assert.equal(e.callbacks.size,1);e.tick(200);await p;assert.equal(e.nodes[0].isConnected,false);assert.equal(e.timers.size,0);});
test('missing animation frames cannot strand the completion promise',async()=>{const e=environment();const p=playFrameAnimation(e.element,[{src:'zero'},undefined],{runtime:e.runtime});e.tick(140);e.tick(200);await p;assert.equal(e.callbacks.size,0);});
test('stalled requestAnimationFrame completes through watchdog',async()=>{const e=environment();const p=playFrameAnimation(e.element,[{src:'zero'}],{runtime:e.runtime});e.timeout();await p;assert.equal(e.callbacks.size,0);assert.equal(e.nodes[0].isConnected,false);});
test('changing scenes safely completes pending animation',async()=>{const e=environment();let current=true;const p=playFrameAnimation(e.element,[{src:'zero'}],{runtime:e.runtime,isCurrent:()=>current});current=false;e.tick(110);await p;assert.equal(e.timers.size,0);});
test('all 15 spiders finish uncover then twitch even with early timestamps',async()=>{const e=environment();let complete=0;const spiders=Array.from({length:15},async()=>{for(const kind of ['uncover','twitch'])await playFrameAnimation(e.element,[{src:kind}],{runtime:e.runtime});complete++;});e.tick(99);e.tick(200);await Promise.resolve();e.tick(99);e.tick(200);await Promise.all(spiders);assert.equal(complete,15);assert.equal(e.callbacks.size,0);assert.equal(e.timers.size,0);});
test('rendering exception also settles the animation',async()=>{const e=environment();e.element.append=()=>{throw Error('render unavailable');};await playFrameAnimation(e.element,[{src:'zero'}],{runtime:e.runtime});assert.equal(e.callbacks.size,0);});
test('image decode rejection or stall cannot block the result screen',async()=>{await settleWithin(Promise.reject(Error('decode failed')),100);await settleWithin(new Promise(()=>{}),5);});
