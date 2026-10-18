export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    antialias: false, alpha: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  });
  if (!gl) throw new Error("PelicanSDF: WebGL2 is not available");

  const VS = `#version 300 es
void main(){
  vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

  const FS = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_ro;
uniform vec3 u_ta;
out vec4 O;
#define PI 3.14159265359

float sdSphere(vec3 p,float r){return length(p)-r;}
float sdEllipsoid(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.0)/k1;}
float sdCapsule(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a;vec3 ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*h)-r;}
float sdBox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r;}
float sdTorusZ(vec3 p,float R,float r){return length(vec2(length(p.xy)-R,p.z))-r;}
float sdCylZ(vec3 p,float R,float h){vec2 d=vec2(length(p.xy)-R,abs(p.z)-h);return min(max(d.x,d.y),0.0)+length(max(d,0.0));}
float sdRoundCone(vec3 p,vec3 a,vec3 b,float r1,float r2){
  vec3 ba=b-a; float l2=dot(ba,ba); float rr=r1-r2; float a2=l2-rr*rr; float il2=1.0/l2;
  vec3 pa=p-a; float y=dot(pa,ba); float z=y-l2;
  vec3 xx=pa*l2-ba*y; float x2=dot(xx,xx); float y2=y*y*l2; float z2=z*z*l2;
  float k=sign(rr)*rr*rr*x2;
  if(sign(z)*a2*z2>k) return sqrt(x2+z2)*il2-r2;
  if(sign(y)*a2*y2<k) return sqrt(x2+y2)*il2-r1;
  return (sqrt(x2*a2*il2)+y*rr)*il2-r1;
}
vec3 rotZ(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
vec2 u2(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 s2(vec2 a,vec2 b,float k){
  float h=clamp(0.5+0.5*(b.x-a.x)/k,0.0,1.0);
  return vec2(mix(b.x,a.x,h)-k*h*(1.0-h),mix(b.y,a.y,h));
}

vec2 wheel(vec3 p,float R){
  float a=u_time*0.9;
  vec3 q=p; q.xy=mat2(cos(a),sin(a),-sin(a),cos(a))*q.xy;
  vec2 r=vec2(sdTorusZ(p,R-0.055,0.055),7.0);
  r=min(r,vec2(sdTorusZ(p,R-0.13,0.024),8.0));
  r=min(r,vec2(sdCylZ(p,0.055,0.05),8.0));
  float rad=length(q.xy);
  float an=atan(q.y,q.x);
  float N=8.0;
  float aa=mod(an+PI/N,2.0*PI/N)-PI/N;
  float sp=sdCapsule(vec3(rad,aa*rad,q.z),vec3(0.05,0.0,0.0),vec3(R-0.115,0.0,0.0),0.011);
  r=min(r,vec2(sp,8.0));
  return r;
}

vec2 map(vec3 p){
  vec2 r=vec2(p.y,0.0);

  r=min(r,wheel(p-vec3( 0.75,0.45,0.0),0.45));
  r=min(r,wheel(p-vec3(-0.75,0.45,0.0),0.45));

  vec3 m=vec3(p.x,p.y,abs(p.z));
  float f;

  f=sdCapsule(m,vec3( 0.05,0.40,0.040),vec3(-0.75,0.45,0.040),0.020); r=min(r,vec2(f,6.0));
  f=sdCapsule(m,vec3(-0.75,0.45,0.032),vec3(-0.32,0.99,0.022),0.018); r=min(r,vec2(f,6.0));
  f=sdCapsule(p,vec3( 0.05,0.40,0.0),vec3(-0.32,1.03,0.0),0.027);     r=min(r,vec2(f,6.0));
  f=sdCapsule(p,vec3(-0.32,1.03,0.0),vec3( 0.50,1.09,0.0),0.023);     r=min(r,vec2(f,6.0));
  f=sdCapsule(p,vec3( 0.06,0.38,0.0),vec3( 0.54,0.90,0.0),0.026);     r=min(r,vec2(f,6.0));
  f=sdCapsule(p,vec3( 0.50,1.10,0.0),vec3( 0.58,0.86,0.0),0.029);     r=min(r,vec2(f,6.0));
  f=sdCapsule(m,vec3( 0.58,0.86,0.045),vec3( 0.75,0.45,0.045),0.019); r=min(r,vec2(f,6.0));
  f=sdCapsule(p,vec3( 0.51,1.10,0.0),vec3( 0.60,1.22,0.0),0.022);     r=min(r,vec2(f,8.0));
  f=sdCapsule(p,vec3( 0.60,1.22,-0.26),vec3( 0.60,1.22,0.26),0.019);  r=min(r,vec2(f,8.0));
  f=sdCapsule(m,vec3( 0.60,1.215,0.17),vec3( 0.60,1.20,0.30),0.026);  r=min(r,vec2(f,9.0));
  f=sdBox(p-vec3(-0.33,1.07,0.0),vec3(0.10,0.015,0.075),0.035);       r=min(r,vec2(f,9.0));

  float ph=u_time*1.6;
  vec2 bbc=vec2(0.05,0.40);
  vec2 c1=vec2(cos(ph),sin(ph))*0.155;
  vec2 P1=bbc+c1;
  vec2 P2=bbc-c1;

  f=sdCapsule(p,vec3(bbc,0.075),vec3(P1,0.075),0.016);   r=min(r,vec2(f,8.0));
  f=sdCapsule(p,vec3(bbc,-0.075),vec3(P2,-0.075),0.016); r=min(r,vec2(f,8.0));
  f=sdBox(p-vec3(P1,0.075),vec3(0.048,0.008,0.042),0.008); r=min(r,vec2(f,9.0));
  f=sdBox(p-vec3(P2,-0.075),vec3(0.048,0.008,0.042),0.008);r=min(r,vec2(f,9.0));
  f=sdCylZ(p-vec3(bbc,0.075),0.105,0.010);               r=min(r,vec2(f,8.0));
  f=sdCylZ(p-vec3(-0.75,0.45,0.075),0.052,0.010);        r=min(r,vec2(f,8.0));
  f=sdCapsule(p,vec3(bbc.x,bbc.y+0.105,0.075),vec3(-0.75,0.502,0.075),0.009); r=min(r,vec2(f,8.0));
  f=sdCapsule(p,vec3(bbc.x,bbc.y-0.105,0.075),vec3(-0.75,0.398,0.075),0.009); r=min(r,vec2(f,8.0));

  vec2 q=vec2(sdEllipsoid(rotZ(p-vec3(-0.22,1.34,0.0),0.25),vec3(0.36,0.235,0.215)),1.0);
  q=s2(q,vec2(sdEllipsoid(rotZ(p-vec3(-0.02,1.30,0.0),0.45),vec3(0.21,0.21,0.19)),1.0),0.12);
  q=s2(q,vec2(sdRoundCone(p,vec3(-0.45,1.40,0.0),vec3(-0.74,1.52,0.0),0.13,0.03),1.0),0.10);
  q=s2(q,vec2(sdCapsule(p,vec3(-0.10,1.42,0.0),vec3(0.10,1.79,0.0),0.115),1.0),0.11);
  q=s2(q,vec2(sdEllipsoid(rotZ(p-vec3(0.16,1.90,0.0),0.16),vec3(0.17,0.155,0.14)),1.0),0.08);
  q=s2(q,vec2(sdRoundCone(p,vec3(0.24,1.92,0.0),vec3(0.76,1.79,0.0),0.085,0.020),2.0),0.045);
  q=s2(q,vec2(sdEllipsoid(rotZ(p-vec3(0.44,1.68,0.0),0.24),vec3(0.27,0.125,0.095)),10.0),0.06);
  vec3 e=vec3(p.x,p.y,abs(p.z));
  q=min(q,vec2(sdSphere(e-vec3(0.225,1.965,0.105),0.046),3.0));
  vec3 wv=vec3(p.x,p.y,abs(p.z));
  vec2 wg=vec2(sdCapsule(wv,vec3(0.02,1.44,0.225),vec3(-0.60,1.30,0.205),0.10),4.0);
  wg=s2(wg,vec2(sdCapsule(wv,vec3(-0.60,1.30,0.205),vec3(-0.79,1.13,0.185),0.055),4.0),0.10);
  q=s2(q,wg,0.07);

  vec2 H=vec2(-0.16,1.12);
  vec2 K1=(H+P1)*0.5+vec2(0.15,0.06);
  vec2 K2=(H+P2)*0.5+vec2(0.15,0.06);
  vec2 lg=vec2(sdCapsule(p,vec3(H,0.145),vec3(K1,0.155),0.058),5.0);
  lg=min(lg,vec2(sdCapsule(p,vec3(K1,0.155),vec3(P1.x,P1.y+0.055,0.085),0.042),5.0));
  lg=min(lg,vec2(sdCapsule(p,vec3(H,-0.145),vec3(K2,-0.155),0.058),5.0));
  lg=min(lg,vec2(sdCapsule(p,vec3(K2,-0.155),vec3(P2.x,P2.y+0.055,-0.085),0.042),5.0));
  lg=min(lg,vec2(sdEllipsoid(p-vec3(P1.x,P1.y+0.058,0.085),vec3(0.08,0.028,0.048)),5.0));
  lg=min(lg,vec2(sdEllipsoid(p-vec3(P2.x,P2.y+0.058,-0.085),vec3(0.08,0.028,0.048)),5.0));
  q=min(q,lg);

  return min(r,q);
}

vec3 calcNormal(vec3 p){
  const vec2 e=vec2(1.0,-1.0)*0.0015;
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);
}

float calcAO(vec3 p,vec3 n){
  float occ=0.0,sca=1.0;
  for(int i=0;i<5;i++){
    float h=0.012+0.13*float(i);
    float d=map(p+n*h).x;
    occ+=(h-d)*sca;
    sca*=0.72;
  }
  return clamp(1.0-1.9*occ,0.0,1.0);
}

vec3 SUN=normalize(vec3(0.5,0.72,0.42));

float softShadow(vec3 ro,vec3 rd,float mint,float maxt){
  float res=1.0; float t=mint;
  for(int i=0;i<14;i++){
    float h=map(ro+rd*t).x;
    res=min(res,11.0*h/t);
    t+=clamp(h,0.02,0.30);
    if(res<0.01||t>maxt) break;
  }
  return clamp(res,0.0,1.0);
}

vec3 matColor(float m){
  if(m<0.5) return vec3(0.50,0.53,0.56);
  if(m<1.5) return vec3(0.98,0.97,0.93);
  if(m<2.5) return vec3(0.99,0.62,0.13);
  if(m<3.5) return vec3(0.03,0.03,0.04);
  if(m<4.5) return vec3(0.90,0.89,0.84);
  if(m<5.5) return vec3(0.97,0.57,0.12);
  if(m<6.5) return vec3(0.84,0.15,0.17);
  if(m<7.5) return vec3(0.06,0.06,0.07);
  if(m<8.5) return vec3(0.72,0.75,0.80);
  if(m<9.5) return vec3(0.20,0.12,0.09);
  return vec3(0.99,0.74,0.32);
}

vec3 shade(vec3 pos,vec3 nor,vec3 rd,float mat){
  vec3 base=matColor(mat);
  float occ=calcAO(pos,nor);
  float dif=clamp(dot(nor,SUN),0.0,1.0);
  float sh=1.0;
  if(dif>0.001) sh=softShadow(pos+nor*0.004,SUN,0.02,8.0);
  float sky=clamp(0.5+0.5*nor.y,0.0,1.0);
  float bnc=clamp(0.6-0.6*nor.y,0.0,1.0);

  vec3 col=vec3(0.0);
  col+=base*dif*sh*vec3(1.30,1.18,0.95)*1.25;
  col+=base*sky*occ*vec3(0.28,0.38,0.56);
  col+=base*bnc*occ*vec3(0.24,0.19,0.14)*0.75;

  float spec=0.22,spow=26.0;
  if(mat>7.5&&mat<8.5){spec=0.85;spow=64.0;}
  else if(mat>2.5&&mat<3.5){spec=1.0;spow=95.0;}
  else if(mat<0.5){spec=0.02;spow=8.0;}
  vec3 hv=normalize(SUN-rd);
  col+=vec3(1.0,0.96,0.88)*pow(clamp(dot(nor,hv),0.0,1.0),spow)*spec*sh*dif;

  float fre=pow(clamp(1.0+dot(rd,nor),0.0,1.0),4.0);
  col+=vec3(0.35,0.48,0.68)*fre*occ*0.5;
  return col;
}

vec3 bg(vec3 rd){
  float t=clamp(rd.y,-1.0,1.0);
  vec3 col=mix(vec3(0.87,0.88,0.83),vec3(0.27,0.47,0.82),smoothstep(-0.05,0.62,t));
  float s=clamp(dot(rd,SUN),0.0,1.0);
  col+=vec3(1.0,0.86,0.62)*pow(s,32.0)*0.7;
  col+=vec3(1.0,0.90,0.72)*pow(s,5.0)*0.10;
  return col;
}

void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-u_res)/u_res.y;
  vec3 ro=u_ro;
  vec3 ww=normalize(u_ta-ro);
  vec3 uu=normalize(cross(ww,vec3(0.0,1.0,0.0)));
  vec3 vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+1.9*ww);

  float t=0.0;
  vec2 h=vec2(1.0);
  bool hit=false;
  for(int i=0;i<90;i++){
    vec3 p=ro+rd*t;
    h=map(p);
    if(h.x<0.0010+0.0011*t){hit=true;break;}
    t+=h.x*0.92;
    if(t>42.0) break;
  }

  vec3 col;
  if(hit){
    vec3 pos=ro+rd*t;
    vec3 nor=calcNormal(pos);
    col=shade(pos,nor,rd,h.y);
    float fog=1.0-exp(-0.0011*t*t);
    col=mix(col,bg(rd),clamp(fog,0.0,0.75));
  }else{
    col=bg(rd);
  }
  col=pow(clamp(col,0.0,1.0),vec3(0.4545));
  O=vec4(col,1.0);
}`;

  let prog = null, vao = null, uRes = null, uTime = null, uRo = null, uTa = null;
  let lost = false;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error("PelicanSDF shader compilation failed: " + log);
    }
    return s;
  }

  function build() {
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error("PelicanSDF program link failed: " + log);
    }
    prog = p;
    uRes = gl.getUniformLocation(p, "u_res");
    uTime = gl.getUniformLocation(p, "u_time");
    uRo = gl.getUniformLocation(p, "u_ro");
    uTa = gl.getUniformLocation(p, "u_ta");
    vao = gl.createVertexArray();
  }

  build();

  const target = [-0.12, 0.98, 0.0];
  let yaw = 0.62, pitch = 0.26, dist = 3.4;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function camPos() {
    const cp = Math.cos(pitch);
    return [
      target[0] + dist * Math.sin(yaw) * cp,
      Math.max(0.12, target[1] + dist * Math.sin(pitch)),
      target[2] + dist * Math.cos(yaw) * cp
    ];
  }

  function render(t) {
    if (lost || !prog) return;
    const w = canvas.width | 0, h = canvas.height | 0;
    if (w <= 0 || h <= 0) return;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, typeof t === "number" && isFinite(t) ? t : 0);
    const c = camPos();
    gl.uniform3f(uRo, c[0], c[1], c[2]);
    gl.uniform3f(uTa, target[0], target[1], target[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setView(y, p, d) {
    if (typeof y === "number" && isFinite(y)) yaw = y;
    if (typeof p === "number" && isFinite(p)) pitch = clamp(p, -1.5, 1.5);
    if (typeof d === "number" && isFinite(d)) dist = clamp(d, 0.4, 25);
  }

  function getView() { return { yaw: yaw, pitch: pitch, distance: dist }; }

  /* ---------------- input ---------------- */
  canvas.tabIndex = 0;
  canvas.style.touchAction = "none";
  canvas.style.outline = "none";

  const pointers = new Map();
  let lastPinch = 0;

  function pinchDist() {
    const it = pointers.values();
    const a = it.next().value, b = it.next().value;
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
    try { canvas.focus(); } catch (_) {}
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) lastPinch = pinchDist();
    e.preventDefault();
  }

  function onPointerMove(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    if (pointers.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      yaw -= dx * 0.0075;
      pitch = clamp(pitch + dy * 0.0075, -1.5, 1.5);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    } else {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const d = pinchDist();
        if (lastPinch > 0 && d > 0) dist = clamp(dist * (lastPinch / d), 0.4, 25);
        lastPinch = d;
      }
    }
    e.preventDefault();
  }

  function endPointer(e) {
    pointers.delete(e.pointerId);
    lastPinch = pointers.size === 2 ? pinchDist() : 0;
    if (pointers.size === 0) lastPinch = 0;
  }

  function onWheel(e) {
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= 100;
    dist = clamp(dist * Math.exp(d * 0.0012), 0.4, 25);
  }

  function onKeyDown(e) {
    const k = e.key;
    let used = true;
    if (k === "ArrowLeft") yaw += 0.12;
    else if (k === "ArrowRight") yaw -= 0.12;
    else if (k === "ArrowUp") pitch = clamp(pitch + 0.08, -1.5, 1.5);
    else if (k === "ArrowDown") pitch = clamp(pitch - 0.08, -1.5, 1.5);
    else if (k === "+" || k === "=") dist = clamp(dist * 0.9, 0.4, 25);
    else if (k === "-" || k === "_") dist = clamp(dist * 1.111, 0.4, 25);
    else used = false;
    if (used) e.preventDefault();
  }

  function onContextLost(e) {
    e.preventDefault();
    lost = true;
    prog = null;
    vao = null;
  }

  function onContextRestored() {
    lost = false;
    try { build(); } catch (_) { prog = null; }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("lostpointercapture", endPointer);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextlost", onContextLost, false);
  canvas.addEventListener("webglcontextrestored", onContextRestored, false);

  function dispose() {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", endPointer);
    canvas.removeEventListener("pointercancel", endPointer);
    canvas.removeEventListener("lostpointercapture", endPointer);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    try {
      if (prog) gl.deleteProgram(prog);
      if (vao) gl.deleteVertexArray(vao);
    } catch (_) {}
    prog = null;
    vao = null;
  }

  return { render, setView, getView, dispose };
}
