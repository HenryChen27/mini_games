// Animate the anatomy inside each sprite, leaving the glass rim and alpha intact.
const JellyfishAnimation = (() => {
  let renderer;
  function createRenderer() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true,
      preserveDrawingBuffer: true, antialias: false });
    if (!gl) return null;
    function shader(type, source) {
      const result = gl.createShader(type);
      gl.shaderSource(result, source); gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
      return result;
    }
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
      attribute vec2 position; varying vec2 uv;
      void main() { uv=vec2((position.x+1.0)*0.5,(1.0-position.y)*0.5);
        gl_Position=vec4(position,0.0,1.0); }`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
      precision highp float;
      varying vec2 uv;
      uniform sampler2D sprite;
      uniform vec4 bell, strands;
      uniform float phase, contraction, sway, rosette;
      void main() {
        vec4 original=texture2D(sprite,uv);
        float rim=1.0-smoothstep(0.78,0.86,length((uv-0.5)*2.0));
        vec2 local=(uv-bell.xy)/bell.zw;
        float bellMask=1.0-smoothstep(0.72,1.08,length(local));
        // A short power stroke followed by a longer, gentle recovery.
        float stroke=pow(0.5+0.5*cos(phase),3.0);
        vec2 displacement=vec2(0.0);
        if(rosette>0.5) {
          displacement=(uv-bell.xy)*contraction*(stroke-0.3125)*bellMask;
          // Preview only: softly lagging radial arms; glass rim stays fixed.
          vec2 delta=uv-bell.xy;
          float angle=atan(delta.y,delta.x);
          float lag=sin(phase-length(delta)*4.0+angle*3.0);
          displacement+=vec2(-delta.y,delta.x)*0.035*lag*bellMask;
          displacement+=delta*0.018*sin(phase*2.0-length(delta)*8.0)*bellMask;
        } else {
          float base=bell.y+bell.w;
          displacement.x=(uv.x-bell.x)*contraction*stroke*bellMask;
          displacement.y=-(uv.y-base)*contraction*0.65*stroke*bellMask;
          float depth=clamp((uv.y-strands.y)/max(strands.w-strands.y,0.01),0.0,1.0);
          float widthMask=smoothstep(strands.x,strands.x+0.05,uv.x)
            *(1.0-smoothstep(strands.z-0.05,strands.z,uv.x));
          float tipMask=1.0-smoothstep(0.85,1.1,depth);
          float rootMask=smoothstep(strands.y,strands.y+0.025,uv.y);
          float trail=sin(phase-0.9-depth*1.9+(uv.x-bell.x)*2.5);
          // Roots stay attached. Tips have more amplitude and lag behind.
          displacement.x+=sway*pow(depth,1.7)*trail*widthMask*tipMask*rootMask;
          displacement.y+=sway*0.22*depth*sin(phase-1.1-depth)*widthMask*tipMask*rootMask;
        }
        vec2 source=clamp(uv+displacement*rim,0.0,1.0);
        vec4 moved=texture2D(sprite,source);
        // Move color and transparency together inside; keep the outer rim fixed.
        // Both samples are premultiplied, so transparent RGB cannot leak as dirt.
        gl_FragColor=mix(original,moved,rim);
      }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const uniforms={};
    for(const name of ['sprite','bell','strands','phase','contraction','sway','rosette'])
      uniforms[name]=gl.getUniformLocation(program,name);
    gl.uniform1i(uniforms.sprite,0);
    return { canvas, gl, uniforms, textures:new Map() };
  }
  function draw(ctx,item,profile,time=performance.now()) {
    if(item.level===1 || item.level===2) { ctx.drawImage(item.sprite,-item.w/2,-item.h/2,item.w,item.h); return; }
    if(renderer===undefined) renderer=createRenderer();
    if(!renderer) {
      ctx.drawImage(item.sprite,-item.w/2,-item.h/2,item.w,item.h);
      return;
    }
    const {canvas,gl,uniforms,textures}=renderer;
    if(canvas.width!==item.w || canvas.height!==item.h) {
      canvas.width=item.w; canvas.height=item.h;
    }
    gl.viewport(0,0,item.w,item.h);
    let texture=textures.get(item.sprite);
    if(!texture) {
      texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,item.sprite);
      textures.set(item.sprite,texture);
    } else gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.uniform4fv(uniforms.bell,profile.bell);
    gl.uniform4fv(uniforms.strands,profile.strands || [0,1,1,1]);
    gl.uniform1f(uniforms.phase,time/profile.period*Math.PI*2+(item.breathPhase || 0));
    gl.uniform1f(uniforms.contraction,profile.contraction);
    gl.uniform1f(uniforms.sway,profile.sway);
    gl.uniform1f(uniforms.rosette,profile.mode==='rosette'?1:0);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    ctx.drawImage(canvas,-item.w/2,-item.h/2,item.w,item.h);
  }
  return {draw};
})();
