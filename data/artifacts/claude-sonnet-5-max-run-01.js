export function createPelicanSdf(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) {
    throw new Error('WebGL2 is not available on this canvas.');
  }

  const VS = `#version 300 es
layout(location=0) in vec2 aPos;
void main(){
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

  const FS = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam;
out vec4 fragColor;

vec2 rot2(vec2 v, float a){
  float c = cos(a), s = sin(a);
  return vec2(c*v.x - s*v.y, s*v.x + c*v.y);
}
float sdSphere(vec3 p, float r){ return length(p) - r; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h) - r;
}
float sdCapsuleX(vec3 p, float hx, float r){
  p.x -= clamp(p.x, -hx, hx);
  return length(p) - r;
}
float sdTorusX(vec3 p, float R, float r){
  vec2 q = vec2(length(p.yz) - R, p.x);
  return length(q) - r;
}
float sdEllipsoid(vec3 p, vec3 r){
  float k0 = length(p/r);
  float k1 = length(p/(r*r));
  return k0*(k0-1.0)/max(k1,1e-4);
}
float sdRoundCone(vec3 p, float r1, float r2, float h){
  vec2 q = vec2(length(p.xz), p.y);
  float b = (r1-r2)/h;
  float a = sqrt(max(1.0-b*b,0.0));
  float k = dot(q, vec2(-b,a));
  if(k < 0.0) return length(q) - r1;
  if(k > a*h) return length(q - vec2(0.0,h)) - r2;
  return dot(q, vec2(a,b)) - r1;
}
float sdConeAB(vec3 p, vec3 a, vec3 b, float r1, float r2, float flat){
  vec3 ba = b - a;
  float bl = max(length(ba), 1e-4);
  vec3 by = ba / bl;
  vec3 arb = (abs(by.y) < 0.95) ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
  vec3 bx = normalize(cross(arb, by));
  vec3 bz = cross(by, bx);
  vec3 lp = p - a;
  vec3 q = vec3(dot(lp,bx), dot(lp,by), dot(lp,bz)*flat);
  return sdRoundCone(q, r1, r2, bl);
}
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b,a,h) - k*h*(1.0-h);
}
vec2 opU(vec2 a, vec2 b){ return a.x < b.x ? a : b; }
float spokesSDF(vec3 lp, float hubR, float rimR, float th, float n){
  float ang = atan(lp.z, lp.y);
  float rad = length(lp.yz);
  float sector = 6.2831853/n;
  ang = mod(ang + sector*0.5, sector) - sector*0.5;
  vec3 q = vec3(lp.x, rad, rad*ang);
  return sdCapsule(q, vec3(0.0,hubR,0.0), vec3(0.0,rimR,0.0), th);
}

const vec3 REAR = vec3(0.0, 0.345, -0.5);
const vec3 FRONT = vec3(0.0, 0.345, 0.5);
const vec3 BB = vec3(0.0, 0.40, -0.02);
const vec3 SEATP = vec3(0.0, 0.99, -0.24);
const vec3 HEADTOP = vec3(0.0, 0.93, 0.44);
const vec3 BAR = vec3(0.0, 1.10, 0.50);

vec2 mapBike(vec3 p, float cAng, float wSpin){
  vec2 res = vec2(1e5, 0.0);
  vec3 pr = p - REAR;
  vec3 pf = p - FRONT;
  res = opU(res, vec2(sdTorusX(pr, 0.300, 0.045), 1.0));
  res = opU(res, vec2(sdTorusX(pf, 0.300, 0.045), 1.0));
  res = opU(res, vec2(sdTorusX(pr, 0.235, 0.017), 2.0));
  res = opU(res, vec2(sdTorusX(pf, 0.235, 0.017), 2.0));
  res = opU(res, vec2(sdCapsuleX(pr, 0.040, 0.045), 6.0));
  res = opU(res, vec2(sdCapsuleX(pf, 0.040, 0.045), 6.0));
  vec3 prs = vec3(pr.x, rot2(pr.yz, wSpin));
  vec3 pfs = vec3(pf.x, rot2(pf.yz, wSpin));
  res = opU(res, vec2(spokesSDF(prs, 0.06, 0.226, 0.009, 8.0), 2.0));
  res = opU(res, vec2(spokesSDF(pfs, 0.06, 0.226, 0.009, 8.0), 2.0));
  res = opU(res, vec2(sdSphere(prs - vec3(0.0,0.30,0.0), 0.016), 1.0));
  res = opU(res, vec2(sdSphere(pfs - vec3(0.0,0.30,0.0), 0.016), 1.0));
  res = opU(res, vec2(sdCapsule(p,BB,REAR,0.030), 3.0));
  res = opU(res, vec2(sdCapsule(p,SEATP,REAR,0.024), 3.0));
  res = opU(res, vec2(sdCapsule(p,BB,SEATP,0.030), 3.0));
  res = opU(res, vec2(sdCapsule(p,SEATP,HEADTOP,0.024), 3.0));
  res = opU(res, vec2(sdCapsule(p,BB,HEADTOP,0.032), 3.0));
  res = opU(res, vec2(sdCapsule(p,HEADTOP,FRONT,0.028), 3.0));
  res = opU(res, vec2(sdCapsule(p,HEADTOP,BAR,0.022), 3.0));
  vec3 barL = BAR + vec3(-0.20,-0.01,-0.02);
  vec3 barR = BAR + vec3(0.20,-0.01,-0.02);
  res = opU(res, vec2(sdCapsule(p,BAR,barL,0.017), 3.0));
  res = opU(res, vec2(sdCapsule(p,BAR,barR,0.017), 3.0));
  res = opU(res, vec2(sdSphere(p-barL, 0.026), 5.0));
  res = opU(res, vec2(sdSphere(p-barR, 0.026), 5.0));
  res = opU(res, vec2(sdEllipsoid(p-(SEATP+vec3(0.0,0.03,-0.06)), vec3(0.065,0.035,0.15)), 4.0));
  vec3 pedA = BB + vec3(0.085, cos(cAng)*0.17, sin(cAng)*0.17);
  vec3 pedB = BB + vec3(-0.085, cos(cAng+3.14159265)*0.17, sin(cAng+3.14159265)*0.17);
  res = opU(res, vec2(sdCapsule(p,BB,pedA,0.017), 5.0));
  res = opU(res, vec2(sdCapsule(p,BB,pedB,0.017), 5.0));
  res = opU(res, vec2(sdCapsuleX(p-pedA, 0.045, 0.020), 5.0));
  res = opU(res, vec2(sdCapsuleX(p-pedB, 0.045, 0.020), 5.0));
  res = opU(res, vec2(sdTorusX(p-BB, 0.15, 0.012), 6.0));
  res = opU(res, vec2(sdTorusX(pr, 0.065, 0.010), 6.0));
  res = opU(res, vec2(sdCapsule(p, BB+vec3(0.0,0.15,0.0), REAR+vec3(0.0,0.065,0.0), 0.007), 6.0));
  res = opU(res, vec2(sdCapsule(p, BB+vec3(0.0,-0.15,0.0), REAR+vec3(0.0,-0.065,0.0), 0.007), 6.0));
  return res;
}

vec2 mapPelican(vec3 p, float cAng, float t){
  vec2 res = vec2(1e5, 0.0);
  float bob = sin(cAng*2.0)*0.008;
  vec3 hip = vec3(0.0, 1.02+bob, -0.22);
  vec3 bodyC = vec3(0.0, 1.18+bob, -0.02);
  vec3 bp = p - bodyC;
  vec2 byz = rot2(bp.yz, -0.4);
  vec3 bl = vec3(bp.x, byz.x, byz.y);
  res = opU(res, vec2(sdEllipsoid(bl, vec3(0.185,0.215,0.30)), 7.0));
  vec3 tailBase = bodyC + vec3(0.0,-0.06,-0.30);
  vec3 tailTip = tailBase + vec3(0.0,-0.09,-0.24);
  res = opU(res, vec2(sdConeAB(p, tailBase, tailTip, 0.11, 0.02, 1.6), 12.0));
  vec3 neckBase = bodyC + vec3(0.0, 0.20, 0.16);
  vec3 neckMid  = neckBase + vec3(0.0, 0.16, 0.11);
  vec3 headC    = neckMid + vec3(0.0, 0.15, 0.13);
  res = opU(res, vec2(sdCapsule(p, neckBase, neckMid, 0.088), 7.0));
  res = opU(res, vec2(sdCapsule(p, neckMid, headC, 0.070), 7.0));
  vec3 hp = p - headC;
  vec2 hyz = rot2(hp.yz, -0.25);
  vec3 hl = vec3(hp.x, hyz.x, hyz.y);
  float headD = sdEllipsoid(hl, vec3(0.125,0.115,0.145));
  res = opU(res, vec2(sdSphere(p-(headC+vec3(0.10,0.035,0.11)),0.020), 9.0));
  res = opU(res, vec2(sdSphere(p-(headC+vec3(-0.10,0.035,0.11)),0.020), 9.0));
  vec3 beakBase = headC + vec3(0.0,-0.03,0.12);
  vec3 beakTip  = beakBase + vec3(0.0,-0.09,0.56);
  vec3 pouchEnd = beakBase + vec3(0.0,-0.17,0.30);
  float beakD = sdConeAB(p, beakBase, beakTip, 0.062, 0.006, 1.5);
  float pouchD = sdConeAB(p, beakBase+vec3(0.0,-0.02,0.02), pouchEnd, 0.075, 0.02, 2.0);
  float mand = smin(beakD, pouchD, 0.05);
  float headBeak = smin(headD, mand, 0.035);
  float hbId = headD < mand ? 7.0 : (beakD < pouchD ? 8.0 : 10.0);
  res = opU(res, vec2(headBeak, hbId));
  for(int s=0;s<2;s++){
    float sgn = s==0 ? 1.0 : -1.0;
    vec3 sh = bodyC + vec3(sgn*0.165, 0.09, -0.04);
    float flap = sin(t*2.0+sgn)*0.05;
    vec3 mid = bodyC + vec3(sgn*0.315, -0.03+flap*0.4, -0.22);
    vec3 tip = bodyC + vec3(sgn*0.36, -0.13+flap, -0.42);
    res = opU(res, vec2(sdConeAB(p, sh, mid, 0.075, 0.05, 1.8), 7.0));
    res = opU(res, vec2(sdConeAB(p, mid, tip, 0.05, 0.012, 1.8), 12.0));
  }
  for(int s=0;s<2;s++){
    float sgn = s==0 ? 1.0 : -1.0;
    float ca = cAng + (s==0 ? 0.0 : 3.14159265);
    vec3 hipJ = hip + vec3(sgn*0.095, 0.02, 0.03);
    vec3 ped = BB + vec3(sgn*0.085, cos(ca)*0.17, sin(ca)*0.17);
    vec3 knee = hipJ + vec3(sgn*0.02, -0.10, 0.15) + vec3(0.0,-0.02*cos(ca), 0.02*sin(ca));
    res = opU(res, vec2(sdCapsule(p,hipJ,knee,0.042), 8.0));
    res = opU(res, vec2(sdCapsule(p,knee,ped,0.030), 8.0));
    vec3 fp = p - (ped+vec3(0.0,-0.02,0.02));
    vec2 fyz = rot2(fp.yz, 0.3);
    vec3 fl = vec3(fp.x, fyz.x, fyz.y);
    res = opU(res, vec2(sdEllipsoid(fl, vec3(0.028,0.018,0.075)), 8.0));
  }
  return res;
}

vec2 mapAll(vec3 p, float t){
  float cAng = t*2.4;
  float wSpin = t*1.8;
  vec3 c = vec3(0.0,0.9,0.12);
  float bd = length(p-c) - 1.5;
  vec2 obj;
  if(bd > 0.02){
    obj = vec2(bd,0.0);
  } else {
    obj = opU(mapBike(p,cAng,wSpin), mapPelican(p,cAng,t));
  }
  return opU(obj, vec2(p.y, 11.0));
}

vec3 calcNormal(vec3 p, float t){
  vec2 e = vec2(0.0015,-0.0015);
  return normalize(
    e.xyy*mapAll(p+e.xyy,t).x +
    e.yyx*mapAll(p+e.yyx,t).x +
    e.yxy*mapAll(p+e.yxy,t).x +
    e.xxx*mapAll(p+e.xxx,t).x
  );
}

vec2 rayMarch(vec3 ro, vec3 rd, float t){
  float d = 0.0;
  float id = -1.0;
  for(int i=0;i<80;i++){
    vec3 p = ro+rd*d;
    vec2 res = mapAll(p,t);
    float e = 0.0009*max(d,1.0);
    if(res.x < e){ id = res.y; break; }
    d += res.x*0.88;
    if(d > 18.0) break;
  }
  return vec2(d,id);
}

float softShadow(vec3 ro, vec3 rd, float t){
  float res = 1.0;
  float d = 0.02;
  for(int i=0;i<20;i++){
    float h = mapAll(ro+rd*d, t).x;
    res = min(res, 12.0*h/d);
    d += clamp(h,0.012,0.25);
    if(res < 0.02 || d > 6.0) break;
  }
  return clamp(res,0.0,1.0);
}

float calcAO(vec3 p, vec3 n, float t){
  float occ = 0.0, sca = 1.0;
  for(int i=0;i<4;i++){
    float h = 0.02+0.09*float(i);
    float d = mapAll(p+n*h,t).x;
    occ += (h-d)*sca;
    sca *= 0.72;
  }
  return clamp(1.0-1.6*occ,0.0,1.0);
}

void getMat(float id, vec3 p, out vec3 albedo, out float shin, out float metal, out float fres){
  if(id<1.5){ albedo=vec3(0.03,0.03,0.032); shin=10.0; metal=0.0; fres=0.04; }
  else if(id<2.5){ albedo=vec3(0.74,0.75,0.78); shin=70.0; metal=0.85; fres=0.35; }
  else if(id<3.5){ albedo=vec3(0.74,0.10,0.09); shin=48.0; metal=0.25; fres=0.2; }
  else if(id<4.5){ albedo=vec3(0.07,0.05,0.05); shin=12.0; metal=0.05; fres=0.05; }
  else if(id<5.5){ albedo=vec3(0.10,0.10,0.11); shin=38.0; metal=0.4; fres=0.15; }
  else if(id<6.5){ albedo=vec3(0.58,0.58,0.60); shin=75.0; metal=0.8; fres=0.3; }
  else if(id<7.5){ albedo=vec3(0.93,0.93,0.90); shin=20.0; metal=0.0; fres=0.08; }
  else if(id<8.5){ albedo=vec3(0.95,0.56,0.07); shin=32.0; metal=0.05; fres=0.15; }
  else if(id<9.5){ albedo=vec3(0.02,0.02,0.02); shin=95.0; metal=0.1; fres=0.4; }
  else if(id<10.5){ albedo=vec3(0.84,0.43,0.37); shin=22.0; metal=0.0; fres=0.2; }
  else if(id<11.5){
    float chk = mod(floor(p.x*1.6)+floor(p.z*1.6),2.0);
    albedo = mix(vec3(0.26,0.30,0.25), vec3(0.32,0.36,0.30), chk);
    shin=6.0; metal=0.0; fres=0.02;
  } else { albedo=vec3(0.5,0.5,0.53); shin=16.0; metal=0.0; fres=0.1; }
}

vec3 skyColor(vec3 rd){
  float tt = clamp(rd.y*0.5+0.5,0.0,1.0);
  vec3 col = mix(vec3(0.80,0.86,0.92), vec3(0.28,0.52,0.86), pow(tt,0.7));
  float sun = pow(max(dot(rd, normalize(vec3(0.55,0.78,0.35))),0.0), 48.0);
  col += vec3(1.0,0.85,0.6)*sun*0.7;
  return col;
}

vec3 shade(vec3 p, vec3 n, vec3 rd, float id, float t){
  vec3 albedo; float shin, metal, fres;
  getMat(id, p, albedo, shin, metal, fres);
  vec3 lightDir = normalize(vec3(0.55,0.78,0.35));
  vec3 viewDir = -rd;
  float ao = calcAO(p,n,t);
  float sh = softShadow(p+n*0.004, lightDir, t);
  float ndotl = max(dot(n,lightDir),0.0);
  vec3 halfV = normalize(lightDir+viewDir);
  float spec = pow(max(dot(n,halfV),0.0), shin) * (0.25+0.9*metal);
  float frz = pow(1.0-max(dot(n,viewDir),0.0), 5.0)*fres;
  vec3 skyCol = vec3(0.55,0.72,0.95);
  vec3 groundCol = vec3(0.30,0.26,0.20);
  vec3 hemi = mix(groundCol, skyCol, 0.5+0.5*n.y);
  vec3 col = albedo*hemi*0.55*ao;
  col += albedo*vec3(1.08,1.0,0.92)*ndotl*sh;
  col += vec3(1.0,0.97,0.9)*spec*sh;
  col += frz*mix(vec3(1.0),albedo,0.5)*sh;
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float yaw = uCam.x, pitch = uCam.y, dist = uCam.z;
  vec3 target = vec3(0.0,0.86,0.10);
  vec3 camPos = target + dist*vec3(cos(pitch)*cos(yaw), sin(pitch), cos(pitch)*sin(yaw));
  vec3 fwd = normalize(target - camPos);
  vec3 rt = normalize(cross(fwd, vec3(0.0,1.0,0.0)));
  vec3 up = cross(rt, fwd);
  float focal = 2.2;
  vec3 rd = normalize(uv.x*rt + uv.y*up + focal*fwd);
  vec2 rm = rayMarch(camPos, rd, uTime);
  vec3 col;
  if(rm.y > -0.5){
    vec3 p = camPos + rd*rm.x;
    vec3 n = calcNormal(p, uTime);
    col = shade(p, n, rd, rm.y, uTime);
    col = mix(col, skyColor(rd), smoothstep(8.0,18.0,rm.x));
  } else {
    col = skyColor(rd);
  }
  col = pow(clamp(col,0.0,4.0), vec3(0.4545));
  fragColor = vec4(col,1.0);
}
`;

  function compileShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('Shader compile error: ' + info);
    }
    return sh;
  }

  function createProgram(vsSrc, fsSrc) {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error('Program link error: ' + info);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  }

  let prog = null, vao = null, buf = null;
  let uRes = null, uTime = null, uCam = null;
  let lost = false;
  let disposed = false;

  function setupGL() {
    prog = createProgram(VS, FS);
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    uRes = gl.getUniformLocation(prog, 'uRes');
    uTime = gl.getUniformLocation(prog, 'uTime');
    uCam = gl.getUniformLocation(prog, 'uCam');
  }

  setupGL();

  const MIN_DIST = 0.55;
  const MAX_DIST = 9.0;
  const PITCH_LIMIT = 1.45;

  let yaw = 0.7, pitch = 0.30, dist = 3.3;

  function clampPitch(v) { return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, v)); }
  function clampDist(v) { return Math.min(MAX_DIST, Math.max(MIN_DIST, v)); }

  canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  canvas.style.outline = 'none';

  const pointers = new Map();
  let dragLast = null;
  let pinchStartDist = 0;
  let pinchStartZoom = 0;

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function onPointerDown(e) {
    canvas.focus();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    pointers.set(e.pointerId, pointerPos(e));
    if (pointers.size === 1) {
      dragLast = pointerPos(e);
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      pinchStartDist = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      pinchStartZoom = dist;
      dragLast = null;
    }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, pointerPos(e));
    if (pointers.size >= 2) {
      const pts = Array.from(pointers.values());
      const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      if (pinchStartDist > 1e-3) {
        dist = clampDist(pinchStartZoom * (pinchStartDist / Math.max(d, 1e-3)));
      }
    } else if (pointers.size === 1 && dragLast) {
      const p = pointerPos(e);
      const dx = p[0] - dragLast[0], dy = p[1] - dragLast[1];
      yaw += dx * 0.0075;
      pitch = clampPitch(pitch - dy * 0.0075);
      dragLast = p;
    }
    e.preventDefault();
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    if (pointers.size === 1) {
      dragLast = Array.from(pointers.values())[0];
    } else {
      dragLast = null;
    }
    if (pointers.size < 2) pinchStartDist = 0;
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.0015);
    dist = clampDist(dist * factor);
  }

  function onKeyDown(e) {
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': yaw -= 0.12; break;
      case 'ArrowRight': yaw += 0.12; break;
      case 'ArrowUp': pitch = clampPitch(pitch + 0.08); break;
      case 'ArrowDown': pitch = clampPitch(pitch - 0.08); break;
      case '+': case '=': dist = clampDist(dist * 0.9); break;
      case '-': case '_': dist = clampDist(dist * 1.1); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  function onCtxLost(e) {
    e.preventDefault();
    lost = true;
  }
  function onCtxRestored() {
    try {
      setupGL();
      lost = false;
    } catch (err) {
      lost = true;
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('webglcontextlost', onCtxLost, false);
  canvas.addEventListener('webglcontextrestored', onCtxRestored, false);

  function render(timeSeconds) {
    if (disposed || lost || gl.isContextLost()) return;
    const w = canvas.width, h = canvas.height;
    if (w <= 0 || h <= 0 || !prog) return;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, typeof timeSeconds === 'number' ? timeSeconds : 0);
    gl.uniform3f(uCam, yaw, pitch, dist);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  function setView(y, p, d) {
    if (typeof y === 'number' && isFinite(y)) yaw = y;
    if (typeof p === 'number' && isFinite(p)) pitch = clampPitch(p);
    if (typeof d === 'number' && isFinite(d)) dist = clampDist(d);
  }

  function getView() {
    return { yaw: yaw, pitch: pitch, distance: dist };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('webglcontextlost', onCtxLost);
    canvas.removeEventListener('webglcontextrestored', onCtxRestored);
    if (vao) gl.deleteVertexArray(vao);
    if (buf) gl.deleteBuffer(buf);
    if (prog) gl.deleteProgram(prog);
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }

  return { render, setView, getView, dispose };
}
