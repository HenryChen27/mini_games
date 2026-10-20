/* Host contract: save synchronously, acknowledge safe close only after suspension. */
(function(root){
 let closeTask=null,animations=[],previousInert=false;
 const api=root.BonbonKitchen,session=api.getSession;
 function write(key,value){const data=JSON.stringify(value);localStorage.setItem(key,data);if(localStorage.getItem(key)!==data)throw Error(`Persistence verification failed: ${key}`);}
 function saveAll(){
  try{
   const run=saveRun();if(!run.ok)return run;
   if(memorySave)write(saveKey,memorySave);
   write('bonbon-audio-v1',kitchenSound.volumes);
   const bindings=root.BonbonSettings?.state.bindings;if(bindings)write('bonbon-keybindings-v1',bindings);
   const scores=scoreHistory.length?scoreHistory:readScores();write('bonbon-scores',scores);
   write('bonbon-best',scores[0]?.score||0);
   return {ok:true,savedRun:run.savedRun||!!readSavedRun(),savedAt:new Date().toISOString()};
  }catch(error){return {ok:false,error:error.message||String(error)};}
 }
 function prepareToClose(){
  if(closeTask)return closeTask;
  const saved=saveAll();if(!saved.ok)return Promise.resolve({...saved,readyToClose:false});
  hostSuspended=true;previousInert=document.body.inert;document.body.inert=true;
  animations=document.getAnimations().filter(a=>a.playState==='running');for(const a of animations)a.pause();
  root.dispatchEvent(new CustomEvent('bonbon:suspend'));
  closeTask=(async()=>{
   try{await kitchenSound.suspendPlayback();return {...saved,readyToClose:true};}
   catch(error){return {ok:false,readyToClose:false,error:error.message||String(error)};}
  })();
  return closeTask;
 }
 async function resume(){
  if(!hostSuspended)return {ok:true,resumed:false};
  if(closeTask)await closeTask;
  await kitchenSound.resumePlayback();
  closeTask=null;document.body.inert=previousInert;last=performance.now();
  for(const a of animations)try{a.play();}catch{}animations=[];
  if(['playing','resume-countdown','resuming','launch','intro'].includes(phase)){
   const fresh=phase==='launch'||phase==='intro';running=false;paused=true;resumeFromSave=false;showCountdown(!fresh);
  }
  hostSuspended=false;
  return {ok:true,resumed:true};
 }
 Object.assign(api,{version:'1.5.2',saveAll,save:saveAll,prepareToClose,resume,getSession:()=>({...session(),hostSuspended,running:!hostSuspended&&running,paused:hostSuspended||paused,phase:hostSuspended?'suspended':phase})});
 root.addEventListener('beforeunload',saveAll);
 root.addEventListener('pagehide',saveAll);
})(window);
