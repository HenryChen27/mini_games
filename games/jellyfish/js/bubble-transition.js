const BubbleTransition = (() => {
  function create(start,width,height,duration,count,sprite) {
    const bubbles=Array.from({length:count},(_,i)=>{
      const front=i<28,diameter=front?260+Math.random()*620:24+Math.pow(Math.random(),1.6)*190;
      const delay=Math.random()*(front?220:320);
      const life=front?780+Math.random()*280:750+Math.random()*(duration-delay-750);
      return {diameter,delay,life,x:Math.random()*width,phase:Math.random()*Math.PI*2,
        alpha:front?.25+Math.random()*.45:.12+Math.random()*.43,
        initialSpeed:.12+Math.random()*.14,
        angle:Math.random()*Math.PI*2,spin:(Math.random()-.5)*.22,
        aspectX:.94+Math.random()*.12,aspectY:.94+Math.random()*.12,
        wobble:1.5+Math.random()*4,frequency:2+Math.random()*2};
    }).sort((a,b)=>a.diameter-b.diameter);
    return {start,width,height,duration,bubbles,sprite};
  }
  function draw(ctx,transition,time) {
    if(!transition.sprite)return;
    ctx.save();ctx.globalCompositeOperation='source-over';
    for(const b of transition.bubbles) {
      const t=(time-transition.start-b.delay)/b.life;if(t<0||t>1)continue;
      const d=b.diameter;
      // s = v0*t + 1/2*a*t², normalised to reach the same exit at t=1.
      const distance=b.initialSpeed*t+(1-b.initialSpeed)*t*t;
      const y=transition.height+d*.55-(transition.height+d*1.6)*distance;
      const x=b.x;
      const wobble=Math.sin(t*Math.PI*2*b.frequency+b.phase);
      ctx.save();ctx.translate(x,y);ctx.rotate(b.angle+b.spin*t+wobble*.018);
      ctx.scale(b.aspectX*(1+wobble*.012),b.aspectY*(1-wobble*.012));
      ctx.globalAlpha=b.alpha*Math.min(1,t*14,(1-t)*9);
      ctx.drawImage(transition.sprite,-d/2,-d/2,d,d);
      ctx.restore();
    }
    ctx.restore();
  }
  return {create,draw};
})();
