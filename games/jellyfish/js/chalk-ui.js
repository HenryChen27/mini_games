// Port the fine grain, feathered alpha edges and palette of jysj/theme.py
// to native canvas textures. The game sprite assets remain untouched.
const ChalkUI = (() => {
  function texture(width,height,palette,roughness=0.7,shape='rect',opacity=235) {
    const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    const image=ctx.createImageData(w,h);let seed=23;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      let edge=Math.min(x,w-1-x,y,h-1-y);
      if(shape==='circle')edge=Math.min(w,h)/2-.5-Math.hypot(x-(w-1)/2,y-(h-1)/2);
      if(shape==='rounded') {
        const dx=Math.max(8-x,x-(w-9),0),dy=Math.max(8-y,y-(h-9),0);
        edge=Math.min(edge,8-Math.hypot(dx,dy));
      }
      const noise=Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
      const feather=Math.max(0,Math.min(1,(edge-random()*5*roughness)/(9*roughness)));
      const gradient=8*(1-y/Math.max(1,h-1))+5*Math.sin(x/Math.max(1,w-1)*Math.PI)-5;
      const i=(y*w+x)*4;
      for(let channel=0;channel<3;channel++)image.data[i+channel]=palette[channel]+noise*6+gradient;
      image.data[i+3]=Math.max(0,Math.min(255,(opacity+noise*8)*feather));
    }
    ctx.putImageData(image,0,0);return canvas;
  }
  function install() {
    const root=document.documentElement;
    const set=(name,canvas)=>root.style.setProperty(name,`url("${canvas.toDataURL()}")`);
    set('--chalk-panel',texture(290,300,[16,29,40],.7,'rounded',246));
    set('--chalk-track',texture(240,10,[35,54,70],.6));
    set('--chalk-fill',texture(240,10,[158,181,197],.6,'rect',210));
    set('--chalk-knob',texture(21,21,[190,209,219],.5,'circle'));
    set('--chalk-button',texture(242,39,[158,181,197],.7,'rounded',210));
    set('--chalk-button-hover',texture(242,39,[190,209,219],.7,'rounded'));
    const canvas=document.getElementById('settingsGear'),ctx=canvas.getContext('2d');
    const center=texture(14,14,[35,54,70],.2,'circle');
    function gear(hover) {
      ctx.clearRect(0,0,92,92);
      ctx.save();ctx.translate(46,46);ctx.beginPath();
      for(let i=0;i<64;i++) {
        const angle=2*Math.PI*i/64,r=i%8>=1&&i%8<=4?30:23.2;
        if(i===0)ctx.moveTo(r*Math.cos(angle),r*Math.sin(angle));else ctx.lineTo(r*Math.cos(angle),r*Math.sin(angle));
      }
      ctx.closePath();
      const gradient=ctx.createLinearGradient(0,-30,0,30);
      gradient.addColorStop(0,hover?'#e0eaf0':'#c3d3de');
      gradient.addColorStop(1,hover?'#b5c8d5':'#a9becd');
      ctx.fillStyle=gradient;ctx.fill();
      ctx.globalCompositeOperation='destination-out';
      ctx.drawImage(center,-14,-14,28,28);ctx.restore();
    }
    gear(false);
    const toggle=document.getElementById('settingsToggle');
    toggle.addEventListener('pointerenter',()=>gear(true));
    toggle.addEventListener('pointerleave',()=>gear(false));
    toggle.addEventListener('focus',()=>gear(true));
    toggle.addEventListener('blur',()=>gear(false));
  }
  return {install};
})();
