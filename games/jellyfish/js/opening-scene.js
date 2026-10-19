const OpeningScene = (() => {
  function draw(ctx,assets,time,opacity=1) {
    ctx.save();ctx.globalAlpha=opacity;
    const background=assets.images.backgroundStart || assets.images.background;
    if(background)ctx.drawImage(background,0,0,CONFIG.GAME_WIDTH,CONFIG.GAME_HEIGHT);
    const centerX=CONFIG.GAME_WIDTH*.51,centerY=CONFIG.GAME_HEIGHT*.43;
    const angles=[-.35,-.65,-.95,-1.3,-1.7,-2.12,-2.78,-3.45,-4.1,-4.8,-5.5];
    for(let i=0;i<11;i++) {
      const sprite=assets.images['fish'+(i+1)];if(!sprite)continue;
      const angle=angles[i]+Math.sin(time*.00035)*.015;
      const x=centerX+Math.cos(angle)*560;
      const y=centerY+Math.sin(angle)*385+Math.sin(time*.0015+i)*7;
      const def=CONFIG.JELLYFISH[i];
      ctx.save();ctx.translate(x,y);ctx.scale(.7,.7);
      const size=Math.max(def.width,def.height);
      ctx.globalAlpha=opacity*(.22+.78*Math.pow(Math.min(size/460,1),.7));
      JellyfishAnimation.draw(ctx,{level:i+1,sprite,w:def.width,h:def.height,breathPhase:i*.65},
        CONFIG.ANIM.breathing[i],time);
      ctx.restore();
    }
    ctx.restore();
  }
  function countdownLabel(elapsed) {
    const step=CONFIG.ANIM.countdownStepDuration;
    return elapsed<step*3?String(3-Math.floor(Math.max(0,elapsed)/step)):'GO!';
  }
  function drawCountdown(ctx,elapsed) {
    const step=CONFIG.ANIM.countdownStepDuration,isGo=elapsed>=step*3;
    const local=isGo?elapsed-step*3:elapsed%step;
    const duration=isGo?CONFIG.ANIM.countdownGoDuration:step;
    const arrival=Math.min(local/320,1),scale=1+1.1*Math.pow(1-arrival,3);
    const fade=Math.min(1,local/55)*Math.min(1,(duration-local)/140);
    ctx.save();ctx.translate(CONFIG.GAME_WIDTH*.51,CONFIG.GAME_HEIGHT*.43);
    ctx.scale(scale,scale);ctx.globalAlpha=Math.max(0,fade);
    ctx.font=`${isGo?160:180}px ${CONFIG.COUNTDOWN_FONT}`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor='#67edff';ctx.shadowBlur=40;ctx.fillStyle='#77efff';
    ctx.fillText(countdownLabel(elapsed),0,0);
    ctx.shadowBlur=12;ctx.fillStyle='#e4ffff';ctx.fillText(countdownLabel(elapsed),0,0);
    ctx.restore();
  }
  let revealLayer;
  // Smooth interpolation between visual keyframes, independent of upward acceleration.
  function keyframe(t,frames) {
    t=Math.max(0,Math.min(1,t));
    for(let i=1;i<frames.length;i++) {
      const [end,value]=frames[i], [start,previous]=frames[i-1];
      if(t<=end) {
        const u=(t-start)/(end-start),smooth=u*u*(3-2*u);
        return previous+(value-previous)*smooth;
      }
    }
    return frames[frames.length-1][1];
  }
  function drawReveal(ctx,assets,time,progress,t=progress) {
    const W=CONFIG.GAME_WIDTH,H=CONFIG.GAME_HEIGHT;
    // Keep a fully opaque opening underneath for the entire upward reveal.
    draw(ctx,assets,time);
    if(!assets.images.background || progress<=0)return;
    if(!revealLayer) {
      revealLayer=document.createElement('canvas');
      revealLayer.width=W;revealLayer.height=H;
    }
    const lc=revealLayer.getContext('2d');
    const top=(1-progress)*H*.45;
    const feather=H*keyframe(t,[[0,.36],[.3,.32],[.65,.16],[.88,.045],[1,0]]);
    const blur=keyframe(t,[[0,30],[.3,26],[.65,14],[.88,4],[1,0]]);
    const opacity=keyframe(t,[[0,0],[.22,.16],[.5,.55],[.78,.9],[1,1]]);
    lc.clearRect(0,0,W,H);
    lc.drawImage(assets.images.background,0,top,W,H);
    if(feather>1) {
      lc.save();lc.beginPath();lc.rect(0,top,W,feather*1.8);lc.clip();
      lc.filter=`blur(${blur}px)`;
      lc.drawImage(assets.images.background,0,top,W,H);lc.restore();
      lc.save();lc.globalCompositeOperation='destination-in';
      const mask=lc.createLinearGradient(0,top,0,top+feather);
      mask.addColorStop(0,'rgba(255,255,255,0)');
      mask.addColorStop(.3,'rgba(255,255,255,.12)');
      mask.addColorStop(.7,'rgba(255,255,255,.72)');
      mask.addColorStop(1,'rgba(255,255,255,1)');
      lc.fillStyle=mask;lc.fillRect(0,0,W,H);lc.restore();
    }
    ctx.save();ctx.globalAlpha=opacity;
    ctx.drawImage(revealLayer,0,0);ctx.restore();
  }
  return {draw,drawCountdown,countdownLabel,drawReveal};
})();
