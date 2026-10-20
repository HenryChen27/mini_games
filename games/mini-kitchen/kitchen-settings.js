/* Local preferences and an isolated, non-playing shortcut preview. */
(function(){
 const id=h=>`${h.kind}:${h.i??h.value??'help'}`;
 // Left hand: soup Q/A/Z, bowls W/S/X. Right hand: plates I/K/, and
 // pans O/L/.. Space and Enter are the two frequent base ingredients.
 const defaults=['KeyQ','KeyA','KeyZ','KeyO','KeyL','Period','KeyW','KeyS','KeyX','KeyI','KeyK','Comma','Digit1','Digit2','Digit9','Digit0','Space','Enter','KeyC','KeyV','Slash','F1'];
 const initial=Object.fromEntries(hits.map((h,i)=>[id(h),defaults[i]]));let bindings={...initial},draft=null,selected=null;
 const desktop=matchMedia('(hover: hover) and (pointer: fine)');
 let outlines={};fetch('assets/fx/shortcut-outlines.json?v=20261020-polish2').then(r=>r.json()).then(data=>{outlines=data;if(draft)render(0);}).catch(error=>console.warn('Shortcut outlines unavailable',error));
 const duplicates=map=>{const counts={};for(const key of Object.values(map))counts[key]=(counts[key]||0)+1;return new Set(Object.keys(counts).filter(k=>counts[k]>1));};
 const validKey=key=>typeof key==='string'&&/^(?:(?:Ctrl|Alt|Shift|Meta)\+)*(?:Key[A-Z]|Digit[0-9]|Numpad[0-9]|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Space|Enter|Tab|Backspace|Delete|Slash|Backslash|Comma|Period|Semicolon|Quote|BracketLeft|BracketRight|Minus|Equal|Backquote)$/.test(key);
 try{const saved=JSON.parse(localStorage.getItem('bonbon-keybindings-v1'));if(saved&&Object.keys(initial).every(k=>validKey(saved[k]))){const candidate=Object.fromEntries(Object.keys(initial).map(k=>[k,saved[k]]));if(!duplicates(candidate).size)bindings=candidate;}}catch{}
 const section=document.createElement('section');section.className='kitchen-settings';section.innerHTML=`<button id="settings-toggle" aria-label="设置" aria-expanded="false"><img src="assets/settings.png" alt=""><span>设置</span></button><div id="settings-panel" hidden><h2>设置</h2><label class="kitchen-volume"><span>背景音乐</span><output id="music-value"></output><input id="music-volume" type="range" min="0" max="100" aria-label="背景音乐音量"></label><label class="kitchen-volume"><span>游戏音效</span><output id="effects-value"></output><input id="effects-volume" type="range" min="0" max="100" aria-label="游戏音效音量"></label><button id="edit-keybindings">快捷键设置</button></div>`;document.body.append(section);
 const toolbar=document.createElement('section');toolbar.id='keybinding-toolbar';toolbar.hidden=true;toolbar.innerHTML='<p id="keybinding-hint" aria-live="polite">点击按钮，再按下快捷键</p><div><button id="reset-keybindings">恢复默认</button><button id="cancel-keybindings">取消</button><button id="save-keybindings">保存</button></div>';document.body.append(toolbar);
 const panel=section.querySelector('#settings-panel'),toggle=section.querySelector('#settings-toggle'),entry=section.querySelector('#edit-keybindings'),hint=toolbar.querySelector('p');
 function closePanel(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
 toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));};
 for(const key of ['music','effects']){
  const input=section.querySelector(`#${key}-volume`),output=section.querySelector(`#${key}-value`);input.value=Math.round(kitchenSound.volumes[key]*100);output.value=input.value+'%';
  input.oninput=()=>{kitchenSound.unlock();kitchenSound.setVolume(key,Number(input.value)/100);output.value=input.value+'%';};
  if(key==='effects')input.onchange=()=>kitchenSound.play('click');
 }
 function device(){entry.hidden=!desktop.matches;if(!desktop.matches&&draft)leave();}desktop.addEventListener('change',device);device();
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.kitchen-settings'))closePanel();});
 function enter(){
  if(!ready||!desktop.matches||!['home','playing','results'].includes(phase))return;
  if(phase==='playing'){saveRun();running=false;paused=false;window.dispatchEvent(new CustomEvent('bonbon:suspend'));}
  closePanel();draft={...bindings};selected=null;toolbar.hidden=false;hint.textContent='点击按钮，再按下快捷键';
  overlay.style.display='none';BonbonCelebration.clear();setPhase('keybindings');render(0);
 }
 function leave(){draft=null;selected=null;toolbar.hidden=true;showHome();render(0);}
 entry.onclick=enter;
 toolbar.querySelector('#cancel-keybindings').onclick=leave;
 toolbar.querySelector('#reset-keybindings').onclick=()=>{draft={...initial};selected=null;hint.textContent='已恢复默认，保存后生效';render(0);};
 toolbar.querySelector('#save-keybindings').onclick=()=>{
  const clashes=duplicates(draft);if(clashes.size){hint.textContent='快捷键有重复，请修改后保存';hint.classList.add('key-error');render(0);return;}
  bindings={...draft};try{localStorage.setItem('bonbon-keybindings-v1',JSON.stringify(bindings));}catch{}hint.classList.remove('key-error');leave();
 };
 function label(key){return key.replace(/Key/g,'').replace(/Digit/g,'').replace(/Numpad/g,'Num ').replace('Slash','/').replace('Comma',',').replace('Period','.').replace('Space','空格').replace('Enter','回车').replace('ArrowUp','↑').replace('ArrowDown','↓').replace('ArrowLeft','←').replace('ArrowRight','→').replace('Meta','⌘');}
 function eventKey(e){return `${e.ctrlKey?'Ctrl+':''}${e.altKey?'Alt+':''}${e.shiftKey?'Shift+':''}${e.metaKey?'Meta+':''}${e.code}`;}
 document.addEventListener('keydown',e=>{
  if(draft){
   if(e.code==='Escape'){e.preventDefault();selected=null;hint.textContent='点击按钮，再按下快捷键';render(0);return;}
   if(!selected||!validKey(eventKey(e)))return;
   e.preventDefault();e.stopImmediatePropagation();draft[selected]=eventKey(e);hint.classList.remove('key-error');hint.textContent='可继续修改，完成后保存';render(0);return;
  }
  if(e.repeat||phase!=='playing'||!running||document.querySelector('dialog[open]')||!panel.hidden||e.target.matches('input,textarea,select'))return;
  const key=eventKey(e),h=hits.find(h=>bindings[id(h)]===key);if(!h)return;
  e.preventDefault();e.stopImmediatePropagation();kitchenSound.unlock();interact(h);
 },true);
 window.BonbonSettings={
  hasKey(e){return !draft&&phase==='playing'&&running&&!document.querySelector('dialog[open]')&&panel.hidden&&Object.values(bindings).includes(eventKey(e));},
  select(point){if(!draft)return;const h=hits.find(h=>{const r=hitRect(h);return point.x>=r.x&&point.x<=r.x+r.w&&point.y>=r.y&&point.y<=r.y+r.h;});if(h){selected=id(h);hint.textContent='按下新的快捷键';render(0);}},
  draw(){if(!draft)return;const clash=duplicates(draft);ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
   for(const h of hits){const name=id(h),shape=outlines[name];if(!shape)continue;const [bx,by,bw,bh]=shape.bounds,shift=h.kind==='help'?hudShift(103):0,r={x:bx+shift,y:by,w:bw,h:bh},key=draft[name],color=selected===name?'#F5CD68':clash.has(key)?'#D1453A':'#79B74B';
    ctx.strokeStyle=color;ctx.lineWidth=selected===name?8:5;ctx.lineJoin='round';ctx.beginPath();shape.points.forEach(([x,y],i)=>i?ctx.lineTo(x+shift,y):ctx.moveTo(x+shift,y));ctx.closePath();ctx.stroke();
    const text=label(key);ctx.font=`${text.length>9?34:48}px HuakangPOP,sans-serif`;const width=Math.min(r.w-24,ctx.measureText(text).width+40),x=r.x+r.w/2,y=r.y+r.h/2;
    ctx.fillStyle='#27251fe0';ctx.beginPath();ctx.roundRect(x-width/2,y-37,width,74,12);ctx.fill();ctx.fillStyle=color;ctx.fillText(text,x,y);
   }ctx.restore();
  },
  drawHints(){if(!desktop.matches||draft||phase!=='playing')return;ctx.save();ctx.font='34px HuakangPOP,sans-serif';ctx.textAlign='right';ctx.textBaseline='bottom';ctx.lineJoin='round';
   for(const h of hits){const shape=outlines[id(h)];if(!shape)continue;const [x,y,w,height]=shape.bounds,shift=h.kind==='help'?hudShift(103):0,value=label(bindings[id(h)]),px=x+w-10+shift,py=y+height-7;
    ctx.lineWidth=5;ctx.strokeStyle='#30291ed9';ctx.strokeText(value,px,py);ctx.fillStyle='#eddaa7c9';ctx.fillText(value,px,py);
   }ctx.restore();
  },get state(){return {editing:!!draft,selected,bindings:{...bindings},draft:draft?{...draft}:null,desktop:desktop.matches,outlineCount:Object.keys(outlines).length};}
 };
})();
