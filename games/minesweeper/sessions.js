import {neighbors} from './engine.js';
const mineCounts=[8,11,15];
export const sessionKey='bone-gift-sessions-v1';
export function validateSession(value,level){
 if(!Number.isInteger(level)||level<0||level>2||!value||value.level!==level||!Number.isFinite(value.elapsedMs)||value.elapsedMs<0)return null;
 if(value.board!==null){
  if(!Array.isArray(value.board)||value.board.length!==64)return null;
  if(value.board.some(c=>!c||typeof c.mine!=='boolean'||typeof c.open!=='boolean'||typeof c.known!=='boolean'||!Number.isInteger(c.number)||c.number<0||c.number>8||c.revealed||c.open&&c.mine||c.known&&!c.mine))return null;
  if(value.board.filter(c=>c.mine).length!==mineCounts[level])return null;
  if(value.board.some((c,i)=>c.number!==neighbors(i).filter(j=>value.board[j].mine).length))return null;
  if(value.board.filter(c=>c.open).length>=64-mineCounts[level])return null;
 }
 return {level,elapsedMs:value.elapsedMs,board:value.board===null?null:value.board.map(({mine,number,open,known})=>({mine,number,open,known})),generation:value.generation&&typeof value.generation==='object'?value.generation:null,savedAt:typeof value.savedAt==='string'?value.savedAt:new Date().toISOString()};
}
export class SessionStore{
 constructor(storage){
  this.storage=storage;this.slots={};this.lastError=null;
  try{this.storage??=globalThis.localStorage;const data=JSON.parse(this.storage.getItem(sessionKey));if(data?.version===1)for(let level=0;level<3;level++){const valid=validateSession(data.slots?.[level],level);if(valid)this.slots[level]=valid;}}catch(error){this.lastError=error;}
 }
 get(level){const slot=this.slots[level];return slot?JSON.parse(JSON.stringify(slot)):null;}
 stage(level,snapshot){const valid=validateSession(snapshot,level);if(!valid)throw Error('存档内容无效');this.slots[level]=valid;}
 remove(level){delete this.slots[level];}
 flush(){try{this.storage.setItem(sessionKey,JSON.stringify({version:1,slots:this.slots}));this.lastError=null;return true;}catch(error){this.lastError=error;return false;}}
}
