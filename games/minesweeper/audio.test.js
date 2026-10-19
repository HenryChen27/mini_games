import test from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio} from './audio.js';
function environment(saved){
 const storage=new Map(saved?[['bone-gift-audio-v1',JSON.stringify(saved)]]:[]);
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 globalThis.document={hidden:false};
 globalThis.Audio=class{constructor(src){this.src=src;this.paused=true;this.plays=0;}play(){this.paused=false;this.plays++;return Promise.resolve();}pause(){this.paused=true;}};
 let starts=0;
 globalThis.AudioContext=class{constructor(){this.state='running';}createGain(){return {gain:{value:1},connect(){}};}decodeAudioData(){return Promise.resolve({});}createBufferSource(){return {connect(){},disconnect(){},start(){starts++;},stop(){this.onended?.();}};}suspend(){this.state='suspended';return Promise.resolve();}resume(){this.state='running';return Promise.resolve();}};
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});
 return {storage,starts:()=>starts};
}
test('music and effects independently apply and persist live volume',()=>{const e=environment();const a=new GameAudio();a.unlock();a.set('music',.2);a.set('effects',.6);assert.equal(a.music.volume,.2);assert.equal(a.effectsGain.gain.value,.6);assert.equal(JSON.parse(e.storage.get('bone-gift-audio-v1')).effects,.6);});
test('repeated user gestures keep one playing background track',()=>{environment();const a=new GameAudio();a.unlock();const context=a.context;a.unlock();a.unlock();assert.equal(a.music.plays,1);assert.equal(a.context,context);});
test('stopped scene cancels pending effects and later play works',async()=>{const e=environment();const a=new GameAudio();a.unlock();const pending=a.play('spider');a.stopEffects();await pending;assert.equal(e.starts(),0);await a.play('open');assert.equal(e.starts(),1);});
test('hidden page stops voices and pauses music; return resumes',async()=>{environment();const a=new GameAudio();a.unlock();await a.play('hint');assert.equal(a.voices.size,1);document.hidden=true;a.visibility();assert.equal(a.voices.size,0);assert.equal(a.music.paused,true);document.hidden=false;a.visibility();assert.equal(a.music.paused,false);});
