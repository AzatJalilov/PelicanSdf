export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) throw new Error("WebGL2 is unavailable.");

  const vs = `#version 300 es
  in vec2 p; void main(){gl_Position=vec4(p,0,1);}`;
  const fs = `#version 300 es
  precision highp float;
  out vec4 O;
  uniform vec2 R; uniform float T,ya,pi,di;

  #define MAX 104
  #define FAR 38.0
  const float E=.001;
  float sdS(vec3 p,float r){return length(p)-r;}
  float sdB(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
  float sdC(vec3 p,vec3 a,vec3 b,float r){
    vec3 pa=p-a,ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
    return length(pa-ba*h)-r;
  }
  float sdT(vec3 p,vec3 a,vec3 b,float ra,float rb){
    vec3 ba=b-a,pa=p-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
    return length(pa-ba*h)-mix(ra,rb,h);
  }
  float tor(vec3 p,float a,float b){vec2 q=vec2(length(p.xz)-a,p.y);return length(q)-b;}
  float ring(vec3 p,float a,float b){vec2 q=vec2(length(p.xy)-a,p.z);return length(q)-b;}
  vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
  vec2 hit(vec2 a,float d,float m){return U(a,vec2(d,m));}
  float side(vec3 p){return p.x;}
  vec3 bike(vec3 p, vec2 h){
    float d=1e4;
    vec3 F=vec3(-1.42,.05,0.), B=vec3(1.38,.05,0.);
    d=min(d,ring(p-F,.57,.105)); d=min(d,ring(p-B,.57,.105));
    d=min(d,ring(p-F,.57,.055)); d=min(d,ring(p-B,.57,.055));
    d=min(d,sdC(p,vec3(-.72,.15,0),vec3(.12,1.04,0),.052));
    d=min(d,sdC(p,vec3(.12,1.04,0),vec3(1.35,.18,0),.052));
    d=min(d,sdC(p,vec3(-.72,.15,0),vec3(1.35,.18,0),.052));
    d=min(d,sdC(p,vec3(-.72,.15,0),vec3(-.38,1.13,0),.052));
    d=min(d,sdC(p,vec3(-.38,1.13,0),vec3(.12,1.04,0),.052));
    d=min(d,sdC(p,vec3(.12,1.04,0),vec3(.43,1.48,0),.045));
    d=min(d,sdC(p,vec3(.43,1.48,0),vec3(.54,1.67,0),.04));
    d=min(d,sdC(p,vec3(.28,1.68,0),vec3(.76,1.68,0),.045));
    d=min(d,sdC(p,vec3(-.72,.15,0),vec3(-.72,1.28,0),.035));
    d=min(d,sdB(p-vec3(-.72,1.32,0),vec3(.25,.06,.16)));
    d=min(d,sdC(p,vec3(-.72,.15,0),vec3(-.72,.05,.0),.095));
    d=min(d,ring(p-vec3(-.72,.15,0),.18,.035));
    d=min(d,sdC(p,vec3(-.72,.15,.0),vec3(-.92,.04,.0),.042));
    d=min(d,sdC(p,vec3(-.72,.15,.0),vec3(-.53,.30,.0),.042));
    d=min(d,sdB(p-vec3(-.98,.03,0),vec3(.16,.035,.08)));
    d=min(d,sdB(p-vec3(-.45,.33,0),vec3(.16,.035,.08)));
    h=hit(h,d,1.); return h.yyy;
  }
  vec2 map(vec3 p){
    vec2 h=vec2(1e4,0.); vec3 q=p;
    vec3 F=vec3(-1.42,.05,0.),B=vec3(1.38,.05,0.);
    h=hit(h,ring(q-F,.57,.105),1.); h=hit(h,ring(q-B,.57,.105),1.);
    h=hit(h,ring(q-F,.57,.052),2.); h=hit(h,ring(q-B,.57,.052),2.);
    h=hit(h,sdC(q,vec3(-.72,.15,0),vec3(.12,1.04,0),.052),3.);
    h=hit(h,sdC(q,vec3(.12,1.04,0),vec3(1.35,.18,0),.052),3.);
    h=hit(h,sdC(q,vec3(-.72,.15,0),vec3(1.35,.18,0),.052),3.);
    h=hit(h,sdC(q,vec3(-.72,.15,0),vec3(-.38,1.13,0),.052),3.);
    h=hit(h,sdC(q,vec3(-.38,1.13,0),vec3(.12,1.04,0),.052),3.);
    h=hit(h,sdC(q,vec3(.12,1.04,0),vec3(.43,1.48,0),.045),4.);
    h=hit(h,sdC(q,vec3(.43,1.48,0),vec3(.54,1.67,0),.04),4.);
    h=hit(h,sdC(q,vec3(.28,1.68,0),vec3(.76,1.68,0),.045),4.);
    h=hit(h,sdC(q,vec3(-.72,.15,0),vec3(-.72,1.28,0),.035),3.);
    h=hit(h,sdB(q-vec3(-.72,1.32,0),vec3(.25,.06,.16)),5.);
    h=hit(h,sdC(q,vec3(-.72,.15,0),vec3(-.72,.05,0),.095),2.);
    h=hit(h,ring(q-vec3(-.72,.15,0),.18,.035),2.);
    h=hit(h,sdC(q,vec3(-.72,.15,0),vec3(-.92,.04,0),.042),4.);
    h=hit(h,sdC(q,vec3(-.72,.15,0),vec3(-.53,.30,0),.042),4.);
    h=hit(h,sdB(q-vec3(-.98,.03,0),vec3(.16,.035,.08)),5.);
    h=hit(h,sdB(q-vec3(-.45,.33,0),vec3(.16,.035,.08)),5.);

    vec3 c=vec3(-.35,1.83,0.);
    h=hit(h,sdS(q-c,vec3(.43,.67,.34).x),10.);
    h=hit(h,sdT(q,vec3(-.25,2.20,0),vec3(.10,2.77,0),.30,.23),10.);
    h=hit(h,sdS(q-vec3(.12,2.90,0),.27),10.);
    h=hit(h,sdT(q,vec3(.08,2.88,0),vec3(.42,2.94,0),.18,.24),11.);
    h=hit(h,sdT(q,vec3(.42,2.94,0),vec3(.95,2.88,0),.24,.12),11.);
    h=hit(h,sdT(q,vec3(.20,2.76,0),vec3(.72,2.69,0),.24,.17),12.);
    h=hit(h,sdT(q,vec3(.72,2.69,0),vec3(.94,2.80,0),.17,.06),12.);
    h=hit(h,sdS(q-vec3(.19,3.03,.205),.052),13.);
    h=hit(h,sdS(q-vec3(.19,3.03,-.205),.052),13.);
    h=hit(h,sdT(q,vec3(-.52,2.05,.27),vec3(-.98,1.86,.38),.25,.12),14.);
    h=hit(h,sdT(q,vec3(-.52,2.05,-.27),vec3(-.98,1.86,-.38),.25,.12),14.);
    h=hit(h,sdT(q,vec3(-.30,1.64,.19),vec3(-.67,.82,.25),.105,.085),15.);
    h=hit(h,sdT(q,vec3(-.67,.82,.25),vec3(-.96,.05,.08),.085,.07),15.);
    h=hit(h,sdT(q,vec3(-.30,1.64,-.19),vec3(-.67,1.18,-.25),.105,.085),15.);
    h=hit(h,sdT(q,vec3(-.67,1.18,-.25),vec3(-.47,.31,-.08),.085,.07),15.);
    h=hit(h,sdS(q-vec3(-.98,.03,.08),.11),16.);
    h=hit(h,sdS(q-vec3(-.47,.32,-.08),.11),16.);
    h=hit(h,sdT(q,vec3(-.12,2.43,.19),vec3(.42,1.69,.17),.08,.06),15.);
    h=hit(h,sdT(q,vec3(-.12,2.43,-.19),vec3(.48,1.69,-.17),.08,.06),15.);
    h=hit(h,sdS(q-vec3(.46,1.69,.17),.095),16.);
    h=hit(h,sdS(q-vec3(.52,1.69,-.17),.095),16.);
    return h;
  }
  vec3 norm(vec3 p){vec2 e=vec2(E,0);return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x));}
  float shadow(vec3 ro,vec3 rd){float t=.03,r=1.;for(int i=0;i<42;i++){float d=map(ro+rd*t).x;r=min(r,12.*d/t);t+=clamp(d,.025,.22);if(d<E||t>8.)break;}return clamp(r,0.,1.);}
  vec3 mat(float m){
    if(m<1.5)return vec3(.025,.03,.04);
    if(m<2.5)return vec3(.72,.72,.65);
    if(m<3.5)return vec3(.08,.36,.57);
    if(m<5.5)return vec3(.12,.13,.15);
    if(m<10.5)return vec3(.86,.89,.78);
    if(m<12.5)return vec3(.96,.57,.16);
    if(m<13.5)return vec3(.025,.025,.018);
    if(m<14.5)return vec3(.34,.43,.38);
    if(m<15.5)return vec3(.94,.72,.36);
    return vec3(.13,.10,.06);
  }
  void main(){
    vec2 uv=(2.*gl_FragCoord.xy-R)/R.y;
    vec3 target=vec3(0.,1.45,0.);
    vec3 ro=target+di*vec3(cos(pi)*sin(ya),sin(pi),cos(pi)*cos(ya));
    vec3 fw=normalize(target-ro),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw);
    vec3 rd=normalize(fw*1.75+uv.x*rt+uv.y*up);
    float t=0.;vec2 h;int i;
    for(i=0;i<MAX;i++){h=map(ro+rd*t);if(h.x<E||t>FAR)break;t+=h.x*.72;}
    vec3 col=vec3(.52,.73,.88)*(1.-max(rd.y,0.)*.32);
    if(t<FAR){
      vec3 p=ro+rd*t,n=norm(p),l=normalize(vec3(-3.,6.,4.));
      float dif=max(dot(n,l),0.),sh=shadow(p+n*.012,l);
      vec3 r=reflect(rd,n), base=mat(h.y);
      float ao=1.-float(i)/float(MAX)*.45;
      col=base*(.16+dif*sh*.84)*ao+pow(max(dot(r,l),0.),36.)*.22;
      col=mix(col,vec3(.55,.73,.83),1.-exp(-t*.035));
    }
    float v=1.-dot(uv,uv)*.13;
    O=vec4(pow(max(col*v,0.),vec3(.4545)),1);
  }`;

  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const e = gl.getShaderInfoLog(s); gl.deleteShader(s);
      throw new Error("Shader compilation failed: " + e);
    }
    return s;
  }
  let program;
  try {
    program = gl.createProgram();
    const a = shader(gl.VERTEX_SHADER, vs), b = shader(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(program, a); gl.attachShader(program, b); gl.linkProgram(program);
    gl.deleteShader(a); gl.deleteShader(b);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Shader compilation failed: " + gl.getProgramInfoLog(program));
  } catch (e) { if (program) gl.deleteProgram(program); throw e; }

  const vao = gl.createVertexArray(), buf = gl.createBuffer();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(["R","T","ya","pi","di"].map(x => [x,gl.getUniformLocation(program,x)]));
  let yaw = -.72, pitch = .22, distance = 5.6, down = false, lx = 0, ly = 0, lost = false, touches = new Map(), pinch = 0;
  canvas.tabIndex = canvas.tabIndex < 0 ? 0 : canvas.tabIndex;
  canvas.style.touchAction = "none";

  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const point = e => ({x:e.clientX,y:e.clientY});
  function orbit(dx,dy){yaw -= dx*.009; pitch=clamp(pitch-dy*.009,-1.42,1.42);}
  function wheel(e){e.preventDefault(); distance=clamp(distance*Math.exp(e.deltaY*.001),2.1,11);}
  function pd(e){canvas.focus();down=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture?.(e.pointerId);e.preventDefault();}
  function pm(e){if(!down)return;orbit(e.clientX-lx,e.clientY-ly);lx=e.clientX;ly=e.clientY;e.preventDefault();}
  function pu(e){down=false;canvas.releasePointerCapture?.(e.pointerId);}
  function ts(e){
    e.preventDefault(); touches.clear(); for(const x of e.touches)touches.set(x.identifier,point(x));
    if(touches.size===2){const a=[...touches.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
  }
  function tm(e){
    e.preventDefault(); const old=[...touches.values()]; touches.clear();for(const x of e.touches)touches.set(x.identifier,point(x));
    const now=[...touches.values()];
    if(now.length===1&&old.length===1){orbit(now[0].x-old[0].x,now[0].y-old[0].y);}
    if(now.length===2){const d=Math.hypot(now[0].x-now[1].x,now[0].y-now[1].y);if(pinch)distance=clamp(distance*pinch/d,2.1,11);pinch=d;}
  }
  function te(e){e.preventDefault();touches.clear();pinch=0;}
  function key(e){
    let q=true;
    if(e.key==="ArrowLeft") yaw+=.10; else if(e.key==="ArrowRight") yaw-=.10;
    else if(e.key==="ArrowUp") pitch=clamp(pitch+.10,-1.42,1.42); else if(e.key==="ArrowDown") pitch=clamp(pitch-.10,-1.42,1.42);
    else if(e.key==="+"||e.key==="=") distance=clamp(distance-.35,2.1,11);
    else if(e.key==="-"||e.key==="_") distance=clamp(distance+.35,2.1,11); else q=false;
    if(q)e.preventDefault();
  }
  const listeners=[[canvas,"wheel",wheel,{passive:false}],[canvas,"pointerdown",pd],[canvas,"pointermove",pm],[canvas,"pointerup",pu],[canvas,"pointercancel",pu],[canvas,"touchstart",ts,{passive:false}],[canvas,"touchmove",tm,{passive:false}],[canvas,"touchend",te,{passive:false}],[canvas,"touchcancel",te,{passive:false}],[canvas,"keydown",key],[canvas,"webglcontextlost",e=>{e.preventDefault();lost=true;}],[canvas,"webglcontextrestored",()=>{lost=true;}]];
  listeners.forEach(x=>x[0].addEventListener(x[1],x[2],x[3]));
  return {
    render(t) {
      if(lost || !gl || !canvas.width || !canvas.height) return;
      gl.viewport(0,0,canvas.width,canvas.height); gl.useProgram(program); gl.bindVertexArray(vao);
      gl.uniform2f(u.R,canvas.width,canvas.height); gl.uniform1f(u.T,t); gl.uniform1f(u.ya,yaw); gl.uniform1f(u.pi,pitch); gl.uniform1f(u.di,distance);
      gl.drawArrays(gl.TRIANGLES,0,3);
    },
    setView(y,p,d) { yaw=y; pitch=clamp(p,-1.52,1.52); distance=clamp(d,2.1,11); },
    getView() { return {yaw, pitch, distance}; },
    dispose() {
      listeners.forEach(x=>x[0].removeEventListener(x[1],x[2],x[3]));
      if (!lost) { gl.deleteBuffer(buf); gl.deleteVertexArray(vao); gl.deleteProgram(program); }
    }
  };
}
