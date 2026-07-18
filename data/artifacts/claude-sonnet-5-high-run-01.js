export function createPelicanSdf(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available on this canvas.');

  const vsSource = `#version 300 es
layout(location=0) in vec2 aPos;
void main(){ gl_Position = vec4(aPos,0.0,1.0); }`;

  const fsSource = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uEye, uRight, uUp, uFwd;
uniform float uTanFov;

float dot2(vec3 v){ return dot(v,v); }
float sdSphere(vec3 p,float r){ return length(p)-r; }
float sdEllipsoid(vec3 p, vec3 r){
  float k0=length(p/r);
  float k1=length(p/(r*r));
  return k0*(k0-1.0)/max(k1,1e-6);
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){
  vec3 pa=p-a, ba=b-a;
  float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h)-r;
}
float sdTorusZ(vec3 p, vec2 t){
  vec2 q=vec2(length(p.xy)-t.x, p.z);
  return length(q)-t.y;
}
float sdBox(vec3 p, vec3 b){
  vec3 q=abs(p)-b;
  return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
}
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba=b-a;
  float l2=dot(ba,ba);
  float rr=r1-r2;
  float a2=l2-rr*rr;
  float il2=1.0/max(l2,1e-6);
  vec3 pa=p-a;
  float y=dot(pa,ba);
  float z=y-l2;
  float x2=dot2(pa*l2-ba*y);
  float y2=y*y*l2;
  float z2=z*z*l2;
  float k=sign(rr)*rr*rr*x2;
  if(sign(z)*a2*z2>k) return sqrt(x2+z2)*il2 - r2;
  if(sign(y)*a2*y2<k) return sqrt(x2+y2)*il2 - r1;
  return (sqrt(max(x2*a2*il2,0.0))+y*rr)*il2 - r1;
}
float smin(float a,float b,float k){
  float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);
  return mix(b,a,h)-k*h*(1.0-h);
}
vec2 opU(vec2 a, vec2 b){ return a.x<b.x?a:b; }
vec2 opUs(vec2 a, vec2 b, float k){
  float d=smin(a.x,b.x,k);
  float m=a.x<b.x?a.y:b.y;
  return vec2(d,m);
}
vec2 rotXY(vec2 v, float a){ float c=cos(a), s=sin(a); return vec2(c*v.x-s*v.y, s*v.x+c*v.y); }

vec3 kneePos(vec3 H, vec3 F, float L1, float L2){
  vec3 HF=F-H;
  float dl=max(length(HF),0.0001);
  float d=clamp(dl, abs(L1-L2)+0.001, L1+L2-0.001);
  vec3 dir=HF/dl;
  float a=(L1*L1-L2*L2+d*d)/(2.0*d);
  float h=sqrt(max(L1*L1-a*a,0.0));
  vec3 mid=H+dir*a;
  vec3 pole=vec3(1.0,0.25,0.0);
  vec3 perp=pole-dir*dot(pole,dir);
  float pl=length(perp);
  perp = pl>0.0001 ? perp/pl : vec3(0.0,1.0,0.0);
  return mid+perp*h;
}

vec2 mapWheel(vec3 p, vec3 hub){
  vec3 q=p-hub;
  float tire=sdTorusZ(q, vec2(0.5,0.09));
  float rim=sdTorusZ(q, vec2(0.30,0.04));
  vec2 res=vec2(tire,1.0);
  res=opU(res, vec2(rim,2.0));
  return res;
}
float frameSdf(vec3 p){
  vec3 q=p; q.z=abs(q.z);
  float d=1e5;
  d=min(d, sdCapsule(q, vec3(-1.05,0.55,0.06), vec3(-0.15,0.62,0.06), 0.040));
  d=min(d, sdCapsule(q, vec3(-1.05,0.55,0.06), vec3(-0.42,1.32,0.06), 0.035));
  d=min(d, sdCapsule(q, vec3(1.05,0.55,0.05), vec3(0.85,1.08,0.0), 0.038));
  d=min(d, sdCapsule(p, vec3(-0.15,0.62,0.0), vec3(-0.42,1.32,0.0), 0.045));
  d=min(d, sdCapsule(p, vec3(-0.42,1.32,0.0), vec3(0.85,1.08,0.0), 0.040));
  d=min(d, sdCapsule(p, vec3(-0.15,0.62,0.0), vec3(0.85,1.02,0.0), 0.045));
  d=min(d, sdCapsule(p, vec3(0.85,1.08,0.0), vec3(0.95,1.32,0.0), 0.038));
  return d;
}
float handlebarSdf(vec3 p){
  vec3 c=p-vec3(0.95,1.32,0.0);
  float bar=sdCapsule(c, vec3(0.0,0.0,-0.26), vec3(0.0,0.0,0.26), 0.028);
  float bl=sdCapsule(c, vec3(0.0,0.0,-0.26), vec3(0.15,-0.02,-0.28), 0.025);
  float br=sdCapsule(c, vec3(0.0,0.0,0.26), vec3(0.15,-0.02,0.28), 0.025);
  return min(bar,min(bl,br));
}
float seatSdf(vec3 p){
  vec3 c=p-vec3(-0.42,1.38,0.0);
  return sdEllipsoid(c, vec3(0.22,0.06,0.10));
}

vec2 map(vec3 p){
  vec2 res=vec2(p.y, 11.0);
  res=opU(res, mapWheel(p, vec3(1.05,0.55,0.0)));
  res=opU(res, mapWheel(p, vec3(-1.05,0.55,0.0)));
  res=opU(res, vec2(frameSdf(p), 3.0));
  res=opU(res, vec2(handlebarSdf(p), 3.0));
  res=opU(res, vec2(seatSdf(p), 4.0));

  float ang=uTime*2.4;
  vec3 bb=vec3(-0.15,0.62,0.0);
  vec2 off1=vec2(cos(ang),sin(ang))*0.26;
  vec2 off2=-off1;
  vec3 pedal1Pos=bb+vec3(off1,0.16);
  vec3 pedal2Pos=bb+vec3(off2,-0.16);
  float chainring=sdTorusZ(p-bb-vec3(0.0,0.0,0.14), vec2(0.17,0.016));
  float crankArm1=sdCapsule(p, bb+vec3(0.0,0.0,0.16), pedal1Pos, 0.026);
  float crankArm2=sdCapsule(p, bb+vec3(0.0,0.0,-0.16), pedal2Pos, 0.026);
  float pedalBox1=sdBox(p-pedal1Pos, vec3(0.09,0.02,0.05));
  float pedalBox2=sdBox(p-pedal2Pos, vec3(0.09,0.02,0.05));
  res=opU(res, vec2(chainring,9.0));
  res=opU(res, vec2(min(crankArm1,crankArm2),9.0));
  res=opU(res, vec2(min(pedalBox1,pedalBox2),9.0));

  float bob=sin(uTime*2.4)*0.015;
  float tilt=0.32;
  vec3 bc=vec3(-0.22,1.80+bob,0.0);
  vec3 pl=p-bc;
  pl.xy=rotXY(pl.xy,-tilt);
  float body=sdEllipsoid(pl, vec3(0.40,0.52,0.30));

  vec3 neckA=vec3(0.05,1.98+bob,0.0);
  vec3 neckB=vec3(0.48,2.20+bob,0.0);
  float neck=sdRoundCone(p,neckA,neckB,0.155,0.115);

  vec3 headC=vec3(0.56,2.30+bob,0.0);
  float head=sdSphere(p-headC,0.195);

  vec3 beakA=vec3(0.66,2.31+bob,0.0);
  vec3 beakB=vec3(1.42,2.10+bob,0.0);
  float beakUp=sdRoundCone(p,beakA,beakB,0.09,0.012);

  vec3 pouchC=vec3(0.90,2.06+bob,0.0);
  float pouch=sdEllipsoid(p-pouchC, vec3(0.30,0.14,0.17));

  vec2 res2=opUs(vec2(body,5.0), vec2(neck,5.0), 0.12);
  res2=opUs(res2, vec2(head,5.0), 0.08);
  vec2 beakAll=opUs(vec2(beakUp,6.0), vec2(pouch,6.0), 0.09);
  res2=opU(res2, beakAll);

  vec3 eyeP=p-headC; eyeP.z=abs(eyeP.z);
  float eye=sdSphere(eyeP-vec3(0.10,0.05,0.13),0.032);
  res2=opU(res2, vec2(eye,7.0));

  vec3 wp=p; wp.z=abs(wp.z);
  vec3 wingA=vec3(-0.05,1.98+bob,0.30);
  vec3 wingB=vec3(-0.80,1.52+bob,0.46);
  float wing=sdRoundCone(wp,wingA,wingB,0.16,0.045);
  res2=opU(res2, vec2(wing,10.0));

  vec3 tailA=vec3(-0.62,1.75+bob,0.0);
  vec3 tailB=vec3(-0.98,1.92+bob,0.0);
  float tail=sdRoundCone(p,tailA,tailB,0.13,0.02);
  res2=opUs(res2, vec2(tail,5.0), 0.06);

  res=opU(res, res2);

  vec3 hip1=vec3(-0.10,1.50+bob,0.14);
  vec3 hip2=vec3(-0.10,1.50+bob,-0.14);
  vec3 knee1=kneePos(hip1, pedal1Pos, 0.5,0.5);
  vec3 knee2=kneePos(hip2, pedal2Pos, 0.5,0.5);
  float leg1=min(sdRoundCone(p,hip1,knee1,0.085,0.06), sdRoundCone(p,knee1,pedal1Pos,0.06,0.045));
  float leg2=min(sdRoundCone(p,hip2,knee2,0.085,0.06), sdRoundCone(p,knee2,pedal2Pos,0.06,0.045));
  res=opU(res, vec2(min(leg1,leg2), 8.0));

  return res;
}

vec3 calcNormal(vec3 p){
  vec2 e=vec2(1.0,-1.0)*0.0015;
  return normalize(e.xyy*map(p+e.xyy).x + e.yyx*map(p+e.yyx).x + e.yxy*map(p+e.yxy).x + e.xxx*map(p+e.xxx).x);
}
float softShadow(vec3 ro, vec3 rd){
  float res=1.0, t=0.02;
  for(int i=0;i<14;i++){
    float h=map(ro+rd*t).x;
    res=min(res, 8.0*h/t);
    t+=clamp(h,0.02,0.25);
    if(h<0.001||t>7.0) break;
  }
  return clamp(res,0.0,1.0);
}
float calcAO(vec3 p, vec3 n){
  float occ=0.0, sca=1.0;
  for(int i=0;i<4;i++){
    float h=0.01+0.12*float(i)/3.0;
    float d=map(p+n*h).x;
    occ+=(h-d)*sca;
    sca*=0.7;
  }
  return clamp(1.0-1.5*occ,0.0,1.0);
}
vec3 materialColor(float id){
  if(id<1.5) return vec3(0.03,0.03,0.035);
  if(id<2.5) return vec3(0.75,0.76,0.78);
  if(id<3.5) return vec3(0.10,0.16,0.34);
  if(id<4.5) return vec3(0.05,0.04,0.04);
  if(id<5.5) return vec3(0.93,0.92,0.88);
  if(id<6.5) return vec3(0.92,0.55,0.10);
  if(id<7.5) return vec3(0.02,0.02,0.02);
  if(id<8.5) return vec3(0.85,0.45,0.10);
  if(id<9.5) return vec3(0.15,0.15,0.17);
  if(id<10.5) return vec3(0.80,0.80,0.78);
  return vec3(0.16,0.22,0.14);
}
vec2 rayMarch(vec3 ro, vec3 rd){
  float t=0.0;
  for(int i=0;i<64;i++){
    vec3 p=ro+rd*t;
    vec2 h=map(p);
    if(h.x<0.0008*t+0.0006){ return vec2(t,h.y); }
    t+=max(h.x*0.9,0.0008);
    if(t>40.0) break;
  }
  return vec2(40.0,-1.0);
}
void main(){
  vec2 uv=(gl_FragCoord.xy/uRes)*2.0-1.0;
  uv.x*=uRes.x/uRes.y;
  vec3 rd=normalize(uFwd + uv.x*uTanFov*uRight + uv.y*uTanFov*uUp);
  vec3 ro=uEye;
  vec2 hit=rayMarch(ro,rd);
  vec3 col;
  if(hit.y<0.0){
    float t=clamp(rd.y*0.5+0.5,0.0,1.0);
    col=mix(vec3(0.65,0.72,0.80), vec3(0.18,0.33,0.55), t);
    float sun=clamp(dot(rd, normalize(vec3(0.4,0.6,0.3))),0.0,1.0);
    col+=vec3(1.0,0.9,0.7)*pow(sun,64.0)*0.6;
  } else {
    vec3 p=ro+rd*hit.x;
    vec3 n=calcNormal(p);
    vec3 albedo=materialColor(hit.y);
    vec3 lightDir=normalize(vec3(0.5,0.8,0.3));
    float diff=clamp(dot(n,lightDir),0.0,1.0);
    float sh=softShadow(p+n*0.02, lightDir);
    float ao=calcAO(p,n);
    vec3 ambient=vec3(0.30,0.33,0.38)*ao;
    float rim=pow(1.0-clamp(dot(n,-rd),0.0,1.0),3.0)*0.25;
    float spec=pow(clamp(dot(reflect(-lightDir,n),-rd),0.0,1.0),24.0)*0.25;
    col=albedo*(ambient+diff*sh*vec3(1.05,1.0,0.92)) + vec3(1.0)*spec*sh + vec3(0.6,0.7,0.9)*rim;
    float fog=1.0-exp(-0.0025*hit.x*hit.x);
    col=mix(col, vec3(0.55,0.65,0.78), fog*0.6);
  }
  col=pow(max(col,0.0), vec3(0.4545));
  outColor=vec4(col,1.0);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile error: ' + info);
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    throw new Error('Program link error: ' + info);
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uEye = gl.getUniformLocation(prog, 'uEye');
  const uRight = gl.getUniformLocation(prog, 'uRight');
  const uUp = gl.getUniformLocation(prog, 'uUp');
  const uFwd = gl.getUniformLocation(prog, 'uFwd');
  const uTanFov = gl.getUniformLocation(prog, 'uTanFov');

  let yaw = 0.6, pitch = 0.25, dist = 6.5;
  const target = [-0.05, 1.2, 0.0];
  const MIN_DIST = 0.6, MAX_DIST = 16.0;
  const MIN_PITCH = -1.3, MAX_PITCH = 1.3;

  function clampView() {
    if (pitch < MIN_PITCH) pitch = MIN_PITCH;
    if (pitch > MAX_PITCH) pitch = MAX_PITCH;
    if (dist < MIN_DIST) dist = MIN_DIST;
    if (dist > MAX_DIST) dist = MAX_DIST;
  }
  clampView();

  function normalize3(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  let dragging = false, lastX = 0, lastY = 0, activePointerId = null;
  canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  canvas.style.outline = 'none';

  function onPointerDown(e) {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    activePointerId = e.pointerId;
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    canvas.focus();
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    yaw += dx * 0.008;
    pitch += dy * 0.008;
    clampView();
    e.preventDefault();
  }
  function onPointerUp(e) {
    dragging = false;
    if (activePointerId != null && canvas.releasePointerCapture) {
      try { canvas.releasePointerCapture(activePointerId); } catch (err) {}
    }
    activePointerId = null;
  }
  function onWheel(e) {
    dist *= Math.pow(1.0015, e.deltaY);
    clampView();
    e.preventDefault();
  }
  function onKeyDown(e) {
    let handled = true;
    if (e.key === 'ArrowLeft') yaw -= 0.12;
    else if (e.key === 'ArrowRight') yaw += 0.12;
    else if (e.key === 'ArrowUp') pitch -= 0.08;
    else if (e.key === 'ArrowDown') pitch += 0.08;
    else if (e.key === '+' || e.key === '=') dist *= 0.9;
    else if (e.key === '-' || e.key === '_') dist *= 1.1;
    else handled = false;
    if (handled) { clampView(); e.preventDefault(); }
  }

  let pinchDist = null;
  function touchDist(e) {
    const t0 = e.touches[0], t1 = e.touches[1];
    return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
  }
  function onTouchStart(e) {
    if (e.touches.length === 2) pinchDist = touchDist(e);
    e.preventDefault();
  }
  function onTouchMove(e) {
    if (e.touches.length === 2 && pinchDist != null) {
      const d = touchDist(e);
      dist *= pinchDist / Math.max(d, 1e-4);
      pinchDist = d;
      clampView();
      e.preventDefault();
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) pinchDist = null;
  }
  function onContextMenu(e) { e.preventDefault(); }

  let contextLost = false;
  function onContextLost(e) { e.preventDefault(); contextLost = true; }
  function onContextRestored(e) { contextLost = false; }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  function render(timeSeconds) {
    if (contextLost || gl.isContextLost()) return;
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);

    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const ex = target[0] + dist * cp * sy;
    const ey = target[1] + dist * sp;
    const ez = target[2] + dist * cp * cy;
    const fwd = normalize3([target[0] - ex, target[1] - ey, target[2] - ez]);
    let right = cross3(fwd, [0, 1, 0]);
    const rl = Math.hypot(right[0], right[1], right[2]);
    right = rl < 1e-6 ? [1, 0, 0] : [right[0] / rl, right[1] / rl, right[2] / rl];
    const up = cross3(right, fwd);

    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, timeSeconds || 0);
    gl.uniform3f(uEye, ex, ey, ez);
    gl.uniform3f(uRight, right[0], right[1], right[2]);
    gl.uniform3f(uUp, up[0], up[1], up[2]);
    gl.uniform3f(uFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform1f(uTanFov, 0.546);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  function setView(y, p, d) {
    yaw = y; pitch = p; dist = d;
    clampView();
  }
  function getView() {
    return { yaw: yaw, pitch: pitch, distance: dist };
  }
  function dispose() {
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    if (!gl.isContextLost()) {
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
    }
  }

  return { render, setView, getView, dispose };
}
