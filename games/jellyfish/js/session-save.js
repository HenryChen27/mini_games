const SessionSave=(()=>{
  const KEY='jellyfish.session.v1';
  function read() {
    try {
      const s=JSON.parse(localStorage.getItem(KEY));
      if(!s || s.version!==1 || !Number.isSafeInteger(s.score) || s.score<0 || !Array.isArray(s.items) || s.items.length>500)return null;
      const validLevel=n=>Number.isInteger(n)&&n>=1&&n<=5;
      if(!(s.dropLevel===null||validLevel(s.dropLevel)) || !validLevel(s.nextLevel) || !Number.isFinite(s.clipX))return null;
      if(s.dropLevel===null && (!Number.isFinite(s.cooldownRemaining)||s.cooldownRemaining<0||s.cooldownRemaining>1000))return null;
      if(s.overflowElapsed!==null && (!Number.isFinite(s.overflowElapsed)||s.overflowElapsed<0))return null;
      if(!s.items.every(i=>Number.isInteger(i.level)&&i.level>=1&&i.level<=11&&['x','y','angle','vx','vy','angularVelocity','age','breathPhase'].every(k=>Number.isFinite(i[k]))))return null;
      return s;
    }catch{return null;}
  }
  function write(state) {try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;}}
  function clear(){try{localStorage.removeItem(KEY);}catch{}}
  return {read,write,clear};
})();
