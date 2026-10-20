/* Canvas ribbons: a center burst at time-up and continuous falling ribbons at results. */
(function(root){
 const canvas=document.querySelector('#confetti'),ctx=canvas.getContext('2d');
 const colors=['#f07192','#6ccce3','#eacf53','#91b967','#b29ada','#e69153','#e5d8aa'];
 let width=0,height=0,particles=[],falling=false,accumulator=0;
 function resize(){const ratio=Math.min(2,devicePixelRatio||1);width=innerWidth;height=innerHeight;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);}
 function particle(mode,scattered=false){const angle=Math.random()*Math.PI*2,speed=230+Math.random()*550;return{mode,x:mode==='burst'?width/2:Math.random()*width,y:mode==='burst'?height*.49:scattered?Math.random()*height:-50-Math.random()*70,vx:mode==='burst'?Math.cos(angle)*speed:(Math.random()-.5)*35,vy:mode==='burst'?Math.sin(angle)*speed*.8:50+Math.random()*85,w:5+Math.random()*7,h:22+Math.random()*32,angle:Math.random()*Math.PI*2,spin:(Math.random()-.5)*5,seed:Math.random()*6.28,color:colors[Math.floor(Math.random()*colors.length)],age:0,life:mode==='burst'?4+Math.random()*2:25};}
 function burst(){for(let i=0;i<125;i++)particles.push(particle('burst'));}
 function setFalling(value){if(value&&!falling)for(let i=0;i<40;i++)particles.push(particle('fall',true));falling=value;accumulator=0;}
 function clear(){particles=[];falling=false;accumulator=0;ctx.clearRect(0,0,width,height);}
 function update(dt){
  if(falling){accumulator+=dt*8.6;while(accumulator>=1){particles.push(particle('fall'));accumulator--;}}
  for(const p of particles){p.age+=dt;if(p.mode==='burst'){p.vx*=Math.exp(-dt*.7);p.vy+=215*dt;}p.x+=(p.vx+Math.sin(p.age*2+p.seed)*(p.mode==='fall'?17:5))*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;}
  particles=particles.filter(p=>p.age<p.life&&p.y<height+100&&p.x>-200&&p.x<width+200);
 }
 function render(){ctx.clearRect(0,0,width,height);for(const p of particles){ctx.save();ctx.globalAlpha=Math.min(1,p.age/.2,(p.life-p.age)/.9);ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.scale(Math.cos(p.age*5+p.seed)*.65+.8,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(-p.w/2,-p.h/2);ctx.quadraticCurveTo(p.w*1.7,0,p.w/2,p.h/2);ctx.lineTo(-p.w/2,p.h/2);ctx.quadraticCurveTo(p.w*.7,0,-p.w/2,-p.h/2);ctx.fill();ctx.restore();}}
 resize();addEventListener('resize',resize);
 root.BonbonCelebration={burst,setFalling,clear,update,render,setOpacity(value){canvas.style.opacity=String(value);},get count(){return particles.length;},get falling(){return falling;}};
})(globalThis);
