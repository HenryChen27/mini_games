/* The existing launcher only exports jellyfish.* keys. Keep a transport
   checkpoint there; game storage continues to use its own bonbon-* keys. */
(function(root){
 const key='jellyfish.bonbon.checkpoint-v1',stamp='bonbon-host-checkpoint-v1';
 const keys=['bonbon-save-v1','bonbon-audio-v1','bonbon-keybindings-v1','bonbon-scores','bonbon-best'];
 function active(){return typeof root.__jellyfishHostSave==='function';}
 if(active())try{
  const data=JSON.parse(localStorage.getItem(key)||'null');
  if(data?.version===1&&Number.isFinite(data.savedAt)&&data.values&&typeof data.values==='object'){
   const newer=data.savedAt>Number(localStorage.getItem(stamp)||0);
   for(const name of keys){const value=data.values[name];if((newer||localStorage.getItem(name)===null)&&(value===null||typeof value==='string')){
    if(value===null)localStorage.removeItem(name);else localStorage.setItem(name,value);
   }}
   if(newer)localStorage.setItem(stamp,String(data.savedAt));
  }
 }catch(error){console.warn('Kitchen host checkpoint restore failed',error);}
 root.BonbonHostCompat={
  checkpoint(){
   if(!active())return;
   const savedAt=Math.max(Date.now(),Number(localStorage.getItem(stamp)||0)+1);
   const values=Object.fromEntries(keys.map(name=>[name,localStorage.getItem(name)]));
   const data=JSON.stringify({version:1,savedAt,values});
   localStorage.setItem(key,data);
   if(localStorage.getItem(key)!==data)throw Error('Host checkpoint verification failed');
   localStorage.setItem(stamp,String(savedAt));
  },
  connect(api){
   if(active()&&!root.MinesweeperGame)root.MinesweeperGame=Object.freeze({saveAll:api.saveAll,prepareToClose:api.prepareToClose,resume:api.resume});
   if(active()&&!root.JellyfishGame)root.JellyfishGame=Object.freeze({
    save(){const result=api.saveAll();return {...result,saved:result.ok,reason:result.error};},
    async safeSaveAndExit(){const result=await api.prepareToClose();return {...result,saved:!!(result.ok&&result.readyToClose),reason:result.error};},
    resume:api.resume
   });
   if(active()&&!root.JellyfishGame)root.JellyfishGame=Object.freeze({
    save(){const result=api.saveAll();return {...result,saved:result.ok,reason:result.error};},
    async safeSaveAndExit(){const result=await api.prepareToClose();return {...result,saved:!!(result.ok&&result.readyToClose),reason:result.error};},
    resume:api.resume
   });
  }
 };
})(window);
