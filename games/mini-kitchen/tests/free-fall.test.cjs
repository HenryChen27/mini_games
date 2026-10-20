const assert=require('node:assert/strict');
require('../cooking-fx.js');
const {freeFall,gravity}=globalThis.BonbonCookingFX;
for(const height of [115,125,128,141]){
 const duration=freeFall(height,0).duration,dt=duration/5;
 const positions=Array.from({length:5},(_,i)=>freeFall(height,i*dt).offset);
 assert.equal(positions[0],-height);
 for(let i=1;i<positions.length-1;i++)assert(Math.abs(positions[i+1]-2*positions[i]+positions[i-1]-gravity*dt*dt)<1e-9);
 assert.equal(freeFall(height,duration).offset,0);
 assert.equal(freeFall(height,duration+1).offset,0);
 assert.equal(freeFall(height,-.1).offset,-height);
 assert(duration>.3&&duration<.37);
}
console.log('Passed: vegetables and steak share constant gravity, accelerate until contact, and never overshoot the landing plane.');
