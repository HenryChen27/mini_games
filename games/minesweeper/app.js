import {SessionStore} from './sessions.js';
const sessions=new SessionStore();
import {guessChances} from './board-generator.js';
import {BoardGenerator} from './generation-client.js';
const generator=new BoardGenerator();
import {playFrameAnimation,settleWithin} from './animation.js';
import {GameAudio} from './audio.js';
const sound=new GameAudio();
import {neighbors,deduce} from './engine.js';
const $=s=>document.querySelector(s), levels=[{name:'友善势力',mines:8},{name:'中立势力',mines:11},{name:'敌对势力',mines:15}];
let board=[],level=0,state='home',started=0,elapsed=0,timer=null,epoch=0,teaBusy=false,storageOK=true,hintEpoch=0;
let generationInfo=null,pendingLevel=null,lastCheckpoint=0,closeState=null;
const key='bone-gift-v1';let saved={records:[],best:{}};try{const value=JSON.parse(localStorage.getItem(key));if(value&&Array.isArray(value.records)&&value.best&&typeof value.best==='object')saved={records:value.records.slice(0,50),best:value.best};}catch{storageOK=false;}
const fmt=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
const images={uncover:[],twitching:[]};
let assetsReady;
function preload(){
  if(assetsReady)return assetsReady;
  const pending=[];
  for(const [kind,n] of [['uncover',29],['twitching',15]])for(let i=0;i<n;i++){
    const im=new Image();im.src=`assets/gamepage/${kind}/${kind}${String(i).padStart(4,'0')}.png`;
    images[kind].push(im);pending.push(im.decode().catch(()=>{}));
  }
  return assetsReady=Promise.all(pending);
}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function stop(){generator.cancel();hintEpoch++;sound.stopEffects();clearInterval(timer);timer=null;epoch++;teaBusy=false;$('#tea').classList.remove('brewing');$('#intro').hidden=true;}
function currentElapsed(){return state==='playing'?Math.max(0,performance.now()-started):elapsed;}
function inProgress(){return ['intro','playing','generating','paused','resuming'].includes(state)&&board.length===64;}
function snapshot(){return {level,elapsedMs:currentElapsed(),board:board[0]?.mine===undefined?null:board.map(c=>({mine:c.mine,number:c.number,open:c.open,known:c.known})),generation:generationInfo,savedAt:new Date().toISOString()};}
function checkpoint(){
 if(inProgress())sessions.stage(level,snapshot());
 lastCheckpoint=performance.now();return sessions.flush();
}
function home(){
 if(inProgress()&&!checkpoint()){showSaveError();return false;}
 stop();state='home';$('#home').hidden=false;$('#game').hidden=true;$('#ending').hidden=true;$('#modal').hidden=true;return true;
}
function mountBoard(){
 $('#board').replaceChildren(...board.map((_,i)=>{const b=document.createElement('button');b.className='cell';b.dataset.index=i;return b;}));
 render();$('#board').removeAttribute('aria-busy');
}
function runClock(){
 clearInterval(timer);
 if(document.hidden){state='paused';started=0;}else{state='playing';started=performance.now()-elapsed;}
 timer=setInterval(()=>{
  if(state!=='playing')return;elapsed=currentElapsed();$('#time').textContent=fmt(elapsed);
  if(performance.now()-lastCheckpoint>=5000)checkpoint();
 },200);
}
function chooseLevel(n){
 const slot=sessions.get(n);
 if(!slot){start(n);return;}
 pendingLevel=n;modal('resume');
}
async function continueGame(n){
 const slot=sessions.get(n);if(!slot){start(n);return;}
 stop();sound.resumePlayback?.();generator.warm();const token=epoch;
 level=n;elapsed=slot.elapsedMs;started=0;generationInfo=slot.generation;
 board=slot.board||Array.from({length:64},()=>({open:false,known:false}));state='resuming';
 $('#home').hidden=true;$('#game').hidden=false;$('#ending').hidden=true;$('#modal').hidden=true;$('#intro').hidden=true;
 $('#time').textContent=fmt(elapsed);mountBoard();
 await settleWithin(preload(),2500);if(token!==epoch)return;
 runClock();checkpoint();
}
function showSaveError(){
 $('#modal-title').textContent='存档未能保存';$('#modal-content').replaceChildren();
 const message=document.createElement('p');message.textContent='当前存储不可用或空间不足。进度仍保留在页面中，请重试保存后再退出。';
 const retry=document.createElement('button');retry.className='save-choice-action';retry.dataset.action='retry-save';retry.textContent='重试保存并退出';
 $('#modal-content').append(message,retry);$('#modal').hidden=false;$('.close').focus();
}
async function start(n){
  stop();sound.resumePlayback?.();generator.warm();generationInfo=null;sound.unlock();sound.play('start');const token=epoch;level=n;board=Array.from({length:64},()=>({open:false,known:false}));
  started=0;elapsed=0;state='intro';$('#home').hidden=true;$('#game').hidden=false;$('#ending').hidden=true;$('#modal').hidden=true;$('#time').textContent='0:00';
  $('#mines').textContent=String(levels[n].mines).padStart(2,'0');
  $('#intro-faction').textContent=levels[n].name;$('#intro-faction').className=['friendly','neutral','hostile'][n];$('#intro').hidden=false;
  mountBoard();checkpoint();
  for(const [i,el] of [...$('#board').children].entries()){el.classList.add('arriving');el.style.setProperty('--arrival-delay',`${(Math.floor(i/8)+i%8)*95}ms`);}
  await Promise.all([preload(),wait(reduced()?700:2400)]);
  if(token!==epoch)return;
  for(const el of $('#board').children)el.classList.remove('arriving');
  $('#intro').hidden=true;runClock();checkpoint();
}
function renderCell(i){
  const c=board[i],el=$('#board').children[i];
  el.classList.toggle('open',!!c.open);el.classList.toggle('known',!!c.known&&!c.revealed);el.classList.toggle('spider',!!c.revealed);
  el.dataset.number=c.number||0;
  let number=el.querySelector('.number');
  if(c.open&&c.number){if(!number){number=document.createElement('span');number.className='number';el.append(number);}number.textContent=c.number;}else number?.remove();
  el.setAttribute('aria-label',`第${Math.floor(i/8)+1}行第${i%8+1}列，${c.revealed?'蜘蛛':c.known?'已确认有毒':c.open?(c.number?`周围${c.number}只蜘蛛`:'空礼物'):'未拆封'}`);
}
function updateCount(){$('#remaining').textContent=String(board.filter(c=>!c.open&&!c.revealed).length).padStart(2,'0');$('#mines').textContent=String(Math.max(0,levels[level].mines-board.filter(c=>c.known||c.revealed).length)).padStart(2,'0');}
function render(){board.forEach((_,i)=>renderCell(i));updateCount();}
function animate(i,kind){
 const token=epoch;
 return playFrameAnimation($('#board').children[i],images[kind],{
  className:'effect'+(kind==='twitching'?' twitch':''),
  isCurrent:()=>token===epoch,reduced:reduced()
 });
}
async function reveal(i){
  if(state!=='playing'||board[i].open)return;
  if(board[i].mine===undefined){
    const token=epoch;elapsed=currentElapsed();state='generating';$('#board').setAttribute('aria-busy','true');
    const kind=Math.random()<guessChances[level]?'one-guess':'logic';
    let generated;
    try{generated=await generator.generate(i,levels[level].mines,kind);}catch(error){
      if(token!==epoch)return;runClock();$('#board').removeAttribute('aria-busy');console.error('Board generation failed',error);return;
    }
    if(token!==epoch||!generated)return;
    board=generated.board;runClock();$('#board').removeAttribute('aria-busy');
    generationInfo={kind,attempts:generated.attempts,computeMs:generated.computeMs,wallMs:generated.wallMs,fallback:generated.fallback};
    console.info('[蚀骨赠礼] 布雷性能',generationInfo);
  }
  if(board[i].mine){lose(i);return;}
  const queue=[i],opened=[];
  while(queue.length){const j=queue.pop(),c=board[j];if(c.open||c.mine)continue;c.open=true;opened.push(j);if(!c.number)queue.push(...neighbors(j));}
  sound.play(opened.length>1?'open':'open2');
  render();const animations=opened.map(j=>animate(j,'uncover'));
  if(board.filter(c=>c.open).length===64-levels[level].mines){
    finish(true);const token=epoch;await Promise.all(animations);if(token!==epoch)return;
    await showPoisons(board.flatMap((c,j)=>c.open?[]:[j]),{teapot:false});if(token===epoch)await showEnding(true);
  }else checkpoint();
}
function record(win){const entry={won:win,level,time:Math.round(elapsed),date:new Date().toISOString(),generation:generationInfo};saved.records.unshift(entry);saved.records.length=Math.min(saved.records.length,50);if(win&&(saved.best[level]===undefined||entry.time<saved.best[level].time))saved.best[level]=entry;try{localStorage.setItem(key,JSON.stringify(saved));}catch{storageOK=false;}}
function finish(win){elapsed=currentElapsed();clearInterval(timer);state=win?'won':'lost';sessions.remove(level);sessions.flush();record(win);$('#time').textContent=fmt(elapsed);}
async function showSpider(i,token){
  if(token!==epoch)return;
  board[i].revealed=true;renderCell(i);updateCount();
  await animate(i,'uncover');if(token!==epoch)return;
  await animate(i,'twitching');
}
async function lose(hit){
  sound.play('spider');finish(false);const token=epoch;
  await showSpider(hit,token);if(token!==epoch)return;
  const others=board.flatMap((c,i)=>c.mine&&i!==hit?[i]:[]);
  for(let i=others.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[others[i],others[j]]=[others[j],others[i]];}
  const animations=[];
  for(const i of others){if(token!==epoch)return;animations.push(showSpider(i,token));await wait(reduced()?0:120);}
  await Promise.all(animations);if(token===epoch)await showEnding(false);
}
async function showEnding(win){const token=epoch;const art=$('#ending-art');art.src=`assets/ending/${win?'succeed':'fail'}.png`;await settleWithin(art.decode(),1500);if(token!==epoch)return;$('#ending').className=win?'win':'loss';$('#ending').hidden=false;sound.play('end');$('#ending-title').textContent=win?'排查成功':'排查失败！';$('#ending-time').textContent=win?`消耗时间： ${fmt(elapsed)}`:'';$('#ending-copy').textContent=win?'“可难得见到十三娘这般满意的神色，她应当是认可你的。”雀舌微微一鞠躬，“今日也是辛苦，不妨先回茶馆歇息？”':'“恐怕需要你多待些时日了。”血滴子嘴角一扯，淡漠地点点头，做出邀请的神情，“你还有选择吗？”';$('#ending-author').textContent=win?'——雀舌《茶馆逸闻》':'——血滴子《茶馆逸闻》';$('.retry').hidden=win;$('#time').textContent=fmt(elapsed);}
async function showPoisons(indices,{teapot=true}={}){
 const token=epoch,pulse=++hintEpoch;
 teaBusy=true;$('#tea').classList.remove('brewing');
 if(teapot){sound.play('hint');void $('#tea').offsetWidth;$('#tea').classList.add('brewing');}
 for(const i of indices){
  board[i].known=true;renderCell(i);
  const el=$('#board').children[i];el.classList.remove('hinting');void el.offsetWidth;el.classList.add('hinting');
 }
 updateCount();if(state==='playing')checkpoint();
 await wait(reduced()?100:1400);
 if(token!==epoch||pulse!==hintEpoch)return;
 teaBusy=false;$('#tea').classList.remove('brewing');for(const el of $('#board').children)el.classList.remove('hinting');
}
function hint(){
 if(state!=='playing'||teaBusy)return;
 const visible=board.map(c=>({open:c.open,number:c.open?c.number:undefined}));
 showPoisons(deduce(visible).mines);
}
function modal(type){const content=$('#modal-content');content.replaceChildren();$('#modal-title').textContent={guide:'蚀骨赠礼 · 排查指南',records:'排查记录',ranks:'个人排行榜',resume:'发现未完成的排查'}[type];if(type==='resume'){
 const slot=sessions.get(pendingLevel);const p=document.createElement('p');p.className='resume-summary';p.textContent=`${levels[pendingLevel].name} · 已用时 ${fmt(slot.elapsedMs)}，是否继续上次的排查？`;
 const actions=document.createElement('div');actions.className='save-choice-actions';
 for(const [action,label] of [['continue','继续排查'],['new-game','重新开始']]){const button=document.createElement('button');button.className='save-choice-action';button.dataset.action=action;button.textContent=label;actions.append(button);}
 content.append(p,actions);
 }else if(type==='guide'){content.innerHTML='<p>礼物之中藏着有毒蜘蛛。拆开所有无毒礼物，即可完成排查；触碰蜘蛛则排查失败。</p><div class="legend"><span><img src="assets/gamepage/sealed.png">未拆封</span><span><img src="assets/gamepage/opened.png">已拆封</span><span><img src="assets/gamepage/poisoned.png">确定有毒</span><span><img src="assets/gamepage/spider.png">蜘蛛</span></div><p>数字表示周围八个方格中的蜘蛛数量。空礼物会自动展开相邻区域，第一次拆封及其周围保证安全。</p><p>点击整个茶壶：当一个已拆封数字周围的未拆封格数恰好等于该数字时，这些未拆封格全部确定有毒。茶壶会同时标出所有符合此规则的方格；绿色提示仍可点击，拆开后同样会排查失败。</p><p>三种难度均为 8×8 棋盘，分别藏有 8、11、15 只蜘蛛。多数棋盘可推理通关，少量棋盘最后会留下一个二选一。排查完无毒礼物后，会自动确认全部有毒礼物。记录保存最近 50 局，排行榜单独保留各难度最快成功用时。打开说明时计时继续。</p>';}
else{const rows=type==='records'?saved.records:levels.map((_,i)=>saved.best[i]).filter(Boolean);if(!rows.length)content.innerHTML='<p class="empty">尚无'+(type==='records'?'排查记录，拆开你的第一份赠礼吧。':'通关成绩，完成排查后会在这里留下记录。')+'</p>';else{const table=document.createElement('table');table.innerHTML='<thead><tr><th>难度</th><th>结果</th><th>用时</th><th>日期</th></tr></thead>';const body=document.createElement('tbody');for(const r of rows){const tr=document.createElement('tr');for(const value of [levels[r.level]?.name||'未知',r.won?'排查成功':'排查失败',fmt(r.time),new Date(r.date).toLocaleString('zh-CN',{hour12:false})]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}table.append(body);content.append(table);}}$('#modal').hidden=false;$('.close').focus();}
document.addEventListener('click',e=>{if(state==='suspended')return;const target=e.target.closest('button');if(!target)return;if(target.dataset.level!==undefined)chooseLevel(Number(target.dataset.level));else if(target.dataset.index!==undefined){reveal(Number(target.dataset.index));}else{const a=target.dataset.action;if(a==='settings')setSettingsOpen($('#audio-settings').hidden);if(['guide','records','ranks'].includes(a))modal(a);if(a==='close')$('#modal').hidden=true;if(a==='home'||a==='back')home();if(a==='retry')start(level);if(a==='continue')continueGame(pendingLevel);if(a==='new-game')start(pendingLevel);if(a==='retry-save')home();}});
$('#tea').addEventListener('click',hint);
$('#board').addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){$('#modal').hidden=true;setSettingsOpen(false);}
 if(e.key==='Tab'&&!$('#modal').hidden){
  const items=[...$('#modal').querySelectorAll('button,input')];const first=items[0],last=items.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});home();
const stage=document.querySelector('#stage');
for(const event of ['contextmenu','dragstart','selectstart'])stage.addEventListener(event,e=>e.preventDefault());

function renderAudioSettings(content){
 const rows=[['music','背景音乐'],['effects','游戏音效']];
 for(const [key,label] of rows){
  const row=document.createElement('label');row.className='volume-row';
  const text=document.createElement('span');text.textContent=label;
  const input=document.createElement('input');input.type='range';input.min='0';input.max='100';input.step='1';input.value=Math.round(sound.settings[key]*100);input.setAttribute('aria-label',label);
  const value=document.createElement('output');value.textContent=input.value+'%';
  input.addEventListener('input',()=>{sound.set(key,+input.value/100);sound.unlock();value.textContent=input.value+'%';});
  if(key==='effects')input.addEventListener('change',()=>sound.play('open2'));
  row.append(text,input,value);content.append(row);
 }

}
for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>sound.unlock(),{capture:true});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  if(state==='playing'){elapsed=currentElapsed();state='paused';started=0;}
  checkpoint();
 }else if(state==='paused')runClock();
 sound.visibility();
});

function setSettingsOpen(open){$('#audio-settings').hidden=!open;$('.settings-button').setAttribute('aria-expanded',String(open));}
renderAudioSettings($('#audio-controls'));
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.settings'))setSettingsOpen(false);});

// Run after navigation handlers so scene cleanup cannot cancel this click.
document.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(state==='suspended'||!button||!stage.contains(button)||button.disabled||button.dataset.index!==undefined||button.id==='tea')return;
 sound.unlock();sound.play('click');
});

function saveAll(){
 try{
  if(!checkpoint())throw sessions.lastError||Error('无法写入存档');
  localStorage.setItem(key,JSON.stringify(saved));
  localStorage.setItem('bone-gift-audio-v1',JSON.stringify(sound.settings));
  return {ok:true,savedLevels:Object.keys(sessions.slots).map(Number),savedAt:new Date().toISOString()};
 }catch(error){return {ok:false,error:error.message||String(error)};}
}
async function prepareToClose(){
 const result=saveAll();if(!result.ok)return {...result,readyToClose:false};
 closeState=state;stop();generator.dispose?.();state='suspended';stage.classList.add('suspended');setSettingsOpen(false);sound.suspendPlayback?.();
 return {...result,readyToClose:true};
}
globalThis.MinesweeperGame=Object.freeze({
 saveAll,prepareToClose,
 resume:async()=>{
  if(state!=='suspended')return;
  stage.classList.remove('suspended');sound.resumePlayback?.();
  if(closeState==='home'){home();return;}
  if(closeState==='won'||closeState==='lost'){state=closeState;await showEnding(state==='won');return;}
  return continueGame(level);
 }
});
// These writes are synchronous: unload events cannot wait for async work.
globalThis.addEventListener('pagehide',()=>saveAll());
globalThis.addEventListener('beforeunload',()=>saveAll());
globalThis.addEventListener('pageshow',event=>{if(event.persisted&&state==='paused'&&!document.hidden)runClock();});
