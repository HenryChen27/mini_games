const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const defaults={master:1,music:.35,effects:1,muted:false};
export class GameAudio{
 constructor(){
  this.settings={...defaults};
  try{const saved=JSON.parse(localStorage.getItem('bone-gift-audio-v1'));if(saved){for(const key of ['master','music','effects'])if(Number.isFinite(saved[key]))this.settings[key]=clamp(saved[key]);this.settings.muted=saved.muted===true;}}catch{}
  this.music=new Audio('assets/audio/竹亭叶业 - 蚀骨赠礼.mp3');this.music.loop=true;this.music.preload='auto';
  this.context=null;this.buffers=new Map();this.voices=new Set();this.generation=0;this.unlocked=false;this.suspended=false;this.apply();
 }
 apply(){const s=this.settings;this.music.volume=s.muted?0:s.master*s.music;if(this.effectsGain)this.effectsGain.gain.value=s.muted?0:s.master*s.effects;}
 set(key,value){if(key==='muted')this.settings.muted=!!value;else if(['master','music','effects'].includes(key))this.settings[key]=clamp(value);else return;this.apply();try{localStorage.setItem('bone-gift-audio-v1',JSON.stringify(this.settings));}catch{}}
 unlock(){
  if(document.hidden||this.suspended)return;this.unlocked=true;
  const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!this.context&&Context){this.context=new Context();this.effectsGain=this.context.createGain();this.effectsGain.connect(this.context.destination);this.apply();for(const name of ['click','start','open','open2','hint','spider','end'])this.load(name).catch(()=>{});}
  if(this.context?.state==='suspended')this.context.resume().catch(()=>{});
  if(this.music.paused&&!this.settings.muted&&this.music.volume>0)this.music.play().catch(()=>{});
 }
 load(name){
  if(!this.buffers.has(name)){
   const job=fetch(`assets/audio/${name}.MP3`).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).then(data=>this.context.decodeAudioData(data));
   this.buffers.set(name,job);job.catch(()=>this.buffers.delete(name));
  }
  return this.buffers.get(name);
 }
 async play(name){
  if(!this.context||document.hidden||this.settings.muted||!this.settings.master||!this.settings.effects)return;
  const generation=this.generation;
  try{const buffer=await this.load(name);if(generation!==this.generation||document.hidden||this.settings.muted)return;
   // Bound simultaneous voices during rapid cell clicks.
   if(this.voices.size>=8)this.voices.values().next().value.stop();
   const voice=this.context.createBufferSource();voice.buffer=buffer;voice.connect(this.effectsGain);this.voices.add(voice);voice.onended=()=>{this.voices.delete(voice);voice.disconnect();};voice.start();
  }catch{}
 }
 stopEffects(){this.generation++;for(const voice of this.voices){try{voice.stop();}catch{}}this.voices.clear();}
 suspendPlayback(){this.suspended=true;this.music.pause();this.stopEffects();this.context?.suspend().catch(()=>{});}
 resumePlayback(){this.suspended=false;if(this.unlocked)this.unlock();}
 visibility(){if(document.hidden){this.music.pause();this.stopEffects();this.context?.suspend().catch(()=>{});}else if(this.unlocked)this.unlock();}
}
