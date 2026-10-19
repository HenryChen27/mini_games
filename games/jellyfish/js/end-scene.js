const EndScene = (() => {
  const KEY='jellyfish.records.v1';
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  let records=[], storageFailed=false, actions, dialog, restart, gameplayRank;
  function read() {
    try {
      const data=JSON.parse(localStorage.getItem(KEY)||'[]');
      records=(Array.isArray(data)?data:[]).filter(r=>r && Number.isSafeInteger(r.score) && r.score>=0 && typeof r.date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
        .sort((a,b)=>b.score-a.score).slice(0,50);
    } catch { records=[]; }
    return records;
  }
  function save(score) {
    read();
    const best=records.length?records[0].score:0;
    const date=new Date();
    const day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const entry={score,date:day};
    records.push(entry);records.sort((a,b)=>b.score-a.score);records=records.slice(0,50);
    storageFailed=false;
    try { localStorage.setItem(KEY,JSON.stringify(records)); } catch { storageFailed=true; }
    return {score,newRecord:score>best,records:records.slice(),storageFailed};
  }
  function create(canvas,assets,score,time) {
    const snapshot=document.createElement('canvas');snapshot.width=canvas.width;snapshot.height=canvas.height;
    snapshot.getContext('2d').drawImage(canvas,0,0);
    return {...save(score),start:time,snapshot,bubbles:BubbleTransition.create(time+200,
      CONFIG.GAME_WIDTH,CONFIG.GAME_HEIGHT,1250,CONFIG.ANIM.bubbleCount,assets.images.bubble)};
  }
  function install(onRestart,onRequestRestart) {
    restart=onRestart;
    actions=document.createElement('div');actions.className='result-actions';actions.hidden=true;
    actions.innerHTML='<button type="button" class="result-button" id="playAgain"><img src="assets/restart.png" alt="">再来一局</button><button type="button" class="result-button" id="showRecords"><img src="assets/rank.png" alt="">完整排行榜</button>';
    document.body.append(actions);
    actions.querySelector('#playAgain').onclick=()=>restart();
    actions.querySelector('#showRecords').onclick=openRanking;
    dialog=document.createElement('dialog');dialog.className='records-dialog';
    dialog.innerHTML='<div class="records-heading"><h2>个人排行榜</h2><button type="button" aria-label="关闭排行榜">×</button></div><p>最多保存 50 条记录</p><div class="records-scroll"><table><thead><tr><th>排名</th><th>分数</th><th>日期</th></tr></thead><tbody></tbody></table></div>';
    document.body.append(dialog);
    gameplayRank=document.createElement('aside');gameplayRank.className='gameplay-rank';gameplayRank.hidden=true;
    gameplayRank.innerHTML='<section id="gameplayRankPanel" hidden><h2>个人排行榜</h2><ol></ol></section><div class="gameplay-controls"><button id="gameplayRankToggle" type="button" aria-expanded="false" aria-controls="gameplayRankPanel"><img src="assets/rank.png" alt=""><span>展开排行榜</span></button><button id="restartButton" type="button"><img src="assets/restart.png" alt=""><span>重新开始游戏</span></button></div>';
    document.body.append(gameplayRank);
    gameplayRank.querySelector('#restartButton').onclick=onRequestRestart;
    gameplayRank.querySelector('button').onclick=()=>{
      const panel=gameplayRank.querySelector('section'),button=gameplayRank.querySelector('button');
      const open=button.getAttribute('aria-expanded')!=='true';
      UITransitions.show(panel,open);button.setAttribute('aria-expanded',String(open));
      button.querySelector('span').textContent=open?'收起排行榜':'展开排行榜';
    };
    dialog.querySelector('button').onclick=()=>UITransitions.closeDialog(dialog);
    dialog.addEventListener('cancel',e=>{e.preventDefault();UITransitions.closeDialog(dialog);});
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)UITransitions.closeDialog(dialog);}});
  }
  function openRanking() {
    const body=dialog.querySelector('tbody');body.replaceChildren();
    records.forEach((r,i)=>{
      const row=document.createElement('tr');
      for(const value of [i+1,r.score,r.date]) {const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
      body.append(row);
    });
    dialog.showModal();dialog.querySelector('.records-scroll').scrollTop=0;
  }
  function hide() { if(actions)UITransitions.show(actions,false);if(dialog?.open)UITransitions.closeDialog(dialog); }
  function updateGameplay(canvas,phase) {
    if(!gameplayRank)return;
    const visible=phase==='playing';
    if(visible && gameplayRank.hidden) {
      const list=gameplayRank.querySelector('ol');list.replaceChildren();read();
      for(let i=0;i<3;i++) {
        const row=document.createElement('li'),icon=document.createElement('img'),score=document.createElement('span');
        icon.src=`assets/${['1st','2nd','3rd'][i]}.png`;icon.alt=`第 ${i+1} 名`;
        score.textContent=records[i]?String(records[i].score):'—';row.append(icon,score);list.append(row);
      }
    }
    UITransitions.show(gameplayRank,visible);
    if(!visible) {
      UITransitions.show(gameplayRank.querySelector('section'),false);
      gameplayRank.querySelector('button').setAttribute('aria-expanded','false');
      gameplayRank.querySelector('button span').textContent='展开排行榜';return;
    }
    const rect=canvas.getBoundingClientRect();
    gameplayRank.style.left=`${rect.left+rect.width*.02}px`;
    gameplayRank.style.bottom=`${window.innerHeight-rect.bottom+rect.height*.025}px`;
    gameplayRank.style.transform=`scale(${rect.width/CONFIG.GAME_WIDTH})`;
  }
  function draw(ctx,assets,state,time,canvas) {
    const W=CONFIG.GAME_WIDTH,H=CONFIG.GAME_HEIGHT,t=time-state.start;
    const fade=smooth((t-900)/500),settle=smooth((t-1500)/550);
    ctx.drawImage(state.snapshot,0,0,W,H);
    ctx.save();ctx.fillStyle=`rgba(0,12,27,${.32*smooth(t/400)})`;ctx.fillRect(0,0,W,H);
    if(fade>0) {ctx.globalAlpha=fade;ctx.drawImage(assets.images.backgroundStart||assets.images.background,0,0,W,H);ctx.globalAlpha=1;}
    BubbleTransition.draw(ctx,state.bubbles,time);
    ctx.textAlign='center';ctx.textBaseline='middle';
    // The bubble title grows in place and fades away with the bubbles.
    ctx.save();ctx.translate(W/2,H*.5);
    const scale=.3+.7*smooth((t-350)/450);ctx.scale(scale,scale);
    ctx.globalAlpha=smooth((t-350)/200)*(1-smooth((t-1150)/350));
    ctx.font=`150px ${CONFIG.COUNTDOWN_FONT}`;ctx.fillStyle='#d3f6ff';ctx.shadowColor='#75dcff';ctx.shadowBlur=24;
    ctx.fillText('游戏结束',0,0);ctx.restore();
    // A separate smaller settlement title enters from above.
    const titleArrival=smooth((t-1500)/450);
    ctx.globalAlpha=titleArrival;ctx.font=`80px ${CONFIG.COUNTDOWN_FONT}`;
    ctx.fillStyle='#d3f6ff';ctx.shadowColor='#75dcff';ctx.shadowBlur=18;
    ctx.fillText('游戏结束',W/2,-70+(H*.1+70)*titleArrival);ctx.shadowBlur=0;
    if(settle>0) {
      ctx.globalAlpha=settle;ctx.translate(0,(1-settle)*35);
      const cx=W/2,cy=H*.3,r=H*.145;
      if(assets.images.bubble)ctx.drawImage(assets.images.bubble,cx-r,cy-r,r*2,r*2);
      ctx.fillStyle='#b7dcea';ctx.font=`36px ${CONFIG.FONT_FAMILY}`;ctx.fillText('本局得分',cx,cy-50);
      ctx.fillStyle='#ecfbff';ctx.font=`90px ${CONFIG.FONT_FAMILY}`;ctx.shadowColor='#65d6ff';ctx.shadowBlur=16;ctx.fillText(String(state.score),cx,cy+25);ctx.shadowBlur=0;
      if(state.newRecord) {ctx.font=`34px ${CONFIG.FONT_FAMILY}`;ctx.fillStyle='#b7f5dd';ctx.fillText('新纪录！',cx,H*.48);}
      ctx.fillStyle='#d3e7f1';ctx.font=`40px ${CONFIG.FONT_FAMILY}`;ctx.fillText('个人排行榜',cx,H*.56);
      for(let i=0;i<3;i++) {
        const y=H*(.625+i*.075),x=cx-230;
        ctx.fillStyle='rgba(157,202,225,.08)';ctx.fillRect(cx-290,y-45,580,82);
        const icon=assets.images[['1st','2nd','3rd'][i]];
        if(icon)ctx.drawImage(icon,x-40,y-48,80,96);
        ctx.textAlign='right';ctx.fillStyle='#d6e9f5';ctx.font=`40px ${CONFIG.FONT_FAMILY}`;
        ctx.fillText(state.records[i]?String(state.records[i].score):'—',cx+225,y);ctx.textAlign='center';
      }
      if(state.storageFailed){ctx.font=`24px ${CONFIG.FONT_FAMILY}`;ctx.fillText('浏览器未能保存记录，本次记录仅在当前页面保留',cx,H*.94);}
    }
    ctx.restore();
    UITransitions.show(actions,t>=2200);
    if(t>=2200) {
      const rect=canvas.getBoundingClientRect();
      actions.style.left=`${rect.left+rect.width*.5}px`;actions.style.top=`${rect.top+rect.height*.85}px`;
      actions.style.transform=`translateX(-50%) scale(${rect.width/W})`;
    }
  }
  return {install,create,draw,hide,read,updateGameplay};
})();
