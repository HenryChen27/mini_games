/* One mixer: shared loops, real supplied SFX, no oscillator substitutes. */
(function(root){
 const names=['click','add_water','timer','start','add_beef','add_corn_or_carrot','add_tomato_or_potato','beef_burnt','beef_cooked','bonbon_time','last_5_sec','submit_dish','submit_order','switch_to_bowl','switch_to_plate','trash_can'];
 function create(){
  let context,master,musicBus,effectsBus,masterTarget=-1,enabled=true,unlocked=false,wantedHeating=false;
  const volumes={music:1,effects:1};try{const saved=JSON.parse(localStorage.getItem('bonbon-audio-v1'));for(const key of Object.keys(volumes))if(Number.isFinite(saved?.[key]))volumes[key]=Math.max(0,Math.min(1,saved[key]));}catch{}
  function setVolume(key,value){if(!(key in volumes)||!Number.isFinite(value))return;volumes[key]=Math.max(0,Math.min(1,value));const bus=key==='music'?musicBus:effectsBus;if(bus)bus.gain.setTargetAtTime(volumes[key],context.currentTime,.06);try{localStorage.setItem('bonbon-audio-v1',JSON.stringify(volumes));}catch{}}
  const buffers=new Map(),loops=new Map(),lastPlayed=new Map(),events=[];
  function startLoop(name,volume){
   if(!context||!buffers.has(name)||loops.has(name))return;
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(name);source.loop=true;gain.gain.value=0;source.connect(gain).connect(name==='music'?musicBus:effectsBus);source.start();loops.set(name,{source,gain,target:0});setLoop(name,volume);
  }
  function setLoop(name,volume){const node=loops.get(name);if(!node)return;if(node.target===volume)return;node.target=volume;node.gain.gain.setTargetAtTime(volume,context.currentTime,volume? .12:.22);}
  function unlock(){
   if(!context){
    context=new AudioContext();master=context.createGain();master.connect(context.destination);
    musicBus=context.createGain();effectsBus=context.createGain();musicBus.gain.value=volumes.music;effectsBus.gain.value=volumes.effects;musicBus.connect(master);effectsBus.connect(master);
    const paths=Object.fromEntries(names.map(n=>[n,`assets/audio/${n}.MP3`]));paths.heating='assets/audio/heating.MP3?v=20261020-loop2';paths.music='assets/audio/凤琪酱呀 - 厨灶间的奇旅（2）.mp3';
    for(const [name,path] of Object.entries(paths))fetch(encodeURI(path)).then(r=>{if(!r.ok)throw Error(path);return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).then(buffer=>{buffers.set(name,buffer);if(name==='music')startLoop(name,.22);if(name==='heating')startLoop(name,wantedHeating?.32:0);}).catch(error=>console.warn('Audio load failed:',name,error));
   }
   unlocked=true;context.resume().catch(()=>{});
  }
  function play(name='click'){
   if(!enabled)return;unlock();const now=context.currentTime;
   if(now-(lastPlayed.get(name)??-100)<.065)return;lastPlayed.set(name,now);
   events.push(name);if(events.length>80)events.shift();
   const run=()=>{if(!enabled||!buffers.has(name))return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(name);gain.gain.value=name==='bonbon_time'?.9:.75;source.connect(gain).connect(effectsBus);source.start();};
   if(buffers.has(name))run();else{const timer=setInterval(()=>{if(buffers.has(name)){clearInterval(timer);run();}},30);setTimeout(()=>clearInterval(timer),2500);}
  }
  function update({sound,active,pots,hidden}){
   enabled=sound;wantedHeating=active&&!hidden&&pots.some(p=>p.state==='cooking'||p.state==='ready');
   if(!context)return;const target=enabled&&!hidden?1:0;if(masterTarget!==target){masterTarget=target;master.gain.setTargetAtTime(target,context.currentTime,.08);}
   setLoop('music',hidden?0:.22);setLoop('heating',wantedHeating?.32:0);
   // Let the fade finish, then stop the single heating source. The next pot
   // creates a fresh shared loop; six burners never create six noise tracks.
   const heating=loops.get('heating');if(heating&&!wantedHeating&&heating.gain.gain.value<.001){heating.source.stop();loops.delete('heating');}
   if(wantedHeating)startLoop('heating',.32);
  }
  return {unlock,play,update,setVolume,get volumes(){return {...volumes};},get status(){return {unlocked,enabled,heating:wantedHeating,loops:[...loops.keys()],events:events.slice(),volumes:{...volumes}};}};
 }
 root.BonbonAudio={create};
})(globalThis);
