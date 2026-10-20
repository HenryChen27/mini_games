const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const {Kitchen}=BonbonRules,game=new Kitchen();
let assets={},byId={},images={},running=false,paused=false,last=0,sound=true,ready=false;
let cookingFX,orderReveal=1;
let resumeCountdown=false,resumeFromSave=false;
let phase='home',phaseTime=0,countdownValue='',roundSaved=false,exitSnapshot=null,memorySave=null,scorePulse=1;
const launchDuration=.4,introDuration=3.45,timeupDuration=1.65,outroDuration=.8;
let trashEffects=[],deliveryFlights=[],completedOrders=[],pressEffects=[],pourEffects=[];
const green='#498E02',yellow='#CEAD37',red='#D1453A';
const potLayers=[
 {empty:2,cooking:4,soup:3,carrot_soup:5,corn_soup:6},
 {empty:8,cooking:10,soup:9,carrot_soup:11,corn_soup:12},
 {empty:14,cooking:16,soup:15,carrot_soup:17,corn_soup:18},
 {empty:35,cooking:37,beef:36,tomato_beef:38,potato_beef:39,burnt:40},
 {empty:42,cooking:44,beef:43,tomato_beef:45,potato_beef:46,burnt:47},
 {empty:49,cooking:51,beef:50,tomato_beef:52,potato_beef:53,burnt:54}
];
const storeLayers=[{empty:20,soup:21,carrot_soup:22,corn_soup:23},{empty:25,soup:26,carrot_soup:27,corn_soup:28},{empty:30,soup:31,carrot_soup:32,corn_soup:33},{empty:56,beef:59,tomato_beef:57,potato_beef:58},{empty:61,beef:64,tomato_beef:62,potato_beef:63},{empty:66,beef:69,tomato_beef:67,potato_beef:68}];
const icons={soup:21,carrot_soup:22,corn_soup:23,beef:59,tomato_beef:57,potato_beef:58,rice:83,bread:82,candy:76};
const pressGroups=[...potLayers,...storeLayers,{empty:75,candy:76},{empty:78,beef:79},{empty:81,bread:82}];
const centers=[{x:1735,y:900},{x:1710,y:1190},{x:1700,y:1505},{x:3210,y:935},{x:3245,y:1220},{x:3265,y:1535}];
const hits=[
 ...Array.from({length:3},(_,i)=>({x:1430,y:735+i*300,w:530,h:310,kind:'pot',i})),
 ...Array.from({length:3},(_,i)=>({x:2990,y:755+i*300,w:550,h:310,kind:'pot',i:i+3})),
 ...Array.from({length:3},(_,i)=>({x:2030,y:815+i*285,w:490,h:280,kind:'storage',i})),
 ...Array.from({length:3},(_,i)=>({x:2525,y:845+i*285,w:410,h:270,kind:'storage',i:i+3})),
 {x:960,y:925,w:450,h:300,kind:'ingredient',value:'corn',sprite:72},
 {x:920,y:1280,w:480,h:320,kind:'ingredient',value:'carrot',sprite:73},
 {x:3540,y:955,w:450,h:300,kind:'ingredient',value:'potato',sprite:71},
 {x:3580,y:1300,w:400,h:300,kind:'ingredient',value:'tomato',sprite:70},
 {x:1415,y:1770,w:420,h:300,kind:'ingredient',value:'water',sprite:85},
 {x:3050,y:1780,w:480,h:300,kind:'ingredient',value:'raw_beef',sprite:79},
 {x:2010,y:1775,w:400,h:300,kind:'instant',value:'rice'},
 {x:2485,y:1790,w:450,h:280,kind:'instant',value:'bread'},
 {x:3620,y:1780,w:420,h:290,kind:'instant',value:'candy'},
 {x:3993,y:9,w:460,h:415,kind:'help'}
];
function layer(id){return byId[id];}
function draw(id){const a=layer(id);if(!a)return;const [x,y,r,b]=a.box,im=images[a.src];if(id===35){const [sx,sy,w,h]=a.contentBox;ctx.drawImage(im,sx,sy,w,h,x+sx,y+sy,w,h);}else ctx.drawImage(im,x,y,r-x,b-y);}
function pressState(p){const u=Math.min(1,p.t/.28),pulse=Math.sin(Math.PI*u);return{scale:1+.09*pulse,brightness:1-.3*pulse};}
function pressKey(id){return pressGroups.find(m=>Object.values(m).includes(id))?.empty??id;}
function pressed(id,paint){const key=pressKey(id),p=pressEffects.find(e=>e.id===key);if(!p){paint();return;}const a=layer(key),[sx,sy,w,h]=a.contentBox,x=a.box[0]+sx+w/2,y=a.box[1]+sy+h/2,{scale,brightness}=pressState(p);ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.translate(-x,-y);ctx.filter=`brightness(${brightness})`;paint();ctx.restore();}
function press(id){id=pressKey(id);pressEffects=pressEffects.filter(p=>p.id!==id);pressEffects.push({id,t:0,duration:.28});}
function stamp(id,x,y,w,h){const a=layer(id),im=images[a.src],[sx,sy,sw,sh]=a.contentBox,scale=Math.min(w/sw,h/sh);ctx.drawImage(im,sx,sy,sw,sh,x+(w-sw*scale)/2,y+(h-sh*scale)/2,sw*scale,sh*scale);}
function stampIcon(dish,x,y,w,h){const a=layer(icons[dish]),[sx,sy,sw,sh]=a.iconBox||a.contentBox,[cx,cy]=a.iconCenter||[sx+sw/2,sy+sh/2],scale=Math.min(w/sw,h/sh);ctx.drawImage(images[a.src],sx,sy,sw,sh,x+w/2+(sx-cx)*scale,y+h/2+(sy-cy)*scale,sw*scale,sh*scale);}
function text(t,x,y,size,color,align='left'){ctx.font=`${size}px HuakangPOP,sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(t,x,y);}
function hudNumber(value,x,y,color){ctx.save();ctx.font='68px HuakangPOP,sans-serif';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='alphabetic';const m=ctx.measureText(String(value));ctx.fillText(value,x,y+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);ctx.restore();}
function visibleScore(){return Math.max(0,game.score-completedOrders.reduce((sum,c)=>sum+(c.t<1.42?(c.award||0):0),0));}
function drawScoreProgress(){const width=1204*Math.min(1,visibleScore()/8000);if(width>0)round(1695,109,width,12,Math.min(3,width/2),'#e4c87b');}
function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function bar(x,y,h,f,color){round(x-7,y-7,44,h+14,20,'#40372cd9');round(x,y,30,h,14,'#302a27');if(f>0)round(x+3,y+3+(h-6)*(1-f),24,Math.max(1,(h-6)*f),11,color);}
function circleProgress(x,y,f){ctx.save();ctx.lineCap='butt';ctx.lineWidth=40;ctx.strokeStyle='#40372cd9';ctx.beginPath();ctx.arc(x,y,48,0,Math.PI*2);ctx.stroke();ctx.lineWidth=26;ctx.strokeStyle='#302a27';ctx.beginPath();ctx.arc(x,y,48,0,Math.PI*2);ctx.stroke();if(f>0){ctx.lineWidth=20;ctx.strokeStyle=green;ctx.beginPath();ctx.arc(x,y,48,-Math.PI/2,-Math.PI/2+Math.PI*2*f);ctx.stroke();}ctx.restore();}
function check(x,y,size,alpha=1){const im=images['assets/correct.png'];if(!im)return;ctx.save();ctx.globalAlpha*=alpha*.58;ctx.drawImage(im,x-size*.6,y-size*.6,size*1.2,size*1.2);ctx.restore();}
const kitchenSound=BonbonAudio.create();
function beep(){kitchenSound.play('click');}
function servingSource(h,dish){if(h.kind==='pot')return{...centers[h.i],w:290,h:220};const id=h.kind==='storage'?storeLayers[h.i].empty:icons[dish],a=layer(id),[sx,sy,w,height]=a.contentBox;return{x:a.box[0]+sx+w/2,y:a.box[1]+sy+height/2,w:Math.min(w,340),h:Math.min(height,240)};}
function resultEffects(result,h){if(!result.ok)return;kitchenSound.play(result.trash?'trash_can':result.target?(result.award?'submit_order':'submit_dish'):result.stored?(h.i<3?'switch_to_bowl':'switch_to_plate'):'click');if(result.target){deliveryFlights.push({dish:result.dish,target:result.target,source:servingSource(h,result.dish),t:0,duration:.38});if(result.award)completedOrders.push({order:result.target.order,award:result.award,heartSizes:Array.from({length:Math.max(3,Math.min(12,Math.ceil(result.award/45)))},()=>90+Math.random()*45),t:0,duration:1.7});}if(result.award)window.dispatchEvent(new CustomEvent('bonbon:order-complete',{detail:game.snapshot()}));if(result.trash)trashEffects.push({t:0,duration:.65});}
function fire(i,time){cookingFX.fire(i);}
function orderDishRect(o,j,n=0){const cx=880+(o.slot??n)*620+250,cy=145+340;if(o.dishes[0]==='candy'){const rows=Math.ceil(o.dishes.length/2);return{x:cx+(j%2-.5)*170-72.5,y:cy+(Math.floor(j/2)-(rows-1)/2)*150-52.5,w:145,h:105};}return{x:cx-114,y:cy+(j-(o.dishes.length-1)/2)*150-65,w:228,h:130};}
function drawOrder(o,n,alpha=1,gold=0){
 const x=880+(o.slot??n)*620,y=145,w=500,h=660,arrival=Math.min(1,o.age/.4);
 ctx.save();ctx.globalAlpha*=alpha*arrival*smooth(orderReveal/.3);ctx.translate(0,100*Math.pow(1-arrival,3));ctx.save();if(gold>0){ctx.filter=`sepia(${gold*.35}) saturate(${1-gold*.35}) brightness(${1+gold*.85})`;ctx.shadowColor='#ffd774';ctx.shadowBlur=gold*28;}stamp(o.paper||98,x,y,w,h);ctx.restore();
 o.dishes.forEach((dish,j)=>{
  const {x:xx,y:yy,w:iw,h:ih}=orderDishRect(o,j,n),delivered=o.done[j]&&!deliveryFlights.some(f=>f.target.orderId===o.id&&f.target.index===j);
  ctx.save();if(delivered)ctx.globalAlpha*=.42;stampIcon(dish,xx,yy,iw,ih);ctx.restore();if(delivered)check(xx+iw*.78,yy+ih*.62,70);
 });
 const f=1-o.age/30;bar(x+w+5,y+110,500,Math.max(0,f),game.frenzy?green:f>.5?green:f>.25?yellow:red);ctx.restore();
}
function trashLidProgress(e){const u=e.t/e.duration;return smooth(u/.22)*(1-smooth((u-.72)/.28));}
function drawTrashLid(){
 const progress=Math.max(0,...trashEffects.map(trashLidProgress));
 const a=layer(91),[x,y,w,h]=a.contentBox,hingeX=a.box[0]+x+w,hingeY=a.box[1]+y+h*.52;
 ctx.save();ctx.translate(hingeX,hingeY);ctx.rotate(progress*1.08);ctx.translate(-hingeX,-hingeY);draw(91);ctx.restore();
}
function trashMeatPose(time){
 // Design pixels and seconds: constant horizontal velocity, constant gravity.
 const duration=.46,gravity=7000,t=Math.max(0,Math.min(duration,time-.065));
 const vx=370/duration,vy=(290-.5*gravity*duration*duration)/duration;
 return {x:565+vx*t,y:1550+vy*t+.5*gravity*t*t,t,duration,vx,vy:vy+gravity*t,gravity};
}
function drawTrashContents(){
 for(const e of trashEffects){
  const u=e.t/e.duration;if(!e.kind)continue;
  ctx.save();ctx.beginPath();ctx.rect(250,1150,1100,710);ctx.clip();
  if(e.kind==='meat'){
   const pose=trashMeatPose(e.t),f=pose.t/pose.duration,a=layer(92),r=a.contentBox,size=240-75*f;
   ctx.globalAlpha*=smooth((e.t-.035)/.03)*(1-smooth((f-.94)/.06));ctx.translate(pose.x,pose.y);ctx.rotate(-.22+f*.65);
   ctx.drawImage(images[a.src],...r,-size/2,-size*r[3]/r[2]/2,size,size*r[3]/r[2]);
  }else{
   const enter=smooth(u/.16),leave=1-smooth((u-.86)/.14),tilt=smooth((u-.1)/.23)*(1-smooth((u-.73)/.23));
   const pivotX=735,pivotY=1635,angle=-.12*(1-enter)+tilt*.9,flow=smooth((u-.24)/.09)*(1-smooth((u-.7)/.1));
   if(flow>0){
    ctx.save();ctx.globalAlpha*=flow*.72;ctx.lineCap='round';
    const gradient=ctx.createLinearGradient(pivotX,pivotY,930,1855);gradient.addColorStop(0,'rgba(208,155,79,.75)');gradient.addColorStop(.3,'#d7b578');gradient.addColorStop(.88,'#c49c60');gradient.addColorStop(1,'rgba(184,137,68,.15)');ctx.strokeStyle=gradient;
    // A strong continuous core with only a 2px feather on each side.
    const alpha=ctx.globalAlpha;
    for(const [width,opacity] of [[18,.12],[16,.3],[14,.92]]){ctx.globalAlpha=alpha*opacity;ctx.lineWidth=width*flow;ctx.beginPath();ctx.moveTo(pivotX,pivotY+10);ctx.quadraticCurveTo(858,1690,933,1865);ctx.stroke();}ctx.restore();
   }
   const a=layer(2),r=a.contentBox,w=240,h=w*r[3]/r[2];
   ctx.globalAlpha*=enter*leave;ctx.translate(pivotX,pivotY-16*(1-enter));ctx.rotate(angle);
   ctx.drawImage(images[a.src],...r,-w,-h*.32,w,h);
  }
  ctx.restore();
 }
}
function drawPour(p){const id=[86,87,88][p.i],a=layer(id),x=a.box[2]-30,y=a.box[3]-16,enter=smooth(p.t/.18),leave=smooth((p.t-(p.duration-.18))/.18);ctx.save();ctx.globalAlpha*=Math.min(1,p.t/.1,(p.duration-p.t)/.16);ctx.translate(x,y);ctx.rotate(-.12*(1-enter)+leave*.08);ctx.translate(-x,-y-12*(1-enter));draw(id);ctx.restore();}
function drawDelivery(f){const o=game.orders.find(o=>o.id===f.target.orderId)||completedOrders.find(c=>c.order.id===f.target.orderId)?.order||f.target.order,r=orderDishRect(o,f.target.index),u=Math.min(1,f.t/f.duration),e=1-Math.pow(1-u,3),targetY=r.y+r.h/2+100*Math.pow(1-Math.min(1,o.age/.4),3),x=f.source.x+(r.x+r.w/2-f.source.x)*e,y=f.source.y+(targetY-f.source.y)*e,w=f.source.w+(r.w-f.source.w)*e,h=f.source.h+(r.h-f.source.h)*e;stampIcon(f.dish,x-w/2,y-h/2,w,h);}
function drawCompletionHearts(c){const sizes=c.heartSizes||[100,115,95,125,105,110];for(let j=0;j<sizes.length;j++){const u=(c.t-.62-j*.225/Math.max(1,sizes.length-1))/.55;if(u<0||u>=1)continue;const e=smooth(u),sx=880+c.order.slot*620+250+Math.cos(j*1.9)*95,sy=475+Math.sin(j*1.9)*135,x=sx+(3245-sx)*e,y=sy+(116-sy)*e-Math.sin(Math.PI*u)*(80+j*8),size=sizes[j]*(1-u*.5);ctx.save();ctx.globalAlpha=Math.min(1,u/.12,(1-u)/.1);ctx.translate(x,y);ctx.rotate((1-u)*(j%2?.18:-.18));ctx.drawImage(images['assets/heart.png'],-size/2,-size*.463,size,size*.926);ctx.restore();}}
// PSD descendants are ordered back to front. Keep animations inside their source group.
function buildScene(now){
 const scene=[],add=(z,paint,id=null)=>scene.push({z,paint,id}),sprite=id=>add(id,()=>pressed(id,()=>draw(id)),id),showOrders=!['intro','resuming','resume-countdown'].includes(phase);
 sprite(0);
 for(let i=0;i<6;i++){
  const p=game.pots[i],m=potLayers[i],top=i<3?m.corn_soup:m.burnt;
  if(['cooking','ready'].includes(p.state))add(m.empty-.1,()=>fire(i,now/1000));
  if(!cookingFX.movieFrame(i,p))sprite(m.empty);
  if(p.state!=='empty'){const id=p.state==='burnt'?(i<3?m[p.dish||'soup']:m.burnt):m[p.state==='cooking'?'cooking':p.dish];add(id,()=>pressed(id,()=>cookingFX.pot(i,p)),id);}
  if(['cooking','ready'].includes(p.state)){add(top+.02,()=>cookingFX.surface(i,p));add(top+.04,()=>cookingFX.steam(i,p));}
  add(top+.06,()=>cookingFX.falling(i,p));
  const x=i<3?1950:3515,y=940+(i%3)*300;
  add(top+.1,()=>{
  if(p.state==='cooking')circleProgress(x,y,Math.max(0,1-p.age/3));
  if(p.state==='ready'||p.state==='burnt')bar(x+2,y-120,230,p.state==='burnt'?0:game.frenzy?1:Math.max(0,1-p.age/18),game.frenzy?green:p.age<9?yellow:red);
  });
 }
 for(let i=0;i<6;i++)sprite(storeLayers[i][game.storage[i]||'empty']);
 [70,71,72,73,75,76,78,79,81,82,83].forEach(sprite);
 sprite(85);for(const p of pourEffects){const id=[86,87,88][p.i];add(id,()=>drawPour(p),id);}sprite(90);add(90.5,drawTrashContents);add(91,drawTrashLid,91);
 if(showOrders){game.orders.forEach((o,i)=>add(.5+(o.slot??i)*.001,()=>drawOrder(o,i),o.paper||98));
 for(const c of completedOrders)add(.5+c.order.slot*.001,()=>drawOrder(c.order,c.order.slot,1-smooth((c.t-.55)/.28),smooth((c.t-.38)/.14)),c.order.paper||98);}
 sprite(100);add(100.1,()=>{ctx.save();const pulse=scorePulse<.3?Math.sin(Math.PI*scorePulse/.3):0;ctx.translate(3405,116);ctx.scale(1+pulse*.1,1+pulse*.1);ctx.translate(-3405,-116);hudNumber(visibleScore(),3405,116,'#efca91');ctx.restore();});
 sprite(101);add(101.1,drawScoreProgress);
 sprite(102);add(102.1,()=>{const seconds=Math.max(0,Math.ceil(BonbonRules.duration-game.elapsed));hudNumber(`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`,1418,116,seconds<=5?'#D1453A':'#e5bd73');});
 add(103,()=>{ctx.save();ctx.translate(hudShift(103),0);pressed(103,()=>draw(103));ctx.restore();},103);
 if(showOrders){for(const f of deliveryFlights)add(98.6,()=>drawDelivery(f));
 for(const c of completedOrders)add(103.5,()=>drawCompletionHearts(c));}
 return scene.sort((a,b)=>a.z-b.z);
}
function originalIntroDelay(z){
 if(z>=100)return 2+(Math.floor(z)-100)*.04;
 if(z>=94)return 2.2;
 if(z>=90)return 1.8;
 if(z>=85)return 1.65;
 if(z>=83)return 1.6;
 if(z>=81)return 1.5;
 if(z>=78)return 1.4;
 if(z>=75)return 1.3;
 if(z>=70)return({70:1.15,71:1.05,72:.95,73:1.05})[Math.floor(z)]??1.15;
 if(z>=66)return .85;
 if(z>=61)return .6;
 if(z>=56)return .35;
 if(z>=49)return .65;
 if(z>=42)return .4;
 if(z>=35)return .15;
 if(z>=30)return .75;
 if(z>=25)return .5;
 if(z>=20)return .25;
 if(z>=14)return .55;
 if(z>=8)return .3;
 return .05;
}
function introDelay(z){return originalIntroDelay(z)*.18;}
function smooth(value){const u=Math.max(0,Math.min(1,value));return u*u*(3-2*u);}
function drawEndingBackground(alpha=1){ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(images['assets/ending_background.png'],0,0,4702,2160);ctx.restore();}
let introPainted=false,frozenCountdownPainted=false;
function fitRenderSurface(){const width=Math.min(4702,Math.ceil(Math.max(innerWidth,innerHeight*4702/2160)*Math.min(devicePixelRatio||1,1.5)));canvas.width=width;canvas.height=Math.round(width*2160/4702);ctx.setTransform(canvas.width/4702,0,0,canvas.height/2160,0,0);introPainted=false;frozenCountdownPainted=false;}
window.addEventListener('resize',fitRenderSurface);
function render(now){
 if(!ready)return;
 if(phase==='resume-countdown'&&frozenCountdownPainted)return;
 frozenCountdownPainted=phase==='resume-countdown';
 if(phase==='intro'&&phaseTime>=.9&&introPainted)return;
 introPainted=phase==='intro'&&phaseTime>=.9;ctx.clearRect(0,0,4702,2160);
 if(phase==='keybindings'){renderKeybindingScene();return;}
 if(phase==='home'||phase==='results'||phase==='returning'){drawEndingBackground();return;}
 if(phase==='exiting'){if(exitSnapshot)ctx.drawImage(exitSnapshot,0,0);drawEndingBackground(smooth(phaseTime/launchDuration));return;}
 if(phase==='launch'){drawEndingBackground();ctx.save();ctx.globalAlpha=smooth(phaseTime/launchDuration);draw(0);ctx.restore();return;}
 for(const item of buildScene(now)){
  if(item.z===0){item.paint();if(phase==='resuming')drawEndingBackground(1-smooth(phaseTime/launchDuration));if(phase==='outro')drawEndingBackground(smooth(phaseTime/outroDuration));continue;}
  ctx.save();
  if(phase==='intro'){const u=Math.max(0,Math.min(1,(phaseTime-introDelay(item.z))/.45));if(u===0){ctx.restore();continue;}ctx.globalAlpha*=u;ctx.translate(0,-250*Math.pow(1-u,3));}
  if(phase==='resuming')ctx.globalAlpha*=smooth(phaseTime/launchDuration);
  if(phase==='outro'){const u=Math.min(1,phaseTime/outroDuration);ctx.globalAlpha*=1-u*u*(3-2*u);ctx.translate(0,-35*u);}
  item.paint();ctx.restore();
 }
 if(phase==='playing'){window.BonbonSettings?.drawHints();cookingFX.celebration();}
 if(phase==='timeup'||phase==='outro'){const dark=phase==='timeup'?smooth(phaseTime/.18):1-smooth(phaseTime/outroDuration);ctx.fillStyle=`rgba(10,7,16,${dark*.48})`;ctx.fillRect(0,0,4702,2160);}
}
function renderKeybindingScene(){
 draw(0);for(const m of potLayers)draw(m.empty);for(const m of storeLayers)draw(m.empty);
 for(const id of [70,71,72,73,75,76,78,79,81,82,83,85,90,91])draw(id);ctx.save();ctx.translate(hudShift(103),0);draw(103);ctx.restore();
 window.BonbonSettings?.draw();
}
function sceneView(){const r=canvas.getBoundingClientRect(),scale=Math.max(r.width/4702,r.height/2160),ox=(r.width-4702*scale)/2,oy=(r.height-2160*scale)/2;return{r,scale,ox,oy,left:-ox/scale,right:(r.width-ox)/scale};}
function hudShift(id){if(id===104)return 0;const view=sceneView(),a=layer(id),[sx,,sw]=a.contentBox,x=a.box[0]+sx;return Math.min(0,view.right-40-x-sw);}
function point(e){const {r,scale,ox,oy}=sceneView();return{x:(e.clientX-r.left-ox)/scale,y:(e.clientY-r.top-oy)/scale};}
function hitRect(h){return{...h,x:h.x+(h.kind==='help'?hudShift(103):0)};}
function target(p){return hits.find(h=>{const r=hitRect(h);return p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;});}
canvas.addEventListener('pointermove',e=>canvas.style.cursor=phase==='playing'&&target(point(e))?'pointer':'default');canvas.addEventListener('pointerleave',()=>canvas.style.cursor='default');
function interact(h){
 if(!h||phase!=='playing')return false;if(h.kind==='help'){press(103);beep();showHelp();return true;}if(!running||paused)return false;
 const id=h.kind==='ingredient'?h.sprite:h.kind==='instant'?icons[h.value]:h.kind==='pot'?potLayers[h.i].empty:storeLayers[h.i].empty;press(id);
 if(h.kind==='ingredient'){const i=game.autoCook(h.value);if(i<0){beep();return false;}cookingFX.add(i,h.value);cookingFX.sync(game.pots);kitchenSound.play(({water:'add_water',raw_beef:'add_beef',corn:'add_corn_or_carrot',carrot:'add_corn_or_carrot',tomato:'add_tomato_or_potato',potato:'add_tomato_or_potato'})[h.value]||'click');if(h.value==='water')pourEffects.push({i,t:0,duration:.65});return true;}
 const discardedDish=h.kind==='pot'?game.pots[h.i]?.dish:h.kind==='storage'?game.storage[h.i]:null;
 const result=h.kind==='pot'?game.take(h.i):h.kind==='storage'?game.takeStorage(h.i):game.serve(h.value);cookingFX.sync(game.pots);resultEffects(result,h);if(!result.ok)beep();
 if(result.ok&&result.trash){const e=trashEffects[trashEffects.length-1];e.kind=discardedDish&&['soup','corn_soup','carrot_soup'].includes(discardedDish)?'soup':'meat';if(e.kind==='soup')e.duration=1.2;}
 return result.ok;
}
canvas.addEventListener('pointerdown',e=>{kitchenSound.unlock();if(phase==='keybindings'){window.BonbonSettings?.select(point(e));return;}interact(target(point(e)));});
const overlay=document.querySelector('#overlay'),playIcon='<svg viewBox="0 0 80 80"><path d="M30 20 60 40 30 60Z"/></svg>',resetIcon='<svg viewBox="0 0 80 80"><path d="M22 23a24 24 0 1 1-6 25M22 10v19H4"/></svg>';
function setPhase(value){if(value==='playing'&&phase!=='playing')orderReveal=0;phase=value;phaseTime=0;frozenCountdownPainted=false;document.querySelector('#game').dataset.phase=value;overlay.classList.toggle('cinematic',value!=='playing');}
const saveKey='bonbon-save-v1';
function clearSavedRun(){memorySave=null;try{localStorage.removeItem(saveKey);}catch{}}
function readSavedRun(){try{const value=JSON.parse(localStorage.getItem(saveKey)||'null')||memorySave;return value?.version===1&&Kitchen.isValidSave(value.engine)?value:null;}catch{return memorySave;}}
function saveRun(){if(game.ended||!['playing','resume-countdown','resuming'].includes(phase))return;memorySave=JSON.parse(JSON.stringify({version:1,engine:game.serialize(),effects:{trashEffects,deliveryFlights,completedOrders,pourEffects,cooking:cookingFX.serialize()}}));try{localStorage.setItem(saveKey,JSON.stringify(memorySave));}catch{}}
function exitToHome(){if(phase==='playing'){saveRun();exitSnapshot=document.createElement('canvas');exitSnapshot.width=4702;exitSnapshot.height=2160;exitSnapshot.getContext('2d').drawImage(canvas,0,0,4702,2160);running=false;paused=false;window.dispatchEvent(new CustomEvent('bonbon:suspend'));setPhase('exiting');overlay.innerHTML='';overlay.style.display='none';}else if(phase==='results'){BonbonCelebration.setFalling(false);setPhase('returning');}}
function requestStart(){if(readSavedRun())document.querySelector('#continue-dialog').showModal();else begin();}
function resumeSavedRun(){const saved=readSavedRun();document.querySelector('#continue-dialog').close();if(!saved||!game.restore(saved.engine)){clearSavedRun();begin();return;}const effects=saved.effects||{},valid=(a,duration)=>Array.isArray(a)?a.filter(e=>e&&Number.isFinite(e.t)&&e.t>=0&&e.t<duration&&e.duration===duration):[];trashEffects=[...valid(effects.trashEffects,.65),...valid(effects.trashEffects,1.2)];deliveryFlights=valid(effects.deliveryFlights,.38).filter(e=>icons[e.dish]&&e.source&&e.target?.order);completedOrders=valid(effects.completedOrders,1.7).filter(e=>e.order&&Number.isInteger(e.order.slot)&&e.order.slot>=0&&e.order.slot<5&&Array.isArray(e.order.dishes)&&e.order.dishes.every(d=>icons[d])&&Number.isFinite(e.award)&&e.award>=0);pourEffects=valid(effects.pourEffects,.65).filter(e=>Number.isInteger(e.i)&&e.i>=0&&e.i<3);cookingFX.restore(effects.cooking,game.pots);pressEffects=[];roundSaved=false;scorePulse=1;running=false;paused=false;last=performance.now();BonbonCelebration.clear();setPhase('resuming');}
document.querySelector('#continue-run').onclick=resumeSavedRun;
document.querySelector('#new-run').onclick=()=>{document.querySelector('#continue-dialog').close();begin();};
window.addEventListener('pagehide',saveRun);
function begin(){if(!ready||phase==='launch'||phase==='intro'||phase==='returning')return;clearSavedRun();game.reset();cookingFX.reset(game.pots);scorePulse=1;roundSaved=false;trashEffects=[];deliveryFlights=[];completedOrders=[];pressEffects=[];pourEffects=[];running=false;paused=false;last=performance.now();BonbonCelebration.setFalling(false);setPhase('launch');}
function showCountdown(resume=false){resumeCountdown=resume;setPhase(resume?'resume-countdown':'intro');BonbonCelebration.clear();overlay.style.display='grid';overlay.innerHTML='<div id="countdown" class="countdown-message" role="status" aria-live="polite"></div>';countdownValue='';updateCountdown();}
function updateCountdown(){const next=phaseTime<1?'3':phaseTime<2?'2':phaseTime<3?'1':'GO!';if(next===countdownValue)return;countdownValue=next;kitchenSound.play(next==='GO!'?'start':'timer');const el=document.querySelector('#countdown');el.textContent=next;for(const a of el.getAnimations())a.cancel();el.animate([{opacity:0,transform:'scale(1.2)'},{opacity:1,transform:'scale(1)',offset:.2},{opacity:1,transform:'scale(1)',offset:.75},{opacity:0,transform:'scale(.9)'}],{duration:next==='GO!'?440:940,easing:'ease-out'});}
function startPlaying(){setPhase('playing');overlay.style.display='none';running=true;game.spawn();window.dispatchEvent(new CustomEvent('bonbon:start'));}
let scoreHistory=[];
function chefTitle(score){return score>=8000?'金牌厨师':score>=5000?'银牌厨师':score>=2000?'铜牌厨师':'见习厨师';}
function readScores(){try{const saved=JSON.parse(localStorage.getItem('bonbon-scores')||'[]');if(Array.isArray(saved))scoreHistory=saved.filter(e=>Number.isFinite(e.score)&&e.score>=0).sort((a,b)=>b.score-a.score||(b.at||0)-(a.at||0)).slice(0,100);if(!scoreHistory.length){const best=Number(localStorage.getItem('bonbon-best'));if(best>0&&Number.isFinite(best))scoreHistory=[{score:best,at:0}];}}catch{}return scoreHistory;}
function saveScore(){const rows=readScores().slice();rows.push({score:Math.max(0,Math.round(game.score)),at:Date.now()});scoreHistory=rows.sort((a,b)=>b.score-a.score||(b.at||0)-(a.at||0)).slice(0,100);try{localStorage.setItem('bonbon-scores',JSON.stringify(scoreHistory));localStorage.setItem('bonbon-best',scoreHistory[0].score);}catch{}}
function end(){kitchenSound.play('start');clearSavedRun();running=false;paused=false;setPhase('timeup');if(!roundSaved){saveScore();roundSaved=true;}BonbonCelebration.clear();BonbonCelebration.burst();overlay.style.display='grid';overlay.innerHTML='<h2 id="time-up" class="timeup-message" role="status">时间到！</h2>';window.dispatchEvent(new CustomEvent('bonbon:finish',{detail:game.snapshot()}));}
function showResults(){setPhase('results');BonbonCelebration.setFalling(true);overlay.style.display='grid';overlay.innerHTML='<section class="screen-content results"><h1>金牌厨师</h1><div class="results-score-row"><img src="assets/heart.png" alt=""><output id="result-score" class="results-score" aria-label="本局分数">0</output></div><button id="restart" class="asset-button replay-button">再来一局</button><button id="home-return" class="home-return" aria-label="返回首页"><img src="assets/sprites/104_exit.png" alt=""></button></section>';document.querySelector('.results h1').textContent=chefTitle(game.score);document.querySelector('#restart').onclick=begin;document.querySelector('#home-return').remove();}
const homeMarkup='<section class="screen-content home-screen"><h1>邦邦小厨房</h1><p class="home-hint">游戏时长90秒，尽可能烹饪更多菜品！<br>最后30秒开启「邦邦时刻」，烹饪立刻完成且不会烧糊。</p><button id="start" class="asset-button home-start">开始游戏</button><button id="ranking" class="ranking-button" aria-label="打开本机排行榜"><img src="assets/ranking.png" alt=""><span>排行榜</span></button></section>';
function bindHome(){document.querySelector('#start').onclick=requestStart;document.querySelector('#ranking').onclick=showRanking;let best=document.querySelector('.home-best');if(!best){best=document.createElement('p');best.className='home-best';document.querySelector('.home-screen').append(best);}best.textContent=`最高得分：${readScores()[0]?.score||0}`;}
function showHome(){setPhase('home');BonbonCelebration.clear();overlay.style.display='grid';overlay.innerHTML=homeMarkup;bindHome();}
function rankingDate(at){const date=new Date(at);if(!Number.isFinite(at)||at<=0||!Number.isFinite(date.getTime()))return '日期未记录';const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}.${pad(date.getMonth()+1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;}
function showRanking(){
 const list=document.querySelector('#ranking-list'),rows=readScores();list.replaceChildren();
 rows.forEach((entry,i)=>{
  const li=document.createElement('li'),rank=document.createElement('span'),date=document.createElement('time'),score=document.createElement('strong');
  rank.className='rank-place';date.className='rank-date';score.className='rank-score';
  if(i<3){const medal=document.createElement('img');medal.src=`assets/${['1st','2nd','3rd'][i]}.png`;medal.alt=String(i+1);medal.draggable=false;rank.append(medal);}else rank.textContent=i+1;
  date.textContent=rankingDate(entry.at);if(Number.isFinite(entry.at)&&entry.at>0)date.dateTime=new Date(entry.at).toISOString();
  score.textContent=Math.round(entry.score);li.append(rank,date,score);list.append(li);
 });
 document.querySelector('#ranking-empty').hidden=rows.length>0;
 const dialog=document.querySelector('#leaderboard');dialog.showModal();document.querySelector('#ranking-scroll').scrollTop=0;
}
{
 const dialog=document.querySelector('#leaderboard'),scroller=document.querySelector('#ranking-scroll');let drag=null;
 scroller.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;drag={id:e.pointerId,y:e.clientY,top:scroller.scrollTop};scroller.setPointerCapture(e.pointerId);scroller.classList.add('dragging');});
 scroller.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)scroller.scrollTop=drag.top+drag.y-e.clientY;});
 const stop=e=>{if(drag?.id===e.pointerId){drag=null;scroller.classList.remove('dragging');}};
 for(const name of ['pointerup','pointercancel','lostpointercapture'])scroller.addEventListener(name,stop);
 dialog.addEventListener('close',()=>{drag=null;scroller.classList.remove('dragging');});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
}
function advancePresentation(dt){
 if(document.hidden)return;
 phaseTime+=dt;
 if(phase==='launch'&&phaseTime>=launchDuration)showCountdown();
 else if(phase==='intro'||phase==='resume-countdown'){if(phaseTime>=introDuration){if(resumeCountdown){setPhase('playing');paused=false;running=true;overlay.style.display='none';window.dispatchEvent(new CustomEvent(resumeFromSave?'bonbon:start':'bonbon:resume'));resumeFromSave=false;}else startPlaying();}else updateCountdown();}
 else if(phase==='timeup'&&phaseTime>=timeupDuration)setPhase('outro');
 else if(phase==='outro'&&phaseTime>=outroDuration)showResults();
 else if((phase==='returning'||phase==='exiting')&&phaseTime>=launchDuration){showHome();exitSnapshot=null;}
 else if(phase==='resuming'&&phaseTime>=launchDuration){running=true;paused=true;resumeFromSave=true;showCountdown(true);}
 else if(phase==='results'){const u=Math.min(1,phaseTime/.7);document.querySelector('#result-score').textContent=Math.round(game.score*(1-Math.pow(1-u,3))).toLocaleString();}
}

document.querySelector('#exit').onclick=exitToHome;
bindHome();document.querySelector('#closeRanking').onclick=()=>document.querySelector('#leaderboard').close();
function showHelp(){if(ready)document.querySelector('#rules').showModal();}document.querySelector('#closeRules').onclick=()=>document.querySelector('#rules').close();
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveRun();});

window.BonbonKitchen={version:'1.5.0',start:begin,getState:()=>game.snapshot(),getSession:()=>({ready,running,paused,phase}),performAction:action=>{if(!action)return false;const h=hits.find(h=>h.kind===action.kind&&(h.kind==='pot'||h.kind==='storage'?h.i===action.i:h.kind==='ingredient'||h.kind==='instant'?h.value===action.value:false));return h?interact(h):false;}};
function frame(now){const dt=Math.max(0,(now-last)/1000),step=Math.min(dt,.1),wasRunning=running;last=now;for(const p of pressEffects)p.t+=dt;pressEffects=pressEffects.filter(p=>p.t<p.duration);advancePresentation(Math.min(dt,.25));if(!document.hidden&&((wasRunning&&running&&!paused)||phase==='timeup'||phase==='outro')){scorePulse+=step;for(const list of [trashEffects,deliveryFlights,completedOrders,pourEffects]){for(const f of list){const before=f.t;f.t+=step;if(f.order){f.order.age+=step;if(before<1.42&&f.t>=1.42)scorePulse=0;}}for(let i=list.length-1;i>=0;i--)if(list[i].t>=list[i].duration)list.splice(i,1);}if(wasRunning&&running&&!paused){const old=game.pots.map(p=>p.state),before=game.elapsed;game.tick(step);for(let i=3;i<6;i++){if(old[i]==='cooking'&&game.pots[i].state==='ready')kitchenSound.play('beef_cooked');if(old[i]!=='burnt'&&game.pots[i].state==='burnt')kitchenSound.play('beef_burnt');}if(before<BonbonRules.frenzyAt&&game.elapsed>=BonbonRules.frenzyAt){cookingFX.triggerBonbon();kitchenSound.play('bonbon_time');}if(game.elapsed>=BonbonRules.duration-5&&game.elapsed<BonbonRules.duration&&Math.floor(before)!==Math.floor(game.elapsed))kitchenSound.play('last_5_sec');cookingFX.update(step,game.pots);orderReveal=Math.min(.35,orderReveal+step);if(game.ended)end();}}if(!document.hidden)BonbonCelebration.update(step);BonbonCelebration.setOpacity(phase==='launch'||phase==='returning'?1-smooth(phaseTime/launchDuration):1);kitchenSound.update({sound,active:running&&!paused&&phase==='playing',pots:game.pots,hidden:document.hidden});render(now);BonbonCelebration.render();requestAnimationFrame(frame);}
function animateButton(button){for(const animation of button.getAnimations())animation.cancel();button.animate([{transform:'scale(1)',filter:'brightness(1)'},{transform:'scale(1.09)',filter:'brightness(.7)',offset:.4},{transform:'scale(1)',filter:'brightness(1)'}],{duration:280,easing:'ease-in-out'});}
document.addEventListener('pointerdown',e=>{const button=e.target.closest('button');if(button&&!button.disabled){kitchenSound.unlock();beep();animateButton(button);}},true);
document.addEventListener('keydown',e=>{if(window.BonbonSettings?.hasKey(e))return;if((e.code==='Enter'||e.code==='Space')&&e.target.matches('button')&&!e.repeat){kitchenSound.unlock();beep();animateButton(e.target);}},true);
async function load(){
 try{
  assets=await(await fetch('assets/sprites.json')).json();
  const dishParts=await(await fetch('assets/fx/dish-parts.json')).json();
  const generated=await(await fetch('assets/fx/generated/manifest-v1.json')).json();
  const movies=await(await fetch('assets/effects/runtime/manifest.json')).json();
  for(const [key,a] of Object.entries(assets))byId[Number(key.split('_')[0])]=a;
  await Promise.all([
   ...Object.values(movies.dishes).map(a=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[a.src]=im;resolve();};im.onerror=reject;im.src=a.src;})),
   document.fonts.load('84px HuakangPOP','0123456789:'),
   document.fonts.load('100px IdentityV','时间到！金牌厨师再来一局'),
   ...['ending_background','heart','button','ranking','fire','bell','correct'].map(name=>new Promise((resolve,reject)=>{const im=new Image(),src=`assets/${name}.png`;im.onload=()=>{images[src]=im;resolve();};im.onerror=reject;im.src=src;})),
   ...['flame_atlas','steam_atlas','water'].map(name=>new Promise((resolve,reject)=>{const im=new Image(),src=`assets/fx/${name}.png`;im.onload=()=>{images[src]=im;resolve();};im.onerror=reject;im.src=src;})),
   ...Object.values(dishParts).map(a=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[a.src]=im;resolve();};im.onerror=reject;im.src=a.src;})),
   ...[generated.ingredients,generated.thermal,generated.bases].map(a=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[a.src]=im;resolve();};im.onerror=reject;im.src=a.src;})),
   ...Object.values(assets).map(a=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[a.src]=im;resolve();};im.onerror=reject;im.src=a.src;}))
  ]);
  cookingFX=BonbonCookingFX.create({ctx,layers:byId,images,potLayers,dishParts,generated,movies,draw:id=>draw(id)});cookingFX.reset(game.pots);fitRenderSurface();ready=true;last=performance.now();requestAnimationFrame(frame);
 }catch(e){console.error('Asset loading failed',e);document.querySelector('#start').disabled=true;}
}
load();
