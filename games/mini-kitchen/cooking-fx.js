/* Presentation only: reusable raster brushes + supplied PSD food pieces.
   All movement uses the game clock, so pause/save never advances cooking. */
(function(root){
 'use strict';
 const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{const u=clamp(n);return u*u*(3-2*u);};
 // One gravity in design pixels/s² for both vegetables and steak. No easing
 // during flight: y=y0+0.5*g*t² until contact; settling starts only afterwards.
 const gravity=2200;
 function freeFall(height,time){
  const duration=Math.sqrt(2*height/gravity),t=Math.max(0,Math.min(time,duration));
  return {offset:time>=duration?0:-height+.5*gravity*t*t,duration,landTime:time-duration,progress:duration?clamp(t/duration):1};
 }
 function create({ctx,layers,images,potLayers,draw,dishParts={},generated=null,movies=null}){
  let bonbonTime=null;
  let clock=0,observed=[],transitions=Array(6).fill(null),inputs=Array(6).fill(null);
  const cleaned=new Map(),vegetables=new Set(['corn','carrot','potato','tomato']);
  for(const [id,recipe] of Object.entries(dishParts)){
   const a=layers[id],canvas=document.createElement('canvas');[canvas.width,canvas.height]=recipe.size;
   const c=canvas.getContext('2d'),patch=recipe.patch;
   c.drawImage(images[a.src],0,0);c.clearRect(...patch.box);c.drawImage(images[recipe.src],...patch.rect,...patch.box);cleaned.set(Number(id),canvas);
  }
  const fx=name=>images[`assets/fx/${name}.png`];
  const suppliedFire=images['assets/fire.png'];
  let fireBrush=null,fireTongue=null;
  if(suppliedFire){
   fireBrush=document.createElement('canvas');fireBrush.width=640;fireBrush.height=280;
   const c=fireBrush.getContext('2d',{willReadFrequently:true});
   // Use the upward tongues only, not the lower arc of the source ring.
   // Keeping their aspect ratio avoids the former flat luminous rim.
   c.drawImage(suppliedFire,220,275,1600,700,0,0,640,280);
   const pixels=c.getImageData(0,0,640,280),d=pixels.data;
   for(let j=0;j<d.length;j+=4){const a=Math.max(0,(Math.max(d[j],d[j+1],d[j+2])-12)/243);
    if(a<=0){d[j]=d[j+1]=d[j+2]=d[j+3]=0;continue;}
    for(let k=0;k<3;k++)d[j+k]=Math.min(255,Math.max(0,d[j+k]-12)/a);
    const x=(j/4)%640,y=Math.floor(j/4/640),edge=Math.min(1,x/18,(639-x)/18,(279-y)/42);
    d[j+3]=Math.round(a*255*Math.max(0,edge));
   }c.putImageData(pixels,0,0);
   fireTongue=document.createElement('canvas');fireTongue.width=160;fireTongue.height=240;
   const tc=fireTongue.getContext('2d');tc.drawImage(fireBrush,225,0,190,240,0,0,160,240);
   const tonguePixels=tc.getImageData(0,0,160,240),td=tonguePixels.data;
   for(let j=0;j<td.length;j+=4){const x=(j/4)%160,y=Math.floor(j/4/160);td[j+3]*=Math.max(0,Math.min(1,x/22,(159-x)/22,(239-y)/48));}
   tc.putImageData(tonguePixels,0,0);
  }
  // Feather the water itself, rather than exposing the rectangular texture or
  // a hard ellipse where it meets the inside of the crock.
  const softWater=document.createElement('canvas');softWater.width=256;softWater.height=160;
  {const c=softWater.getContext('2d');c.drawImage(fx('water'),0,0,256,160);c.globalCompositeOperation='destination-in';
   c.save();c.translate(128,80);c.scale(128,80);const mask=c.createRadialGradient(0,0,.78,0,0,1);
   mask.addColorStop(0,'#fff');mask.addColorStop(.5,'rgba(255,255,255,.82)');mask.addColorStop(1,'rgba(255,255,255,0)');
   c.fillStyle=mask;c.fillRect(-1,-1,2,2);c.restore();}
  const geometry=potLayers.map((m,i)=>{
   const a=layers[m.cooking],b=a.box,w=b[2]-b[0],h=b[3]-b[1],base=layers[m.empty],cb=base.contentBox;
   return i<3?{x:b[0]+w*.49,y:b[1]+h*.37,rx:w*.277,ry:h*.159,bottom:base.box[1]+cb[1]+cb[3]-15,fireWidth:cb[2]+55}:
    {x:b[0]+w*.5,y:b[1]+h*.5,rx:w*.51,ry:h*.48,bottom:base.box[1]+cb[1]+cb[3]-20,fireWidth:cb[2]*.92};
  });
  // Generated clean broth/sauce replaces the old inpainted interior, while the
  // original PSD crock, rim and handle stay fixed and retain their occlusion.
  if(generated)for(const [key,recipe] of Object.entries(dishParts)){
   const baseIndex=generated.baseIndex[recipe.dish];if(baseIndex===undefined)continue;
   const id=Number(key),i=potLayers.findIndex(m=>Object.values(m).includes(id)),g=geometry[i],a=layers[id],c=cleaned.get(id).getContext('2d');
   const x=g.x-a.box[0],y=g.y-a.box[1],rx=g.rx*.99,ry=g.ry*.99;
   c.save();c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.clip();
   c.drawImage(images[generated.bases.src],...generated.bases.rects[baseIndex],x-rx-2,y-ry-2,rx*2+4,ry*2+4);c.restore();
  }
  const copy=p=>({state:p.state,dish:p.dish});
  const key=p=>`${p.state}:${p.dish}`;
  const idFor=(i,p)=>p.state==='empty'?potLayers[i].empty:p.state==='burnt'?(i<3?potLayers[i][p.dish||'soup']:potLayers[i].burnt):potLayers[i][p.state==='cooking'?'cooking':p.dish];
  function reset(pots){bonbonTime=null;clock=0;observed=pots.map(copy);transitions=Array(6).fill(null);inputs=Array(6).fill(null);}
  function sync(pots){pots.forEach((p,i)=>{
   const old=observed[i]||copy(p);
   if(key(old)!==key(p)){
    if(p.state==='empty'){transitions[i]=null;inputs[i]=null;}
    else if(!(i<3&&p.state==='burnt'))transitions[i]={from:old,to:copy(p),t:0,duration:inputs[i]&&inputs[i].t<.05?1.05:p.state==='burnt'?1:.72};
    observed[i]=copy(p);
   }
  });}
  function add(i,ingredient){inputs[i]={ingredient,t:0,duration:ingredient==='water'?1.45:vegetables.has(ingredient)?1.2:1.05};}
  function update(dt,pots){clock+=dt;if(bonbonTime!==null){bonbonTime+=dt;if(bonbonTime>=3.2)bonbonTime=null;}for(const list of [inputs,transitions])for(let i=0;i<6;i++){const e=list[i];if(e){e.t+=dt;if(e.t>=e.duration)list[i]=null;}}sync(pots);}
  function clipSurface(i,scale=1){const g=geometry[i];ctx.beginPath();ctx.ellipse(g.x,g.y,g.rx*scale,g.ry*scale,0,0,Math.PI*2);ctx.clip();}
  function fire(i){
   if(fireBrush){
    const g=geometry[i],phase=clock*3.6+i*1.73,width=g.fireWidth*.82,height=width*.38,base=g.bottom+10;
    ctx.save();const alpha=ctx.globalAlpha;ctx.globalAlpha=alpha*.38;
    // Contiguous narrow slices ripple the supplied brush while keeping the
    // root attached to the burner. No frame switching or random flickering.
    const strips=32,sw=fireBrush.width/strips,dw=width/strips;
    for(let j=0;j<strips;j++){
     const u=j/(strips-1),wave=Math.sin(phase+u*7.5)*.025+Math.sin(phase*1.63-u*11)*.013;
     const h=height*(1+wave),x=g.x-width/2+j*dw;
     ctx.drawImage(fireBrush,j*sw,0,sw,fireBrush.height,x,base-h,dw+.7,h);
    }
    // Individual tongues grow from fixed burner roots, lean as they rise,
    // then narrow and disappear. Different lifetimes prevent a common pulse.
    for(let j=0;j<6;j++){
     const side=j<3?-1:1,k=j%3,life=.56+k*.13+(i%2)*.05;
     const u=(clock/life+j*.371+i*.193)%1,envelope=Math.pow(Math.sin(Math.PI*u),.8);
     const rootX=g.x+side*width*(.36+k*.045),rootY=g.bottom+10-k*2;
     const h=(78+k*18)*(width/460)*(.48+envelope*.7),w=(48-k*5)*(width/460)*(1-u*.36);
     ctx.globalAlpha=alpha*envelope*.88;
     const bands=16,sh=fireTongue.height/bands;
     for(let band=0;band<bands;band++){
      const v=1-band/bands,bend=Math.sin(phase*1.7+j*2.4-v*3.1)*h*.095*v*v;
      const drift=side*u*h*.09*v;
      ctx.drawImage(fireTongue,0,band*sh,160,sh,rootX-w/2+bend+drift,rootY-h+band*h/bands,w,h/bands+.55);
     }
    }
    ctx.restore();return;
   }
   if(generated){
    const g=geometry[i],t=(clock*9+i*1.7)%8,index=Math.floor(t),mix=t-index,alpha=ctx.globalAlpha,width=g.fireWidth*.88;
    ctx.save();for(const [frame,weight] of [[index,1-mix],[(index+1)%8,mix]]){ctx.globalAlpha=alpha*weight*.86;ctx.drawImage(images[generated.thermal.src],...generated.thermal.rects[frame],g.x-width/2,g.bottom-106,width,140);}ctx.restore();return;
   }
   const g=geometry[i],atlas=fx('flame_atlas'),frame=(clock*10+i*1.7)%8,a=Math.floor(frame),b=(a+1)%8,mix=frame-a;
   ctx.save();const alpha=ctx.globalAlpha;
   for(const [f,opacity] of [[a,1-mix],[b,mix]]){ctx.globalAlpha=alpha*opacity;ctx.drawImage(atlas,f*256,0,256,144,g.x-g.fireWidth*.43,g.bottom-67,g.fireWidth*.86,105);}
   ctx.restore();
  }
  const vapor=document.createElement('canvas');vapor.width=192;vapor.height=192;
  {const c=vapor.getContext('2d'),gradient=c.createRadialGradient(96,96,0,96,96,96);
   gradient.addColorStop(0,'rgba(255,246,228,.7)');gradient.addColorStop(.4,'rgba(255,246,228,.4)');gradient.addColorStop(1,'rgba(255,246,228,0)');c.fillStyle=gradient;c.fillRect(0,0,192,192);}
  function steam(i,p){
   const g=geometry[i],soup=i<3,count=soup?7:5;
   ctx.save();const alpha=ctx.globalAlpha;
   for(let j=0;j<count;j++){
    const u=(clock/(soup?3.1:2.3)+j/count+i*.137)%1;
    const w=(soup?145:105)+u*(soup?160:95),h=w*(soup?1.3:1.05);
    const x=g.x+Math.sin(j*2.4+i)*g.rx*.4+Math.sin(clock*.8+j)*16,y=g.y-12-u*(soup?215:155);
    ctx.globalAlpha=alpha*Math.sin(Math.PI*u)*(soup?.24:.26)*(p.state==='cooking'?.85:1);
    ctx.drawImage(vapor,x-w/2,y-h*.7,w,h);
   }ctx.restore();
  }
  function triggerBonbon(){bonbonTime=0;}
  function celebration(){
   if(bonbonTime===null)return;
   const t=bonbonTime,enter=ease(t/.45),exit=1-ease((t-1.6)/.65);
   ctx.save();
   // Broad overlapping feathered vapor rolls in from the screen edges.
   const cloud=ease((t-.08)/.42)*(1-ease((t-1.8)/1.4));
   for(let j=0;j<28;j++){
    const side=j%4,u=ease((t-.18-(j%7)*.015)/1.35),along=(Math.floor(j/4)+.5)/7;
    let x,y;if(side===0){x=2351-u*3000;y=1080+(along-.5)*(600+u*1900);}else if(side===1){x=2351+u*3000;y=1080+(along-.5)*(600+u*1900);}else if(side===2){x=2351+(along-.5)*(700+u*4300);y=1080-u*1600;}else{x=2351+(along-.5)*(700+u*4300);y=1080+u*1600;}
    const size=1250+Math.sin(j*2.7)*240;ctx.globalAlpha=cloud*.24;ctx.drawImage(vapor,x-size/2,y-size/2,size,size);
   }
   const im=images['assets/bell.png'];
   if(im&&exit>0){
    ctx.globalAlpha=enter*exit;const glow=ctx.createRadialGradient(2351,1100,20,2351,1100,760);glow.addColorStop(0,'rgba(255,197,68,.25)');glow.addColorStop(1,'rgba(255,197,68,0)');ctx.fillStyle=glow;ctx.fillRect(1550,300,1600,1600);
    ctx.translate(2351,710+22*(1-enter));ctx.rotate(.52+Math.sin(t*21)*.24*(1-ease((t-1.3)/.6)));ctx.scale(.93+.07*enter,.93+.07*enter);
    ctx.drawImage(im,-280,-100,560,964);
   }ctx.restore();
  }
  function layerBlend(i,from,to,u){
   const old=idFor(i,from),next=idFor(i,to);paintFrame(old,i);
   ctx.save();ctx.globalAlpha*=ease(u);paintFrame(next,i);ctx.restore();
  }
  function drawClean(id){const a=layers[id],im=cleaned.get(id);if(im)ctx.drawImage(im,a.box[0],a.box[1]);else draw(id);}
  function poses(id,i,{input=null,still=false,rise=0}={}){
   const recipe=dishParts[id],a=layers[id];if(!recipe)return[];
   return recipe.parts.map((part,index)=>{
    const [x,y,w,h]=part.box,bob=still?0:Math.sin(clock*1.55+part.phase+i*.6)*part.amplitude;
    let dy=bob+rise,dx=still?0:Math.sin(clock*.9+part.phase)*(i<3?.35:.08),angle=0,alpha=1,edgeMix=1;
    if(input){
     const local=input.t-part.delay,startBottom=geometry[i].y-geometry[i].rx*.68,height=Math.max(35,a.box[1]+y+h-startBottom),fall=freeFall(height,local),u=fall.progress,land=fall.landTime;
     if(local<0)alpha=0;
     else alpha=clamp(local/.055);
     dy=fall.offset+bob*ease(land/.25);
     edgeMix=ease((land+.025)/.12);
     dx*=ease(land/.25);angle=(1-u)*Math.sin(part.phase+.8)*.055;
     if(land>0&&land<.24)dy+=Math.sin(land/.24*Math.PI)*1.6;
    }
    return {name:part.name,modelIndex:generated?.mapping[recipe.dish]?.[part.name],rect:part.rect,flightRect:part.flightRect,edgeMix,x:a.box[0]+x+dx,y:a.box[1]+y+dy,w,h,angle,alpha,
     targetX:a.box[0]+x,targetY:a.box[1]+y};
   });
  }
  function paintParts(id,i,options){
   const recipe=dishParts[id];if(!recipe)return;
   for(const p of poses(id,i,options)){
    if(p.alpha<=0)continue;ctx.save();ctx.globalAlpha*=p.alpha;
    ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.rotate(p.angle);
    if(p.modelIndex!==undefined){
     const rect=generated.ingredients.rects[p.modelIndex],scale=Math.min(p.w*.88/rect[2],p.h*.88/rect[3]),w=rect[2]*scale,h=rect[3]*scale;
     ctx.drawImage(images[generated.ingredients.src],...rect,-w/2,-h/2,w,h);ctx.restore();continue;
    }
    if(p.edgeMix<1&&p.flightRect)ctx.drawImage(images[recipe.src],...p.flightRect,-p.w/2,-p.h/2,p.w,p.h);
    if(p.edgeMix>0){ctx.globalAlpha*=p.edgeMix;ctx.drawImage(images[recipe.src],...p.rect,-p.w/2,-p.h/2,p.w,p.h);}ctx.restore();
   }
  }
  function paintFrame(id,i,options){if(!dishParts[id]||movies?.dishes[dishParts[id].dish]){draw(id);return;}drawClean(id);paintParts(id,i,options);}
  const movieDishes={corn:'corn_soup',carrot:'carrot_soup',tomato:'tomato_beef',potato:'potato_beef'};
  function movieFrame(i,p=observed[i]){
   const e=inputs[i],dish=movieDishes[e?.ingredient],clip=movies?.dishes[dish];
   if(!clip||!p||p.state!=='ready'||p.dish!==dish||e.t>=clip.duration)return null;
   const target=clip.targets[i],u=ease(e.t/clip.duration);
   if(!target)return null;
   const anchor=clip.firstAnchor.map((v,j)=>v+(clip.lastAnchor[j]-v)*u);
   const box=target.first.map((v,j)=>v+(target.last[j]-v)*u);
   const sx=box[2]/anchor[2],sy=box[3]/anchor[3],crop=clip.crop;
   return {clip,frame:Math.min(clip.frames.length-1,Math.floor(e.t*clip.fps)),
    dest:[box[0]+(crop[0]-anchor[0])*sx,box[1]+(crop[1]-anchor[1])*sy,(crop[2]-crop[0])*sx,(crop[3]-crop[1])*sy],
    finish:ease((e.t-(clip.duration-.12))/.12)};
  }
  function paintMovie(i,p,m){
   ctx.save();
   ctx.globalAlpha*=1-m.finish;ctx.drawImage(images[m.clip.src],...m.clip.frames[m.frame],...m.dest);ctx.restore();
   if(m.finish>0){ctx.save();ctx.globalAlpha*=m.finish;draw(idFor(i,p));ctx.restore();}
  }
  function water(i,e,p){
   const g=geometry[i],fill=ease((e.t-.15)/.65),float=ease((e.t-.72)/.55);
   // The crock stays still; only its interior fills and its original vegetables emerge.
   draw(potLayers[i].empty);ctx.save();clipSurface(i,1.03);
   const w=g.rx*2*(.45+.55*fill),h=g.ry*2*(.48+.52*fill),cy=g.y+g.ry*.63*(1-fill);
   ctx.globalAlpha*=ease(e.t/.12)*.82;ctx.drawImage(softWater,g.x-w/2,cy-h/2,w,h);
   ctx.restore();
   if(float>0){ctx.save();ctx.globalAlpha*=float;paintFrame(potLayers[i].cooking,i,{rise:(1-float)*12});ctx.restore();}
   if(p.state==='ready'&&e.t>.85){ctx.save();ctx.globalAlpha*=ease((e.t-.85)/.45);paintFrame(potLayers[i][p.dish],i);ctx.restore();}
  }
  function pot(i,p){
   const movie=movieFrame(i,p);if(movie){paintMovie(i,p,movie);return;}
   if(movies?.dishes[p.dish]&&p.state==='ready'){draw(idFor(i,p));return;}
   if(i<3&&p.state==='burnt'){draw(idFor(i,p));return;}
   if(i<3&&p.dish==='soup'&&p.state==='ready'&&!transitions[i]){
    const id=idFor(i,p),a=layers[id],g=geometry[i];draw(id);
    ctx.save();clipSurface(i,.88);ctx.drawImage(images[a.src],a.box[0]+Math.sin(clock*1.2+i)*1.7,a.box[1]+Math.sin(clock*1.8+i)*2.5);ctx.restore();return;
   }
   const e=inputs[i],tr=transitions[i];
   const id=idFor(i,p);
   if(e&&vegetables.has(e.ingredient)&&dishParts[id]){
    // Only the clean liquid/sauce blends. The final ingredients arrive separately
    // at their exact original coordinates and stay there instead of disappearing.
    if(e.t<.78&&tr){paintFrame(idFor(i,tr.from),i);ctx.save();ctx.globalAlpha*=ease((e.t-.4)/.38);drawClean(id);ctx.restore();}
    else drawClean(id);
    return;
   }
   if(i<3&&e?.ingredient==='water'){water(i,e,p);return;}
   if(i>=3&&p.state!=='burnt'&&e?.ingredient==='raw_beef'){
    const fall=freeFall(125,e.t);
    if(fall.landTime<0){const g=geometry[i];ctx.save();ctx.globalAlpha*=clamp(e.t/.055);ctx.translate(g.x,g.y+fall.offset);ctx.rotate((1-fall.progress)*-.07);ctx.translate(-g.x,-g.y);draw(potLayers[i].cooking);ctx.restore();}
    else if(p.state==='cooking')draw(potLayers[i].cooking);else layerBlend(i,{state:'cooking',dish:'beef'},p,fall.landTime/.5);
    return;
   }
   if(tr){
    const delay=e&&e.ingredient!=='raw_beef'?.3:0;
    layerBlend(i,tr.from,tr.to,(tr.t-delay)/(tr.duration-delay));
   }else paintFrame(id,i);
  }
  function surface(i,p){
   if(movieFrame(i,p))return;
   if(i>=3||p.state==='burnt')return;
   const g=geometry[i],input=inputs[i];if(input?.ingredient==='water'&&input.t<.75)return;
   ctx.save();clipSurface(i,.91);ctx.lineWidth=1.35;
   for(let j=0;j<2;j++){
    const u=(clock*.62+j*.51+i*.23)%1;
    ctx.strokeStyle=`rgba(255,237,185,${Math.sin(Math.PI*u)*.15})`;ctx.beginPath();
    ctx.ellipse(g.x+(j?-.3:.3)*g.rx,g.y+(j?-.1:.28)*g.ry,8+u*19,3+u*6,0,0,Math.PI*2);ctx.stroke();
   }
   ctx.restore();
  }
  function falling(i,p=observed[i]){
   if(movies?.dishes[p?.dish])return;
   const e=inputs[i];if(!e||!vegetables.has(e.ingredient)||!p)return;
   ctx.save();
   paintParts(idFor(i,p),i,{input:e});ctx.restore();
  }
  function serialize(){return JSON.parse(JSON.stringify({version:1,clock,transitions,inputs,bonbonTime}));}
  function restore(saved,pots){reset(pots);if(saved?.version!==1)return;
   if(Number.isFinite(saved.bonbonTime)&&saved.bonbonTime>=0&&saved.bonbonTime<3.2)bonbonTime=saved.bonbonTime;
   if(Number.isFinite(saved.clock)&&saved.clock>=0)clock=saved.clock;
   const state=p=>p&&['empty','cooking','ready','burnt'].includes(p.state)&&(p.dish===null||['soup','corn_soup','carrot_soup','beef','tomato_beef','potato_beef'].includes(p.dish));
   for(let i=0;i<6;i++){
    const t=saved.transitions?.[i],e=saved.inputs?.[i];
    if(t&&state(t.from)&&state(t.to)&&Number.isFinite(t.t)&&t.t>=0&&t.t<t.duration&&t.duration<=1.1)transitions[i]=JSON.parse(JSON.stringify(t));
    if(e&&['water','raw_beef','corn','carrot','potato','tomato'].includes(e.ingredient)&&Number.isFinite(e.t)&&e.t>=0&&e.t<e.duration&&e.duration<=1.5)inputs[i]={...e};
   }
  }
  return {geometry,reset,sync,add,update,pot,fire,steam,surface,falling,serialize,restore,movieFrame,triggerBonbon,celebration,
   partPoses:(i,p,{still=false,assembled=false}={})=>poses(idFor(i,p),i,{still,input:!assembled&&vegetables.has(inputs[i]?.ingredient)?inputs[i]:null}),
   paintAssembled:(i,p)=>paintFrame(idFor(i,p),i,{still:true}),get clock(){return clock;}};
 }
 root.BonbonCookingFX={create,freeFall,gravity};
})(globalThis);
