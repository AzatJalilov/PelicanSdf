export function createPelicanSdf(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 is not available');

  const VS = `#version 300 es
void main(){vec2 v=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(v*2.-1.,0.,1.);}`;

  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;uniform vec3 uEye,uTgt;uniform float uT,uW;
uniform vec3 uP[2],uK[2],uA[2];
out vec4 oc;
const vec3 L=vec3(.478,.767,.428);
const vec3 C=vec3(.05,1.1,0.);
const float R=1.85;
float sc(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float se(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r))+1e-6;return k0*(k0-1.)/k1;}
float sb(vec3 p,vec3 b){vec3 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,max(d.y,d.z)),0.)-.008;}
float sm(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
void U(inout vec2 r,float d,float i){if(d<r.x)r=vec2(d,i);}
vec2 rot(vec2 v,vec2 d){return vec2(dot(v,d),v.y*d.x-v.x*d.y);}
void wheel(vec3 p,vec3 c,inout vec2 r){
  vec3 q=p-c;float b=length(q)-.62;
  if(b>.05){r.x=min(r.x,b);return;}
  float l=length(q.xy);
  U(r,length(vec2(l-.5,q.z))-.055,1.);
  U(r,length(vec2(l-.455,q.z))-.017,2.);
  float a=atan(q.y,q.x)+uW;a=mod(a+.2618,.5236)-.2618;
  vec2 s=l*vec2(cos(a),sin(a));
  U(r,max(length(vec2(s.y,q.z))-.006,l-.45),2.);
  U(r,max(l-.05,abs(q.z)-.045),2.);
}
vec2 map(vec3 p){
  float b0=length(p-C)-R;
  if(b0>.1)return vec2(b0,0.);
  vec2 r=vec2(1e3,0.);
  wheel(p,vec3(-.75,.5,0.),r);wheel(p,vec3(.75,.5,0.),r);
  vec3 q=vec3(p.xy,abs(p.z));
  float f=sc(p,vec3(0,.32,0),vec3(-.25,.95,0),.025);
  f=min(f,sc(p,vec3(-.25,.93,0),vec3(.5,.92,0),.022));
  f=min(f,sc(p,vec3(0,.32,0),vec3(.54,.84,0),.028));
  f=min(f,sc(p,vec3(.56,.78,0),vec3(.5,.96,0),.033));
  f=min(f,sc(q,vec3(0,.32,.06),vec3(-.75,.5,.06),.016));
  f=min(f,sc(q,vec3(-.25,.93,0),vec3(-.75,.5,.06),.014));
  f=min(f,sc(q,vec3(.56,.8,0),vec3(.75,.5,.06),.018));
  U(r,f,3.);
  float m=sc(p,vec3(.5,.95,0),vec3(.46,1.08,0),.02);
  m=min(m,sc(p,vec3(.46,1.08,-.32),vec3(.46,1.08,.32),.016));
  m=min(m,sc(p,vec3(-.25,.93,0),vec3(-.27,1.0,0),.018));
  m=min(m,sc(p,vec3(-.75,.5,-.08),vec3(-.75,.5,.08),.012));
  m=min(m,sc(p,vec3(.75,.5,-.08),vec3(.75,.5,.08),.012));
  vec3 c2=p-vec3(0,.32,.07);
  m=min(m,max(length(c2.xy)-.11,abs(c2.z)-.006));
  m=min(m,sc(p,vec3(0,.43,.07),vec3(-.75,.54,.07),.005));
  m=min(m,sc(p,vec3(0,.21,.07),vec3(-.75,.46,.07),.005));
  U(r,m,2.);
  U(r,sc(q,vec3(.46,1.08,.22),vec3(.46,1.08,.35),.025),4.);
  U(r,se(p-vec3(-.2,1.03,0),vec3(.2,.035,.09)),4.);
  for(int i=0;i<2;i++){
    float s=i==0?1.:-1.;
    U(r,sc(p,vec3(0,.32,.1*s),vec3(uP[i].xy,.1*s),.016),2.);
    U(r,sc(p,vec3(uP[i].xy,.1*s),uP[i],.01),2.);
    U(r,sb(p-uP[i],vec3(.06,.012,.035)),4.);
    vec3 h=vec3(-.15,1.12,.15*s);
    U(r,sc(p,h,uK[i],.065),5.);
    U(r,sc(p,uK[i],uA[i],.03),10.);
    U(r,se(p-uA[i]-vec3(.06,-.07,0),vec3(.11,.018,.055)),10.);
  }
  vec2 ax=vec2(.9689,.2474);
  vec3 bp=vec3(rot(q.xy-vec2(-.2,1.4),ax),q.z);
  float w=se(bp,vec3(.5,.31,.29));
  w=sm(w,se(bp-vec3(-.6,-.08,0),vec3(.3,.05,.15)),.1);
  float hb=length(p-vec3(.7,1.95,0))-.9;
  w=sm(w,sc(q,vec3(.15,1.55,0),vec3(.05,1.8,0),.1),.15);
  w=sm(w,sc(q,vec3(.05,1.8,0),vec3(.3,1.97,0),.075),.1);
  if(hb<.15){
    w=sm(w,se(q-vec3(.42,2.05,0),vec3(.17,.13,.12)),.08);
    w=sm(w,sc(q,vec3(.3,2.12,0),vec3(.14,2.08,0),.03),.05);
  }
  U(r,w,5.);
  if(hb<.2){
    vec2 dir=vec2(.98,-.2);
    vec3 kp=vec3(rot(q.xy-vec2(.46,2.05),dir),q.z);
    float up=se(kp-vec3(.4,.015,0),vec3(.44,.035,.06));
    up=sm(up,length(kp-vec3(.83,-.01,0))-.027,.03);
    U(r,min(up,se(kp-vec3(.36,-.03,0),vec3(.38,.02,.05))),6.);
    U(r,se(kp-vec3(.3,-.1,0),vec3(.32,.1,.06)),7.);
    U(r,length(q-vec3(.47,2.1,.095))-.033,8.);
    U(r,length(q-vec3(.485,2.103,.118))-.02,11.);
  }
  vec3 wq=vec3(rot(q.xy-vec2(.2,1.32),vec2(.78,-.62)),q.z-.27);
  U(r,se(wq,vec3(.4,.13,.05)),9.);
  return r;
}
vec3 nor(vec3 p){vec2 e=vec2(1,-1)*.0006;return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
float shadow(vec3 p,vec3 n){
  vec3 o=p+n*.01;float s=1.,t=.03;
  for(int i=0;i<24;i++){float h=map(o+L*t).x;s=min(s,9.*h/t);t+=clamp(h,.02,.2);if(s<.01||t>3.5)break;}
  return clamp(s,0.,1.);
}
float ao(vec3 p,vec3 n){
  float o=0.,k=1.;
  for(int i=1;i<5;i++){float h=.04*float(i);o+=(h-map(p+n*h).x)*k;k*=.6;}
  return clamp(1.-1.6*o,0.,1.);
}
vec3 sky(vec3 d){
  vec3 c=mix(vec3(.97,.86,.74),vec3(.33,.58,.92),pow(clamp(d.y,0.,1.),.45));
  float s=max(dot(d,L),0.);
  return c+vec3(1.,.8,.5)*(pow(s,200.)*2.+pow(s,8.)*.18);
}
vec3 alb(float id,vec3 p){
  if(id<1.5)return vec3(.05);
  if(id<2.5)return vec3(.78,.8,.84);
  if(id<3.5)return vec3(.8,.08,.1);
  if(id<4.5)return vec3(.07,.05,.045);
  if(id<5.5)return mix(vec3(.86,.87,.9),vec3(1.,.98,.95),clamp(p.y-1.,0.,1.));
  if(id<6.5)return vec3(1.,.6,.1);
  if(id<7.5)return vec3(1.,.5,.38);
  if(id<8.5)return vec3(.95);
  if(id<9.5)return mix(vec3(.85,.86,.9),vec3(.14,.16,.22),smoothstep(.0,.5,p.x+.05));
  if(id<10.5)return vec3(.95,.45,.2);
  return vec3(0.);
}
vec2 spc(float id){
  if(id<1.5)return vec2(10.,.08);
  if(id<2.5)return vec2(80.,.9);
  if(id<3.5)return vec2(60.,.6);
  if(id<6.5&&id>5.5)return vec2(30.,.3);
  return vec2(16.,.12);
}
vec3 gnd(vec3 g,float tg,vec3 rd){
  float w=.08+tg*.01;
  float c=smoothstep(-w,w,sin((g.x+uT*1.5)*2.6)*sin(g.z*2.6));
  vec3 a=mix(vec3(.58,.76,.5),vec3(.7,.84,.58),c);
  float rdm=smoothstep(1.7,1.6,abs(g.z));
  vec3 road=vec3(.4,.42,.47);
  float dash=step(.5,fract((g.x+uT*1.5)*.5))*smoothstep(.07,.05,abs(g.z));
  float edge=smoothstep(.05,.03,abs(abs(g.z)-1.5));
  road=mix(road,vec3(.92),max(dash,edge));
  a=mix(a,road,rdm);
  float sh=shadow(g,vec3(0,1,0));
  float dd=map(g).x;
  a*=(.55+.45*sh)*(.7+.3*smoothstep(0.,.6,dd));
  return mix(a,sky(vec3(rd.x,0.,rd.z)),1.-exp(-tg*.035));
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/min(uRes.y,uRes.x/1.3);
  vec3 f=normalize(uTgt-uEye),r=normalize(cross(f,vec3(0,1,0))),u=cross(r,f);
  vec3 rd=normalize(f*1.7+r*uv.x+u*uv.y),ro=uEye;
  vec3 col=sky(rd);
  float tg=1e9;
  if(rd.y<-1e-4&&ro.y>0.)tg=-ro.y/rd.y;
  vec3 oc3=ro-C;float b=dot(oc3,rd),d2=b*b-(dot(oc3,oc3)-R*R);
  float hit=-1.,id=0.;
  if(d2>0.){
    float s=sqrt(d2),t=max(-b-s,0.),te=min(-b+s,tg);
    if(-b+s>0.)for(int i=0;i<100;i++){
      vec2 h=map(ro+rd*t);
      if(h.x<.0006*t+.0002){hit=t;id=h.y;break;}
      t+=h.x*.9;if(t>te)break;
    }
  }
  if(hit>0.){
    vec3 p=ro+rd*hit,n=nor(p);
    vec3 al=alb(id,p);vec2 sp=spc(id);
    float sh=shadow(p,n),o=ao(p,n);
    float dif=max(dot(n,L),0.)*sh;
    vec3 hv=normalize(L-rd);
    float spe=pow(max(dot(n,hv),0.),sp.x)*sp.y*sh;
    float fr=pow(1.-max(dot(n,-rd),0.),3.);
    col=al*(vec3(1.,.93,.82)*dif*1.15+vec3(.5,.62,.85)*(.5+.5*n.y)*.55*o+vec3(.3,.4,.2)*max(-n.y,0.)*.35*o)
       +spe*vec3(1.)+fr*.15*sky(reflect(rd,n))*o;
  } else if(tg<1e8){
    col=gnd(ro+rd*tg,tg,rd);
  }
  col=pow(clamp(col,0.,1.),vec3(.4545));
  col*=1.-.25*dot(uv,uv)*.5;
  oc=vec4(col,1.);
}`;

  let prog = null, lost = false, loc = {};
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const m = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compilation failed: ' + m);
    }
    return s;
  }
  function init() {
    const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const m = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('Program link failed: ' + m);
    }
    prog = p;
    loc = {};
    for (const n of ['uRes', 'uEye', 'uTgt', 'uT', 'uW', 'uP', 'uK', 'uA']) loc[n] = gl.getUniformLocation(p, n);
  }
  init();

  let yaw = 0.6, pitch = 0.18, dist = 5.5;
  const pan = [0, 0, 0];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TGT = [0, 1.05, 0];

  function basis() {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const f = [-sy * cp, -sp, -cy * cp];
    const r = [cy, 0, -sy];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return { f, r, u };
  }
  function setView(y, p, d) {
    if (Number.isFinite(y)) yaw = y;
    if (Number.isFinite(p)) pitch = clamp(p, -1.5, 1.5);
    if (Number.isFinite(d)) dist = clamp(d, 0.4, 30);
  }
  function getView() { return { yaw, pitch, distance: dist }; }

  function zoom(factor, cx, cy) {
    const nd = clamp(dist * factor, 0.4, 30);
    if (cx !== undefined) {
      const rc = canvas.getBoundingClientRect();
      const s = Math.min(rc.height, rc.width / 1.3) || 1;
      const ux = (cx - rc.left - rc.width / 2) / s, uy = -(cy - rc.top - rc.height / 2) / s;
      const { r, u } = basis();
      const k = (dist / 1.7) * (1 - nd / dist);
      for (let i = 0; i < 3; i++) pan[i] += (r[i] * ux + u[i] * uy) * k;
    }
    dist = nd;
  }
  function panBy(dx, dy) {
    const rc = canvas.getBoundingClientRect();
    const s = Math.min(rc.height, rc.width / 1.3) || 1;
    const k = dist / 1.7 / s;
    const { r, u } = basis();
    for (let i = 0; i < 3; i++) pan[i] += (-r[i] * dx + u[i] * dy) * k;
  }

  const ptr = new Map();
  let pinch = 0;
  const pd = () => {
    const a = [...ptr.values()];
    return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };
  function onDown(e) {
    canvas.focus();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.size === 2) pinch = pd();
    e.preventDefault();
  }
  function onMove(e) {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptr.size === 1) {
      if (e.shiftKey || (e.buttons & 2)) panBy(dx, dy);
      else { yaw -= dx * 0.007; pitch = clamp(pitch + dy * 0.005, -1.5, 1.5); }
    } else if (ptr.size === 2) {
      const d = pd();
      const a = [...ptr.values()];
      if (pinch > 0 && d > 0) zoom(pinch / d, (a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2);
      pinch = d;
    }
    e.preventDefault();
  }
  function onUp(e) {
    ptr.delete(e.pointerId);
    pinch = ptr.size === 2 ? pd() : 0;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  function onWheel(e) {
    e.preventDefault();
    zoom(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), e.clientX, e.clientY);
  }
  function onKey(e) {
    let h = true;
    switch (e.key) {
      case 'ArrowLeft': yaw -= 0.08; break;
      case 'ArrowRight': yaw += 0.08; break;
      case 'ArrowUp': pitch = clamp(pitch + 0.06, -1.5, 1.5); break;
      case 'ArrowDown': pitch = clamp(pitch - 0.06, -1.5, 1.5); break;
      case '+': case '=': zoom(0.9); break;
      case '-': case '_': zoom(1.1); break;
      default: h = false;
    }
    if (h) e.preventDefault();
  }
  function onDbl() { yaw = 0.6; pitch = 0.18; dist = 5.5; pan[0] = pan[1] = pan[2] = 0; }
  function onCtx(e) { e.preventDefault(); }
  function onLost(e) { e.preventDefault(); lost = true; prog = null; }
  function onRestored() {
    try { init(); lost = false; } catch (_) { lost = true; }
  }

  if (canvas.tabIndex < 0) canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  const L = [
    ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp],
    ['keydown', onKey], ['dblclick', onDbl], ['contextmenu', onCtx],
    ['webglcontextlost', onLost], ['webglcontextrestored', onRestored],
  ];
  for (const [n, f] of L) canvas.addEventListener(n, f);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const UP = new Float32Array(6), UK = new Float32Array(6), UA = new Float32Array(6);
  function legs(t) {
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const a = -2 * t + i * Math.PI;
      const px = 0.17 * Math.cos(a), py = 0.32 + 0.17 * Math.sin(a);
      UP.set([px, py, 0.2 * s], i * 3);
      const ax = px - 0.03, ay = py + 0.08;
      UA.set([ax, ay, 0.2 * s], i * 3);
      const hx = -0.15, hy = 1.12;
      const dx = ax - hx, dy = ay - hy;
      const Ld = Math.hypot(dx, dy) || 1;
      const l = 0.58;
      const hh = Math.sqrt(Math.max(l * l - Ld * Ld / 4, 1e-4));
      UK.set([hx + dx / 2 - hh * dy / Ld, hy + dy / 2 + hh * dx / Ld, 0.17 * s], i * 3);
    }
  }

  function render(t) {
    if (lost || !prog || gl.isContextLost()) return;
    t = Number(t) || 0;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const tg = [TGT[0] + pan[0], TGT[1] + pan[1], TGT[2] + pan[2]];
    legs(t);
    gl.uniform2f(loc.uRes, canvas.width, canvas.height);
    gl.uniform3f(loc.uEye, tg[0] + dist * sy * cp, tg[1] + dist * sp, tg[2] + dist * cy * cp);
    gl.uniform3f(loc.uTgt, tg[0], tg[1], tg[2]);
    gl.uniform1f(loc.uT, t);
    gl.uniform1f(loc.uW, (3 * t) % (Math.PI / 6));
    gl.uniform3fv(loc.uP, UP);
    gl.uniform3fv(loc.uK, UK);
    gl.uniform3fv(loc.uA, UA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function dispose() {
    for (const [n, f] of L) canvas.removeEventListener(n, f);
    canvas.removeEventListener('wheel', onWheel);
    if (prog && !gl.isContextLost()) gl.deleteProgram(prog);
    prog = null;
    lost = true;
    ptr.clear();
  }

  return { render, setView, getView, dispose };
}
