export function createPelicanSdf(canvas) {
  if (!canvas || !canvas.getContext) throw new Error('createPelicanSdf: a canvas element is required');

  const VS = `#version 300 es
precision highp float;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;

  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;uniform vec3 uCam;uniform mat3 uBas;uniform float uT;
out vec4 O;
const vec3 L=normalize(vec3(0.55,0.78,0.42));
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*h)-r;}
float sdRC(vec3 p,vec3 a,vec3 b,float r1,float r2){
 vec3 ba=b-a;float l2=dot(ba,ba);float rr=r1-r2;float a2=l2-rr*rr;float il2=1.0/l2;
 vec3 pa=p-a;float y=dot(pa,ba);float z=y-l2;vec3 w=pa*l2-ba*y;float x2=dot(w,w);
 float y2=y*y*l2;float z2=z*z*l2;float k=sign(rr)*rr*rr*x2;
 if(sign(z)*a2*z2>k)return sqrt(x2+z2)*il2-r2;
 if(sign(y)*a2*y2<k)return sqrt(x2+y2)*il2-r1;
 return (sqrt(max(x2*a2*il2,0.0))+y*rr)*il2-r1;}
float sdEll(vec3 p,vec3 r){float k1=length(p/r);float k2=length(p/(r*r));return k1*(k1-1.0)/max(k2,1e-6);}
float sdTz(vec3 p,vec2 t){return length(vec2(length(p.xy)-t.x,p.z))-t.y;}
vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

vec2 wheel(vec3 p,float sp){
 p.xy=rot(sp)*p.xy;
 float d1=sdTz(p,vec2(0.315,0.052));
 float rr=length(p.xy);
 float d2=sdTz(p,vec2(0.262,0.015));
 float a=atan(p.y,p.x);float k=0.78539816;
 a=mod(a+0.5*k,k)-0.5*k;
 vec2 q=vec2(rr*cos(a),rr*sin(a));
 float s=max(max(abs(q.y)-0.006,abs(p.z)-0.006),max(q.x-0.262,0.03-q.x))*0.7;
 float hub=max(max(rr-0.042,abs(p.z)-0.055),-0.02-p.z*0.0);
 d2=min(min(d2,s),hub);
 return d1<d2?vec2(d1,1.0):vec2(d2,3.0);}

vec2 bike(vec3 p,float t,vec3 pa,vec3 pb){
 vec3 BB=vec3(0.0,0.30,0.0),RH=vec3(-0.58,0.37,0.0),FH=vec3(0.58,0.37,0.0),
      ST=vec3(-0.30,0.82,0.0),HT=vec3(0.34,0.84,0.0),HB=vec3(0.42,0.58,0.0);
 vec2 res=wheel(p-FH,-t*2.2);
 res=U(res,wheel(p-RH,-t*2.2));
 vec3 q=p;q.z=abs(q.z);
 float f=sdCap(p,BB,HB,0.026);
 f=min(f,sdCap(p,BB,ST,0.024));
 f=min(f,sdCap(p,ST,HT,0.022));
 f=min(f,sdCap(p,HB,HT,0.028));
 f=min(f,sdCap(q,BB+vec3(0.0,0.0,0.05),RH,0.015));
 f=min(f,sdCap(q,ST+vec3(0.0,0.0,0.02),RH,0.013));
 f=min(f,sdCap(q,HB+vec3(0.0,0.0,0.05),FH,0.016));
 f=min(f,sdCap(p,ST,vec3(-0.33,0.93,0.0),0.018));
 f=min(f,sdCap(p,HT,vec3(0.40,0.95,0.0),0.018));
 vec2 r2=vec2(f,2.0);
 float bar=sdCap(p,vec3(0.40,0.95,-0.21),vec3(0.40,0.95,0.21),0.017);
 r2=U(r2,vec2(bar,3.0));
 float grip=sdCap(q,vec3(0.40,0.95,0.135),vec3(0.40,0.95,0.215),0.025);
 float seat=sdEll(p-vec3(-0.34,0.96,0.0),vec3(0.155,0.035,0.075));
 float ca=t*2.2;
 float ring=sdTz(p-BB-vec3(0.0,0.0,0.078),vec2(0.10,0.009));
 float cr=sdCap(p,BB+vec3(0.0,0.0,0.085),pa,0.014);
 cr=min(cr,sdCap(p,BB-vec3(0.0,0.0,0.085),pb,0.014));
 cr=min(cr,max(length((p-BB).xy)-0.021,abs(p.z)-0.09));
 float chain=max(sdTz(p-mix(BB,vec3(-0.58,0.37,0.0),0.5)-vec3(0.0,0.0,0.078),vec2(0.0,0.006)),0.0);
 r2=U(r2,vec2(min(ring,cr),3.0));
 float ped=sdEll(p-pa-vec3(0.0,0.0,0.025),vec3(0.052,0.013,0.032));
 ped=min(ped,sdEll(p-pb+vec3(0.0,0.0,0.025),vec3(0.052,0.013,0.032)));
 r2=U(r2,vec2(min(min(seat,grip),ped),8.0));
 return U(res,r2);}

vec2 pelican(vec3 p,float t,vec3 pa,vec3 pb){
 p.y-=0.014*sin(t*4.4);
 float b=sdEll(p-vec3(-0.12,1.10,0.0),vec3(0.34,0.28,0.25));
 float n=sdRC(p,vec3(-0.02,1.24,0.0),vec3(0.14,1.44,0.0),0.14,0.10);
 n=min(n,sdRC(p,vec3(0.14,1.44,0.0),vec3(0.29,1.58,0.0),0.10,0.115));
 b=smin(b,n,0.07);
 float tail=sdRC(p,vec3(-0.30,1.14,0.0),vec3(-0.63,1.26,0.0),0.16,0.03);
 b=smin(b,tail,0.08);
 vec3 q=p;q.z=abs(q.z);
 vec3 wp=q-vec3(-0.12,1.13,0.235);
 wp.yz=rot(0.22+0.09*sin(t*2.6))*wp.yz;wp.xy=rot(-0.12)*wp.xy;
 float wing=sdEll(wp,vec3(0.31,0.19,0.05));
 b=smin(b,wing,0.05);
 float crest=sdRC(p,vec3(0.20,1.66,0.0),vec3(0.06,1.74,0.0),0.045,0.012);
 b=smin(b,crest,0.04);
 vec2 res=vec2(b,4.0);
 float eye=length(q-vec3(0.345,1.625,0.077))-0.030;
 res=U(res,vec2(eye,6.0));
 float bk=sdRC(p,vec3(0.30,1.585,0.0),vec3(0.84,1.45,0.0),0.085,0.016);
 float pouch=sdEll(p-vec3(0.51,1.42,0.0),vec3(0.20,0.125,0.10));
 bk=smin(bk,pouch,0.07);
 res=U(res,vec2(bk,5.0));
 vec3 h1=vec3(0.0,0.92,0.13),h2=vec3(0.0,0.92,-0.13);
 vec3 fa=vec3(pa.x,pa.y+0.045,0.115),fb=vec3(pb.x,pb.y+0.045,-0.115);
 vec3 k1=mix(h1,fa,0.5)+vec3(0.16,0.02,0.0);
 vec3 k2=mix(h2,fb,0.5)+vec3(0.16,0.02,0.0);
 float leg=sdRC(p,h1,k1,0.078,0.045);
 leg=min(leg,sdRC(p,k1,fa,0.045,0.028));
 leg=min(leg,sdRC(p,h2,k2,0.078,0.045));
 leg=min(leg,sdRC(p,k2,fb,0.045,0.028));
 leg=min(leg,sdEll(p-fa-vec3(0.025,-0.025,0.0),vec3(0.075,0.02,0.05)));
 leg=min(leg,sdEll(p-fb-vec3(0.025,-0.025,0.0),vec3(0.075,0.02,0.05)));
 res=U(res,vec2(leg,5.0));
 float wr=sdCap(p,vec3(0.16,1.20,0.16),vec3(0.39,0.99,0.19),0.055);
 wr=min(wr,sdCap(p,vec3(0.16,1.20,-0.16),vec3(0.39,0.99,-0.19),0.055));
 res=U(res,vec2(wr,4.0));
 return res;}

vec2 map(vec3 p){
 float t=uT;
 float ca=t*2.2;
 vec3 BB=vec3(0.0,0.30,0.0);
 vec3 pa=BB+vec3(cos(ca)*0.155,sin(ca)*0.155,0.085);
 vec3 pb=BB-vec3(cos(ca)*0.155,sin(ca)*0.155,0.085);
 vec2 res=vec2(p.y,7.0);
 res=U(res,bike(p,t,pa,pb));
 res=U(res,pelican(p,t,pa,pb));
 return res;}

vec3 nrm(vec3 p,float e){
 vec2 k=vec2(1.0,-1.0);
 return normalize(k.xyy*map(p+k.xyy*e).x+k.yyx*map(p+k.yyx*e).x+k.yxy*map(p+k.yxy*e).x+k.xxx*map(p+k.xxx*e).x);}

vec2 march(vec3 ro,vec3 rd){
 float t=0.02;vec2 h=vec2(0.0);
 for(int i=0;i<160;i++){
  vec3 p=ro+rd*t;h=map(p);
  if(h.x<0.0006*t)return vec2(t,h.y);
  t+=h.x*0.85;
  if(t>45.0)break;}
 return vec2(-1.0,0.0);}

float shad(vec3 ro,vec3 rd){
 float r=1.0,t=0.035;
 for(int i=0;i<38;i++){
  float h=map(ro+rd*t).x;
  r=min(r,9.0*h/t);
  if(r<0.004||t>7.0)break;
  t+=clamp(h,0.02,0.35);}
 return clamp(r,0.0,1.0);}

float ao(vec3 p,vec3 n){
 float o=0.0,s=1.0;
 for(int i=0;i<5;i++){
  float d=0.02+0.055*float(i);
  o+=(d-map(p+n*d).x)*s;s*=0.72;}
 return clamp(1.0-1.6*o,0.0,1.0);}

vec3 sky(vec3 rd){
 vec3 c=mix(vec3(0.62,0.76,0.94),vec3(0.15,0.32,0.60),clamp(rd.y*1.25,0.0,1.0));
 c+=vec3(1.0,0.85,0.55)*pow(max(dot(rd,L),0.0),26.0)*0.55;
 c=mix(c,vec3(0.70,0.72,0.68),smoothstep(0.04,-0.06,rd.y)*0.7);
 return c;}

void main(){
 vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
 vec3 rd=normalize(uBas*vec3(uv,1.7));
 vec3 ro=uCam;
 vec2 h=march(ro,rd);
 vec3 col;
 if(h.x<0.0){col=sky(rd);}
 else{
  vec3 p=ro+rd*h.x;
  vec3 n=nrm(p,max(0.0006,0.0009*h.x));
  float m=h.y;
  vec3 alb=vec3(0.8);float ru=0.5,spc=0.3;
  if(m<1.5){alb=vec3(0.045,0.045,0.05);spc=0.25;ru=0.55;}
  else if(m<2.5){alb=vec3(0.72,0.10,0.11);spc=0.75;ru=0.15;}
  else if(m<3.5){alb=vec3(0.66,0.69,0.74);spc=0.95;ru=0.10;}
  else if(m<4.5){float f=0.5+0.5*sin(p.x*40.0)*sin(p.z*40.0);alb=mix(vec3(0.96,0.96,0.94),vec3(0.87,0.88,0.90),f*0.4);spc=0.2;ru=0.6;}
  else if(m<5.5){alb=vec3(0.97,0.55,0.10);spc=0.45;ru=0.35;}
  else if(m<6.5){alb=vec3(0.02,0.02,0.03);spc=1.0;ru=0.05;}
  else if(m<7.5){
   vec2 g=floor(p.xz*1.2);
   float ch=mod(g.x+g.y,2.0);
   alb=mix(vec3(0.30,0.34,0.28),vec3(0.36,0.40,0.33),ch);
   float rr=length(p.xz);
   alb=mix(alb,vec3(0.42,0.47,0.40),clamp(rr/22.0,0.0,1.0));
   spc=0.1;ru=0.9;}
  else{alb=vec3(0.07,0.065,0.07);spc=0.5;ru=0.3;}
  float occ=ao(p,n);
  float sh=shad(p+n*0.01,L);
  float dif=clamp(dot(n,L),0.0,1.0);
  vec3 hv=normalize(L-rd);
  float sp=pow(clamp(dot(n,hv),0.0,1.0),mix(8.0,220.0,1.0-ru))*spc;
  float bnc=clamp(0.4-0.6*n.y,0.0,1.0);
  float sk=clamp(0.5+0.5*n.y,0.0,1.0);
  float fre=pow(clamp(1.0+dot(n,rd),0.0,1.0),4.0);
  vec3 lig=vec3(0.0);
  lig+=vec3(1.30,1.14,0.92)*dif*sh;
  lig+=vec3(0.32,0.42,0.62)*sk*occ;
  lig+=vec3(0.26,0.24,0.18)*bnc*occ;
  col=alb*lig;
  col+=vec3(1.0,0.92,0.78)*sp*sh*(0.4+0.6*occ);
  col+=vec3(0.35,0.48,0.65)*fre*0.35*occ;
  float fog=1.0-exp(-0.006*h.x*h.x);
  col=mix(col,sky(rd),clamp(fog,0.0,1.0));}
 col=col/(1.0+col*0.28);
 col=pow(max(col,0.0),vec3(0.4545));
 float v=1.0-0.22*dot(uv,uv);
 O=vec4(col*v,1.0);}`;

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) throw new Error('createPelicanSdf: WebGL2 is not available');

  let prog = null, vao = null, uRes = null, uCam = null, uBas = null, uT = null;
  let contextLost = false;

  function compile(type, src, label) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('createPelicanSdf: ' + label + ' shader compilation failed: ' + log);
    }
    return s;
  }

  function build() {
    const vs = compile(gl.VERTEX_SHADER, VS, 'vertex');
    const fs = compile(gl.FRAGMENT_SHADER, FS, 'fragment');
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('createPelicanSdf: program link failed: ' + log);
    }
    prog = p;
    vao = gl.createVertexArray();
    uRes = gl.getUniformLocation(prog, 'uRes');
    uCam = gl.getUniformLocation(prog, 'uCam');
    uBas = gl.getUniformLocation(prog, 'uBas');
    uT = gl.getUniformLocation(prog, 'uT');
  }
  build();

  let yaw = 0.72, pitch = 0.24, dist = 4.2;
  const TGT = [0.0, 0.98, 0.0];
  const MIND = 0.45, MAXD = 16.0;
  const basis = new Float32Array(9);
  const campos = new Float32Array(3);

  function clampView() {
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
    dist = Math.max(MIND, Math.min(MAXD, dist));
    const TAU = Math.PI * 2;
    yaw = yaw - Math.floor(yaw / TAU) * TAU;
  }

  function updateCam() {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const px = TGT[0] + dist * cp * Math.sin(yaw);
    const py = TGT[1] + dist * sp;
    const pz = TGT[2] + dist * cp * Math.cos(yaw);
    campos[0] = px; campos[1] = py; campos[2] = pz;
    let fx = TGT[0] - px, fy = TGT[1] - py, fz = TGT[2] - pz;
    const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    let rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0;
    const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    basis[0] = rx; basis[1] = ry; basis[2] = rz;
    basis[3] = ux; basis[4] = uy; basis[5] = uz;
    basis[6] = fx; basis[7] = fy; basis[8] = fz;
  }

  // ---- interaction ----
  if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
  try { canvas.style.touchAction = 'none'; canvas.style.outline = 'none'; } catch (e) {}

  const pointers = new Map();
  let pinchDist = 0;

  const onDown = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    try { canvas.focus({ preventScroll: true }); } catch (err) { canvas.focus(); }
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
    e.preventDefault();
  };
  const onMove = (e) => {
    const pr = pointers.get(e.pointerId);
    if (!pr) return;
    const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
    pr.x = e.clientX; pr.y = e.clientY;
    if (pointers.size === 1) {
      yaw -= dx * 0.0075;
      pitch += dy * 0.0060;
      clampView();
    } else if (pointers.size === 2) {
      const p = [...pointers.values()];
      const nd = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (pinchDist > 0 && nd > 0) { dist *= pinchDist / nd; clampView(); }
      pinchDist = nd;
    }
    e.preventDefault();
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    if (pointers.size < 2) pinchDist = 0;
    e.preventDefault();
  };
  const onWheel = (e) => {
    dist *= Math.exp((e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0012);
    clampView();
    e.preventDefault();
  };
  const onKey = (e) => {
    let used = true;
    switch (e.key) {
      case 'ArrowLeft': yaw -= 0.09; break;
      case 'ArrowRight': yaw += 0.09; break;
      case 'ArrowUp': pitch += 0.07; break;
      case 'ArrowDown': pitch -= 0.07; break;
      case '+': case '=': dist *= 0.90; break;
      case '-': case '_': dist *= 1.11; break;
      default: used = false;
    }
    if (used) { clampView(); e.preventDefault(); }
  };
  const onLost = (e) => { e.preventDefault(); contextLost = true; };
  const onRestored = () => {
    contextLost = false;
    prog = null; vao = null;
    try { build(); } catch (err) { contextLost = true; }
  };
  const onCtx = (e) => e.preventDefault();

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('contextmenu', onCtx);
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  let disposed = false;

  return {
    render(timeSeconds) {
      if (disposed || contextLost || !prog) return;
      if (gl.isContextLost && gl.isContextLost()) return;
      const w = canvas.width | 0, h = canvas.height | 0;
      if (w <= 0 || h <= 0) return;
      clampView();
      updateCam();
      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform2f(uRes, w, h);
      gl.uniform3f(uCam, campos[0], campos[1], campos[2]);
      gl.uniformMatrix3fv(uBas, false, basis);
      gl.uniform1f(uT, typeof timeSeconds === 'number' && isFinite(timeSeconds) ? timeSeconds : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    setView(y, p, d) {
      if (typeof y === 'number' && isFinite(y)) yaw = y;
      if (typeof p === 'number' && isFinite(p)) pitch = p;
      if (typeof d === 'number' && isFinite(d)) dist = d;
      clampView();
    },
    getView() { return { yaw, pitch, distance: dist }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('lostpointercapture', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('contextmenu', onCtx);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      pointers.clear();
      try {
        if (vao) gl.deleteVertexArray(vao);
        if (prog) gl.deleteProgram(prog);
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      } catch (e) {}
      prog = null; vao = null;
    }
  };
}
