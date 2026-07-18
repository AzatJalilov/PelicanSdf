export function createPelicanSdf(canvas) {
  const VS = `#version 300 es
in vec2 a;
void main(){ gl_Position = vec4(a,0.0,1.0); }`;

  const FS = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 uRes;
uniform float uT;
uniform vec3 uEye;
uniform mat3 uCam;

#define BB vec3(0.0,0.46,0.0)
const vec3 LIG = normalize(vec3(0.55,0.72,0.42));

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }
float dot2(vec3 v){ return dot(v,v); }
float sdSph(vec3 p,float r){ return length(p)-r; }
float sdCap(vec3 p,vec3 a,vec3 b,float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h)-r; }
float sdTor(vec3 p,float R,float r){ return length(vec2(length(p.xy)-R,p.z))-r; }
float sdBox(vec3 p,vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float sdEll(vec3 p,vec3 r){ float k0=length(p/r), k1=length(p/(r*r)); return k0*(k0-1.0)/max(k1,1e-5); }
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
vec2 mn(vec2 a,vec2 b){ return a.x<b.x?a:b; }
float sdRC(vec3 p,vec3 a,vec3 b,float r1,float r2){
  vec3 ba=b-a; float l2=dot(ba,ba); float rr=r1-r2; float a2=l2-rr*rr; float il2=1.0/l2;
  vec3 pa=p-a; float y=dot(pa,ba); float z=y-l2;
  float x2=dot2(pa*l2-ba*y); float y2=y*y*l2; float z2=z*z*l2;
  float k=sign(rr)*rr*rr*x2;
  if(sign(z)*a2*z2>k) return sqrt(x2+z2)*il2-r2;
  if(sign(y)*a2*y2<k) return sqrt(x2+y2)*il2-r1;
  return (sqrt(x2*a2*il2)+y*rr)*il2-r1;
}

vec2 wheelF(vec3 p){
  float tire = sdTor(p,0.50,0.062);
  float rim  = sdTor(p,0.435,0.022);
  float k = 6.2831853/12.0;
  float a = atan(p.y,p.x); a = mod(a+0.5*k,k)-0.5*k;
  vec3 q = vec3(cos(a),sin(a),0.0)*length(p.xy); q.z = p.z;
  float sp = sdCap(q,vec3(0.05,0.0,0.0),vec3(0.435,0.0,0.0),0.011);
  float hub = sdCap(p,vec3(0.0,0.0,-0.065),vec3(0.0,0.0,0.065),0.055);
  return mn(vec2(tire,2.0), vec2(min(min(rim,sp),hub),3.0));
}

vec2 frameF(vec3 p){
  vec3 q = vec3(p.x,p.y,abs(p.z));
  vec3 ST = vec3(-0.32,1.16,0.0), HT = vec3(0.60,1.20,0.0), HB = vec3(0.66,0.84,0.0);
  float d = sdCap(p,BB,ST,0.036);
  d = min(d, sdCap(p,BB,HB,0.042));
  d = min(d, sdCap(p,ST,vec3(0.58,1.14,0.0),0.032));
  d = min(d, sdCap(p,HB,HT,0.05));
  d = min(d, sdCap(q,vec3(0.0,0.46,0.055),vec3(-0.95,0.58,0.06),0.026));
  d = min(d, sdCap(q,ST,vec3(-0.95,0.58,0.06),0.022));
  d = min(d, sdCap(q,vec3(0.66,0.86,0.055),vec3(0.95,0.58,0.075),0.03));
  float st = sdCap(p,vec3(0.60,1.18,0.0),vec3(0.50,1.34,0.0),0.032);
  st = min(st, sdCap(q,vec3(0.50,1.34,0.0),vec3(0.50,1.34,0.22),0.026));
  st = min(st, sdCap(q,vec3(0.50,1.34,0.22),vec3(0.62,1.26,0.31),0.026));
  vec2 r = vec2(min(d,st),4.0);
  float ch = sdCap(p,vec3(0.10,0.615,0.12),vec3(-0.95,0.648,0.12),0.014);
  ch = min(ch, sdCap(p,vec3(0.10,0.305,0.12),vec3(-0.95,0.512,0.12),0.014));
  float cog = sdCap(p-vec3(-0.95,0.58,0.0),vec3(0.0,0.0,0.105),vec3(0.0,0.0,0.135),0.075);
  r = mn(r, vec2(min(ch,cog),2.0));
  vec3 sp = p-vec3(-0.34,1.22,0.0); sp.z *= 1.7;
  float sd = sdEll(sp,vec3(0.24,0.055,0.15))/1.7;
  float gr = sdCap(q,vec3(0.62,1.26,0.31),vec3(0.67,1.21,0.37),0.038);
  return mn(r, vec2(min(sd,gr),8.0));
}

vec2 crankF(vec3 p){
  float ca = -uT*2.5;
  float d = sdCap(p-BB,vec3(0.0,0.0,0.113),vec3(0.0,0.0,0.127),0.155);
  for(int i=0;i<2;i++){
    float s = (i==0)?1.0:-1.0;
    vec3 a = BB+vec3(0.0,0.0,0.11*s);
    vec3 b = BB+vec3(cos(ca)*0.17*s,sin(ca)*0.17*s,0.11*s);
    d = min(d, sdCap(p,a,b,0.022));
  }
  vec2 r = vec2(d,3.0);
  float pd = 1e9;
  for(int i=0;i<2;i++){
    float s = (i==0)?1.0:-1.0;
    vec3 b = BB+vec3(cos(ca)*0.17*s,sin(ca)*0.17*s,0.155*s);
    pd = min(pd, sdBox(p-b,vec3(0.06,0.012,0.036))-0.008);
  }
  return mn(r, vec2(pd,2.0));
}

vec2 legsF(vec3 p){
  float ca = -uT*2.5;
  float d = 1e9;
  for(int i=0;i<2;i++){
    float s = (i==0)?1.0:-1.0;
    vec3 ped = BB+vec3(cos(ca)*0.17*s,sin(ca)*0.17*s,0.15*s);
    vec3 hip = vec3(-0.06,1.42,0.17*s);
    vec3 knee = mix(hip,ped,0.5)+vec3(0.23,0.03,0.03*s);
    d = min(d, sdRC(p,hip,knee,0.10,0.07));
    d = min(d, sdRC(p,knee,ped+vec3(0.0,0.065,0.0),0.07,0.048));
    d = min(d, sdBox(p-ped-vec3(0.03,0.035,0.0),vec3(0.085,0.022,0.05))-0.012);
  }
  return vec2(d,6.0);
}

vec2 pelicanF(vec3 p){
  p.y -= 0.016*sin(uT*5.0);
  vec3 q = vec3(p.x,p.y,abs(p.z));
  float body = sdEll(p-vec3(-0.12,1.74,0.0),vec3(0.46,0.38,0.34));
  float tail = sdRC(p,vec3(-0.42,1.76,0.0),vec3(-0.90,1.94,0.0),0.20,0.05);
  float neck = sdRC(p,vec3(0.12,1.90,0.0),vec3(0.58,2.30,0.0),0.17,0.125);
  float head = sdSph(p-vec3(0.64,2.36,0.0),0.175);
  float d = smin(body,tail,0.14);
  d = smin(d,neck,0.16);
  d = smin(d,head,0.06);
  float w = sdRC(q,vec3(-0.06,1.86,0.30),vec3(0.30,1.62,0.33),0.26,0.17);
  w = smin(w, sdRC(q,vec3(0.30,1.62,0.33),vec3(0.63,1.29,0.34),0.15,0.075),0.10);
  d = smin(d,w,0.08);
  vec2 r = vec2(d,5.0);
  vec3 bp = p-vec3(0.70,2.33,0.0); bp.z *= 1.25;
  float up = sdRC(bp,vec3(0.0),vec3(0.85,-0.22,0.0),0.13,0.028)/1.25;
  float lo = sdRC(p-vec3(0.70,2.24,0.0),vec3(0.0),vec3(0.84,-0.20,0.0),0.10,0.025);
  float pouch = sdEll(p-vec3(1.03,2.06,0.0),vec3(0.34,0.19,0.165));
  float bk = smin(lo,pouch,0.12);
  bk = smin(bk,up,0.04);
  r = mn(r, vec2(bk,6.0));
  float e = sdSph(q-vec3(0.705,2.42,0.115),0.05);
  return mn(r, vec2(e,7.0));
}

vec2 map(vec3 p){
  vec2 res = vec2(p.y,1.0);
  float ang = uT*3.0;
  float b;
  vec3 pr = p-vec3(-0.95,0.58,0.0);
  b = length(pr)-0.60;
  if(b>0.03) res = mn(res,vec2(b,3.0));
  else { vec3 q=pr; q.xy = rot(ang)*q.xy; res = mn(res,wheelF(q)); }
  vec3 pf = p-vec3(0.95,0.58,0.0);
  b = length(pf)-0.60;
  if(b>0.03) res = mn(res,vec2(b,3.0));
  else { vec3 q=pf; q.xy = rot(ang)*q.xy; res = mn(res,wheelF(q)); }
  b = sdBox(p-vec3(-0.02,0.88,0.0),vec3(1.02,0.54,0.42));
  if(b>0.03) res = mn(res,vec2(b,4.0)); else res = mn(res,frameF(p));
  b = length(p-BB)-0.36;
  if(b>0.03) res = mn(res,vec2(b,3.0)); else res = mn(res,crankF(p));
  b = sdBox(p-vec3(0.33,1.93,0.0),vec3(1.34,0.77,0.5));
  if(b>0.03) res = mn(res,vec2(b,5.0)); else res = mn(res,pelicanF(p));
  b = sdBox(p-vec3(0.02,0.90,0.0),vec3(0.52,0.70,0.4));
  if(b>0.03) res = mn(res,vec2(b,6.0)); else res = mn(res,legsF(p));
  return res;
}

vec2 trace(vec3 ro,vec3 rd){
  float t = 0.02;
  for(int i=0;i<150;i++){
    vec3 p = ro+rd*t;
    vec2 d = map(p);
    if(d.x < 0.0006*t+0.0002) return vec2(t,d.y);
    t += d.x*0.92;
    if(t>32.0) break;
  }
  return vec2(-1.0,0.0);
}

vec3 calcN(vec3 p,float t){
  vec2 e = vec2(1.0,-1.0)*(0.0007+0.0006*t);
  return normalize(e.xyy*map(p+e.xyy).x + e.yyx*map(p+e.yyx).x + e.yxy*map(p+e.yxy).x + e.xxx*map(p+e.xxx).x);
}

float shadow(vec3 ro,vec3 rd){
  float res = 1.0, t = 0.035;
  for(int i=0;i<40;i++){
    float h = map(ro+rd*t).x;
    res = min(res, 9.0*h/t);
    t += clamp(h,0.025,0.35);
    if(res<0.004 || t>7.0) break;
  }
  return clamp(res,0.0,1.0);
}

float calcAO(vec3 p,vec3 n){
  float o = 0.0, s = 1.0;
  for(int i=1;i<=5;i++){
    float h = 0.02*float(i)*float(i);
    o += (h-map(p+n*h).x)*s;
    s *= 0.75;
  }
  return clamp(1.0-1.4*o,0.0,1.0);
}

vec3 skyCol(vec3 rd){
  vec3 c = mix(vec3(0.62,0.76,0.95), vec3(0.16,0.33,0.66), clamp(rd.y*1.3,0.0,1.0));
  c = mix(c, vec3(0.85,0.86,0.82), pow(clamp(1.0-abs(rd.y)*2.2,0.0,1.0),3.0)*0.6);
  c += vec3(1.0,0.85,0.6)*pow(max(dot(rd,LIG),0.0),80.0)*0.8;
  return c;
}

vec3 shade(vec3 p,vec3 n,vec3 rd,float m,float t){
  vec3 alb; float ks=0.2, shin=32.0;
  if(m<1.5){
    float c = mod(floor(p.x*0.7)+floor(p.z*0.7),2.0);
    alb = mix(vec3(0.35,0.37,0.33),vec3(0.27,0.30,0.27),c);
    alb = mix(alb, vec3(0.31,0.34,0.30), clamp(t*0.06,0.0,1.0));
    ks = 0.04; shin = 16.0;
  } else if(m<2.5){ alb=vec3(0.055,0.055,0.06); ks=0.28; shin=48.0; }
  else if(m<3.5){ alb=vec3(0.60,0.63,0.68); ks=0.8; shin=110.0; }
  else if(m<4.5){ alb=vec3(0.76,0.13,0.14); ks=0.65; shin=90.0; }
  else if(m<5.5){ alb=vec3(0.94,0.94,0.91); ks=0.16; shin=26.0; }
  else if(m<6.5){ alb=vec3(0.98,0.60,0.12); ks=0.4; shin=54.0; }
  else if(m<7.5){ alb=vec3(0.02,0.02,0.02); ks=0.95; shin=180.0; }
  else { alb=vec3(0.15,0.10,0.07); ks=0.25; shin=32.0; }
  float occ = calcAO(p,n);
  float dif = clamp(dot(n,LIG),0.0,1.0);
  float sh = dif>0.001 ? shadow(p+n*0.012,LIG) : 0.0;
  float amb = 0.5+0.5*n.y;
  float bnc = clamp(dot(n,normalize(vec3(-0.6,0.25,-0.5))),0.0,1.0);
  vec3 col = alb*(vec3(1.25,1.12,0.95)*dif*sh*1.55 + vec3(0.32,0.42,0.58)*amb*occ*0.9 + vec3(0.30,0.24,0.18)*bnc*occ*0.35);
  vec3 hv = normalize(LIG-rd);
  col += vec3(1.1,1.0,0.86)*pow(clamp(dot(n,hv),0.0,1.0),shin)*ks*sh*dif*1.9;
  col += alb*vec3(0.40,0.55,0.80)*pow(clamp(1.0+dot(rd,n),0.0,1.0),3.5)*occ*0.35;
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec3 rd = normalize(uCam*vec3(uv,1.5));
  vec3 ro = uEye;
  vec2 h = trace(ro,rd);
  vec3 col;
  if(h.x<0.0){ col = skyCol(rd); }
  else {
    vec3 p = ro+rd*h.x;
    vec3 n = calcN(p,h.x);
    col = shade(p,n,rd,h.y,h.x);
    col = mix(col, skyCol(rd), 1.0-exp(-0.0016*h.x*h.x));
  }
  col = col/(1.0+col*0.28);
  col = pow(max(col,0.0),vec3(0.4545));
  col *= 1.0-0.16*dot(uv,uv);
  O = vec4(col,1.0);
}`;

  const gl = canvas.getContext('webgl2', {
    antialias: false, depth: false, stencil: false, alpha: false,
    preserveDrawingBuffer: false, powerPreference: 'high-performance'
  });
  if (!gl) throw new Error('createPelicanSdf: WebGL2 is not available on this canvas.');

  let yaw = 0.72, pitch = 0.26, dist = 4.9;
  const TGT = [0.30, 1.30, 0.0];
  let prog = null, vao = null, buf = null, loc = null, lost = false, disposed = false;

  const clampP = v => Math.max(-1.45, Math.min(1.45, v));
  const clampD = v => Math.max(0.9, Math.min(16.0, v));

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('createPelicanSdf: shader compilation failed: ' + log);
    }
    return s;
  }

  function build() {
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('createPelicanSdf: program link failed: ' + log);
    }
    prog = p;
    buf = gl.createBuffer();
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    loc = {
      res: gl.getUniformLocation(prog, 'uRes'),
      t: gl.getUniformLocation(prog, 'uT'),
      eye: gl.getUniformLocation(prog, 'uEye'),
      cam: gl.getUniformLocation(prog, 'uCam')
    };
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }
  build();

  const m3 = new Float32Array(9);

  function render(timeSeconds) {
    if (disposed || lost || gl.isContextLost()) return;
    const w = canvas.width | 0, h = canvas.height | 0;
    if (w <= 0 || h <= 0) return;
    const t = (typeof timeSeconds === 'number' && isFinite(timeSeconds)) ? timeSeconds : 0;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const ex = TGT[0] + dist * cp * Math.sin(yaw);
    const ey = TGT[1] + dist * sp;
    const ez = TGT[2] + dist * cp * Math.cos(yaw);
    let fx = TGT[0] - ex, fy = TGT[1] - ey, fz = TGT[2] - ez;
    const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    let rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0;
    const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    m3[0] = rx; m3[1] = ry; m3[2] = rz;
    m3[3] = ux; m3[4] = uy; m3[5] = uz;
    m3[6] = fx; m3[7] = fy; m3[8] = fz;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.uniform2f(loc.res, w, h);
    gl.uniform1f(loc.t, t);
    gl.uniform3f(loc.eye, ex, ey, ez);
    gl.uniformMatrix3fv(loc.cam, false, m3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  const pointers = new Map();
  let pinch = 0;

  function pinchLen() {
    const v = Array.from(pointers.values());
    if (v.length < 2) return 0;
    return Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
  }
  function onDown(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
    if (canvas.focus) canvas.focus();
    if (pointers.size === 2) pinch = pinchLen();
    e.preventDefault();
  }
  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      yaw -= dx * 0.0075;
      pitch = clampP(pitch + dy * 0.0075);
    } else if (pointers.size === 2) {
      const d = pinchLen();
      if (pinch > 0 && d > 0) dist = clampD(dist * pinch / d);
      pinch = d;
    }
    e.preventDefault();
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    pinch = pinchLen();
    if (canvas.releasePointerCapture) { try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} }
  }
  function onWheel(e) {
    dist = clampD(dist * Math.exp(e.deltaY * 0.0012 * (e.deltaMode === 1 ? 16 : 1)));
    e.preventDefault();
  }
  function onKey(e) {
    let used = true;
    const k = e.key;
    if (k === 'ArrowLeft') yaw -= 0.09;
    else if (k === 'ArrowRight') yaw += 0.09;
    else if (k === 'ArrowUp') pitch = clampP(pitch + 0.07);
    else if (k === 'ArrowDown') pitch = clampP(pitch - 0.07);
    else if (k === '+' || k === '=' || k === 'PageUp') dist = clampD(dist * 0.88);
    else if (k === '-' || k === '_' || k === 'PageDown') dist = clampD(dist / 0.88);
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }
  function onLost(e) { e.preventDefault(); lost = true; }
  function onRestored() {
    lost = false;
    try { build(); } catch (_) { lost = true; }
  }
  function onCtx(e) { e.preventDefault(); }

  if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
  if (canvas.style) { canvas.style.touchAction = 'none'; canvas.style.outline = canvas.style.outline || 'none'; }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('contextmenu', onCtx);
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  return {
    render,
    setView(y, p, d) {
      if (typeof y === 'number' && isFinite(y)) yaw = y;
      if (typeof p === 'number' && isFinite(p)) pitch = clampP(p);
      if (typeof d === 'number' && isFinite(d)) dist = clampD(d);
    },
    getView() { return { yaw: yaw, pitch: pitch, distance: dist }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('contextmenu', onCtx);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      pointers.clear();
      try {
        if (vao) gl.deleteVertexArray(vao);
        if (buf) gl.deleteBuffer(buf);
        if (prog) gl.deleteProgram(prog);
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      } catch (_) {}
      vao = null; buf = null; prog = null;
    }
  };
}
