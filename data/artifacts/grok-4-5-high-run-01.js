export function createPelicanSdf(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false });
  if (!gl) throw new Error('WebGL2 unavailable');

  let yaw = 0.85, pitch = 0.35, distance = 7.5;
  let disposed = false, ctxLost = false;
  const keys = new Set();
  let dragging = false, lastX = 0, lastY = 0, pointers = new Map(), pinch0 = 0, dist0 = 0;

  const vs = `#version 300 es
in vec2 a;
void main(){gl_Position=vec4(a,0.,1.);}`;

  const fs = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 R;
uniform float T;
uniform vec3 C;
uniform vec2 V;

#define PI 3.14159265
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
float sdSphere(vec3 p,float r){return length(p)-r;}
float sdEllipsoid(vec3 p,vec3 r){float k0=length(p/r);return k0*(k0-1.)/length(p/(r*r));}
float sdCapsule(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y);return length(q)-t.y;}
float sdCappedCylinder(vec3 p,float h,float r){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
float sdCone(vec3 p,vec2 c,float h){vec2 q=h*vec2(c.x/c.y,-1.);vec2 w=vec2(length(p.xz),p.y);vec2 a=w-q*clamp(dot(w,q)/dot(q,q),0.,1.);vec2 b=w-q*vec2(clamp(w.x/q.x,0.,1.),1.);float k=sign(q.y);float d=min(dot(a,a),dot(b,b));float s=max(k*(w.x*q.y-w.y*q.x),k*(w.y-q.y));return sqrt(d)*sign(s);}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sdLink(vec3 p,float le,float r1,float r2){vec3 q=vec3(p.x,max(abs(p.y)-le,0.),p.z);return length(vec2(length(q.xy)-r1,q.z))-r2;}

vec2 opU(vec2 a,vec2 b){return a.x<b.x?a:b;}

float wheel(vec3 p,float wr,float tr){
  float tire=sdTorus(p,vec2(wr,tr));
  float hub=sdCappedCylinder(p.xzy,0.04,0.12);
  float rim=abs(sdTorus(p,vec2(wr,0.02)))-0.01;
  float spokes=1e3;
  for(int i=0;i<8;i++){
    float a=float(i)*PI/8.;
    vec3 sp=p;
    sp.xy=rot(a)*sp.xy;
    spokes=min(spokes,sdCapsule(sp,vec3(0.),vec3(wr*0.92,0.,0.),0.015));
  }
  return min(tire,min(hub,min(rim,spokes)));
}

vec2 bicycle(vec3 p){
  vec2 res=vec2(1e3,0.);
  // wheels
  float rw=wheel(p-vec3(1.15,0.,0.),0.72,0.08);
  float fw=wheel(p-vec3(-1.25,0.,0.),0.72,0.08);
  res=opU(res,vec2(rw,1.));
  res=opU(res,vec2(fw,1.));
  // main frame tube (down tube + top tube + seat tube)
  float frame=sdCapsule(p,vec3(1.0,0.05,0.),vec3(-0.15,0.95,0.),0.045);
  frame=min(frame,sdCapsule(p,vec3(1.0,0.05,0.),vec3(0.15,0.0,0.),0.04));
  frame=min(frame,sdCapsule(p,vec3(0.15,0.,0.),vec3(-0.15,0.95,0.),0.042));
  // seat stays
  frame=min(frame,sdCapsule(p,vec3(1.15,0.08,0.05),vec3(-0.1,0.9,0.),0.03));
  frame=min(frame,sdCapsule(p,vec3(1.15,0.08,-0.05),vec3(-0.1,0.9,0.),0.03));
  // chain stays
  frame=min(frame,sdCapsule(p,vec3(1.15,0.05,0.06),vec3(0.15,0.,0.04),0.028));
  frame=min(frame,sdCapsule(p,vec3(1.15,0.05,-0.06),vec3(0.15,0.,-0.04),0.028));
  // head tube / fork
  frame=min(frame,sdCapsule(p,vec3(-0.85,0.85,0.),vec3(-1.25,0.08,0.),0.04));
  frame=min(frame,sdCapsule(p,vec3(-0.9,0.7,0.),vec3(-1.22,0.08,0.08),0.028));
  frame=min(frame,sdCapsule(p,vec3(-0.9,0.7,0.),vec3(-1.22,0.08,-0.08),0.028));
  // top tube front
  frame=min(frame,sdCapsule(p,vec3(-0.15,0.95,0.),vec3(-0.85,0.85,0.),0.04));
  res=opU(res,vec2(frame,2.));
  // seat
  float seat=sdEllipsoid(p-vec3(-0.12,1.12,0.),vec3(0.28,0.07,0.16));
  seat=min(seat,sdCapsule(p,vec3(-0.15,0.95,0.),vec3(-0.12,1.08,0.),0.03));
  res=opU(res,vec2(seat,3.));
  // handlebar
  float hb=sdCapsule(p,vec3(-0.85,0.85,0.),vec3(-0.95,1.05,0.),0.035);
  hb=min(hb,sdCapsule(p,vec3(-0.95,1.05,-0.38),vec3(-0.95,1.05,0.38),0.03));
  // grips curl
  hb=min(hb,sdCapsule(p,vec3(-0.95,1.05,0.38),vec3(-1.05,0.9,0.4),0.028));
  hb=min(hb,sdCapsule(p,vec3(-0.95,1.05,-0.38),vec3(-1.05,0.9,-0.4),0.028));
  res=opU(res,vec2(hb,2.));
  // crank + pedals
  float crAng=T*1.5;
  vec3 crankC=vec3(0.15,0.,0.);
  // chainring
  float cr=sdCappedCylinder((p-crankC).xzy,0.03,0.16);
  // crank arms
  vec3 p1=p-crankC;
  p1.xy=rot(crAng)*p1.xy;
  cr=min(cr,sdCapsule(p1,vec3(0.),vec3(0.,0.32,0.),0.025));
  cr=min(cr,sdCapsule(p1,vec3(0.),vec3(0.,-0.32,0.),0.025));
  // pedals
  vec3 ped1=p1-vec3(0.,0.32,0.);
  ped1.yz=rot(-crAng)*ped1.yz;
  cr=min(cr,sdBox(ped1-vec3(0.,0.,0.08),vec3(0.04,0.02,0.1)));
  vec3 ped2=p1-vec3(0.,-0.32,0.);
  ped2.yz=rot(-crAng)*ped2.yz;
  cr=min(cr,sdBox(ped2-vec3(0.,0.,-0.08),vec3(0.04,0.02,0.1)));
  res=opU(res,vec2(cr,4.));
  return res;
}

vec2 pelican(vec3 p){
  vec2 res=vec2(1e3,0.);
  // body - sitting on seat
  vec3 bp=p-vec3(-0.05,1.55,0.);
  float body=sdEllipsoid(bp,vec3(0.55,0.4,0.38));
  // chest
  body=smin(body,sdEllipsoid(bp-vec3(-0.35,0.05,0.),vec3(0.35,0.32,0.3)),0.12);
  res=opU(res,vec2(body,5.));
  // neck
  float neck=sdCapsule(p,vec3(-0.4,1.75,0.),vec3(-0.75,2.15,0.),0.12);
  neck=smin(neck,sdCapsule(p,vec3(-0.75,2.15,0.),vec3(-0.95,2.35,0.05),0.1),0.08);
  res=opU(res,vec2(neck,5.));
  // head
  vec3 hp=p-vec3(-1.05,2.45,0.05);
  float head=sdEllipsoid(hp,vec3(0.22,0.18,0.18));
  res=opU(res,vec2(head,5.));
  // eye
  float eye=sdSphere(hp-vec3(-0.12,0.06,0.12),0.055);
  res=opU(res,vec2(eye,6.));
  float pupil=sdSphere(hp-vec3(-0.15,0.07,0.15),0.025);
  res=opU(res,vec2(pupil,7.));
  // beak upper
  vec3 bk=p-vec3(-1.05,2.42,0.05);
  float beakU=sdCone((bk-vec3(-0.55,-0.02,0.)).yzx*vec3(1.,1.,-1.)+vec3(0.,0.55,0.),vec2(0.12,0.55),0.55);
  beakU=smax(beakU,-(bk.y+0.02),0.05);
  // simpler long beak via capsule+taper
  float beak=sdCapsule(p,vec3(-1.15,2.42,0.05),vec3(-1.95,2.32,0.05),0.07);
  beak=smin(beak,sdCapsule(p,vec3(-1.15,2.38,0.05),vec3(-1.95,2.28,0.05),0.055),0.04);
  // beak tip
  beak=smin(beak,sdSphere(p-vec3(-1.98,2.28,0.05),0.05),0.04);
  res=opU(res,vec2(beak,8.));
  // throat pouch
  float pouch=sdEllipsoid(p-vec3(-1.45,2.2,0.05),vec3(0.42,0.18,0.16));
  pouch=smax(pouch,-(p.y-2.05),0.08);
  res=opU(res,vec2(pouch,9.));
  // wings folded
  vec3 wp=p-vec3(0.05,1.6,0.32);
  wp.xy=rot(-0.3)*wp.xy;
  wp.yz=rot(0.4)*wp.yz;
  float wing=sdEllipsoid(wp,vec3(0.45,0.12,0.28));
  res=opU(res,vec2(wing,10.));
  vec3 wp2=p-vec3(0.05,1.6,-0.32);
  wp2.xy=rot(-0.3)*wp2.xy;
  wp2.yz=rot(-0.4)*wp2.yz;
  float wing2=sdEllipsoid(wp2,vec3(0.45,0.12,0.28));
  res=opU(res,vec2(wing2,10.));
  // tail feathers
  float tail=sdEllipsoid(p-vec3(0.55,1.5,0.),vec3(0.3,0.12,0.2));
  res=opU(res,vec2(tail,10.));
  // legs pedaling pose
  float crAng=T*1.5;
  // left leg to upper pedal area
  vec3 hipL=vec3(-0.05,1.25,0.12);
  vec3 kneeL=vec3(0.05+0.15*sin(crAng),0.7+0.1*cos(crAng),0.18);
  vec3 footL=vec3(0.15+0.05*sin(crAng),0.05+0.28*max(sin(crAng),-0.3),0.16);
  float legL=sdCapsule(p,hipL,kneeL,0.07);
  legL=smin(legL,sdCapsule(p,kneeL,footL,0.055),0.05);
  // foot on pedal
  legL=smin(legL,sdEllipsoid(p-footL,vec3(0.1,0.04,0.06)),0.03);
  res=opU(res,vec2(legL,5.));
  // right leg
  vec3 hipR=vec3(-0.05,1.25,-0.12);
  vec3 kneeR=vec3(0.05-0.15*sin(crAng),0.7-0.1*cos(crAng),-0.18);
  vec3 footR=vec3(0.15-0.05*sin(crAng),0.05-0.28*max(sin(crAng),-0.3),-0.16);
  // better foot positions matching pedals
  footR=vec3(0.15+0.32*sin(crAng+PI),0.0-0.32*cos(crAng+PI),-0.12);
  footL=vec3(0.15+0.32*sin(crAng),0.0-0.32*cos(crAng),0.12);
  kneeL=vec3(0.1+0.12*sin(crAng),0.75+0.08*cos(crAng),0.15);
  kneeR=vec3(0.1+0.12*sin(crAng+PI),0.75+0.08*cos(crAng+PI),-0.15);
  legL=sdCapsule(p,hipL,kneeL,0.07);
  legL=smin(legL,sdCapsule(p,kneeL,footL,0.055),0.05);
  legL=smin(legL,sdEllipsoid(p-footL,vec3(0.1,0.035,0.055)),0.03);
  float legR=sdCapsule(p,hipR,kneeR,0.07);
  legR=smin(legR,sdCapsule(p,kneeR,footR,0.055),0.05);
  legR=smin(legR,sdEllipsoid(p-footR,vec3(0.1,0.035,0.055)),0.03);
  res=opU(res,vec2(legL,5.));
  res=opU(res,vec2(legR,5.));
  // wings already done; webbed feet done
  // small crest
  float crest=sdEllipsoid(hp-vec3(0.05,0.14,-0.02),vec3(0.1,0.08,0.06));
  res=opU(res,vec2(crest,10.));
  return res;
}

vec2 map(vec3 p){
  vec2 res=bicycle(p);
  res=opU(res,pelican(p));
  // ground
  float ground=p.y+0.8;
  res=opU(res,vec2(ground,11.));
  return res;
}

vec3 calcN(vec3 p){
  const float e=0.0015;
  vec2 h=vec2(e,0.);
  return normalize(vec3(
    map(p+h.xyy).x-map(p-h.xyy).x,
    map(p+h.yxy).x-map(p-h.yxy).x,
    map(p+h.yyx).x-map(p-h.yyx).x
  ));
}

float softShadow(vec3 ro,vec3 rd,float mint,float maxt,float k){
  float res=1.;float t=mint;
  for(int i=0;i<48;i++){
    float h=map(ro+rd*t).x;
    res=min(res,k*h/t);
    t+=clamp(h,0.02,0.15);
    if(res<0.01||t>maxt)break;
  }
  return clamp(res,0.,1.);
}

float ao(vec3 p,vec3 n){
  float occ=0.;float sc=0.01;
  for(int i=0;i<5;i++){
    float h=0.01+0.15*float(i)/4.;
    float d=map(p+n*h).x;
    occ+=(h-d)*sc;
    sc*=2.5;
  }
  return clamp(1.-1.5*occ,0.,1.);
}

vec3 sky(vec3 rd){
  float h=rd.y*0.5+0.5;
  vec3 col=mix(vec3(0.75,0.85,0.95),vec3(0.4,0.65,0.95),h);
  col=mix(col,vec3(1.,0.9,0.75),pow(max(dot(rd,normalize(vec3(.4,.3,.7))),0.),8.)*0.35);
  // soft clouds
  float c=sin(rd.x*3.+rd.z*2.)*sin(rd.x*1.5-rd.z*2.5);
  c=smoothstep(0.2,0.8,c+rd.y*2.);
  col=mix(col,vec3(1.,0.98,0.95),c*0.25*max(rd.y,0.));
  return col;
}

vec3 matCol(float id,vec3 p){
  if(id<1.5) return vec3(0.12,0.12,0.14); // tire
  if(id<2.5) return vec3(0.75,0.2,0.12); // frame red
  if(id<3.5) return vec3(0.15,0.15,0.18); // seat
  if(id<4.5) return vec3(0.55,0.55,0.58); // crank metal
  if(id<5.5) return vec3(0.95,0.95,0.92); // pelican body white
  if(id<6.5) return vec3(0.95,0.9,0.3); // eye
  if(id<7.5) return vec3(0.05,0.05,0.08); // pupil
  if(id<8.5) return vec3(0.95,0.75,0.15); // beak
  if(id<9.5) return vec3(0.9,0.55,0.4); // pouch
  if(id<10.5) return vec3(0.85,0.85,0.88); // wings
  // ground
  float ch=mod(floor(p.x*0.8)+floor(p.z*0.8),2.);
  return mix(vec3(0.55,0.7,0.4),vec3(0.45,0.62,0.35),ch);
}

vec3 render(vec3 ro,vec3 rd){
  vec2 res=vec2(0.);
  float t=0.05;
  bool hit=false;
  for(int i=0;i<100;i++){
    vec3 p=ro+rd*t;
    res=map(p);
    if(abs(res.x)<0.0015*t||t>40.)break;
    t+=res.x*0.85;
  }
  vec3 col=sky(rd);
  if(t<40.&&abs(res.x)<0.05){
    hit=true;
    vec3 p=ro+rd*t;
    vec3 n=calcN(p);
    vec3 mcol=matCol(res.y,p);
    vec3 ld=normalize(vec3(0.5,0.8,0.4));
    vec3 ld2=normalize(vec3(-0.6,0.3,-0.5));
    float dif=max(dot(n,ld),0.);
    float sha=softShadow(p,ld,0.03,12.,12.);
    float fre=pow(1.-max(dot(n,-rd),0.),3.);
    float dom=max(dot(n,ld2),0.)*0.35;
    float amb=0.2+0.15*n.y;
    float occ=ao(p,n);
    float spe=pow(max(dot(reflect(-ld,n),-rd),0.),32.)*0.4;
    vec3 lin=vec3(0.);
    lin+=mcol*dif*sha*vec3(1.,0.95,0.85)*1.1;
    lin+=mcol*amb*occ*vec3(0.6,0.7,0.9);
    lin+=mcol*dom*occ*vec3(0.5,0.6,0.8);
    lin+=spe*sha*vec3(1.,0.97,0.9);
    lin+=fre*0.15*vec3(0.7,0.8,1.)*occ;
    // rim light
    lin+=mcol*pow(1.-max(dot(n,-rd),0.),2.)*0.12*vec3(0.8,0.9,1.);
    col=lin;
    // fog
    float fog=1.-exp(-0.008*t*t*0.05);
    col=mix(col,sky(rd),fog*0.35);
  }
  // ground contact shadow soft already via AO
  col=pow(clamp(col,0.,1.),vec3(0.9));
  // vignette
  vec2 q=gl_FragCoord.xy/R;
  col*=0.92+0.08*16.*q.x*q.y*(1.-q.x)*(1.-q.y);
  return col;
}

void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*R)/R.y;
  // camera from C and V: C is pos, but we use orbit via uniforms differently
  // Uniforms: C = camera position already computed on CPU, V.xy unused?
  // Actually: we receive camera eye.pos via C and target is origin-ish
  vec3 ta=vec3(0.,0.9,0.);
  vec3 ro=C;
  vec3 ww=normalize(ta-ro);
  vec3 uu=normalize(cross(ww,vec3(0.,1.,0.)));
  vec3 vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+1.8*ww);
  vec3 col=render(ro,rd);
  col=col/(1.+col*0.15);
  col=pow(col,vec3(1./2.2));
  O=vec4(col,1.);
}
`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile failed: ' + log);
    }
    return s;
  }

  const pVS = compile(gl.VERTEX_SHADER, vs);
  const pFS = compile(gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, pVS);
  gl.attachShader(prog, pFS);
  gl.bindAttribLocation(prog, 0, 'a');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Shader link failed: ' + gl.getProgramInfoLog(prog));
  }
  gl.deleteShader(pVS);
  gl.deleteShader(pFS);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const uR = gl.getUniformLocation(prog, 'R');
  const uT = gl.getUniformLocation(prog, 'T');
  const uC = gl.getUniformLocation(prog, 'C');
  const uV = gl.getUniformLocation(prog, 'V');

  canvas.tabIndex = 0;
  canvas.style.outline = 'none';
  canvas.style.touchAction = 'none';

  function camPos() {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    return [
      distance * cp * sy,
      distance * sp + 0.9,
      distance * cp * cy
    ];
  }

  function onCtxLost(e) {
    e.preventDefault();
    ctxLost = true;
  }
  function onCtxRestored() {
    ctxLost = true; // cannot fully restore easily; mark lost to skip render
  }

  function clampView() {
    pitch = Math.max(-1.2, Math.min(1.35, pitch));
    distance = Math.max(1.6, Math.min(18, distance));
    while (yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw < -Math.PI) yaw += Math.PI * 2;
  }

  function onPointerDown(e) {
    canvas.focus();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinch0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      dist0 = distance;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const pin = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch0 > 0) {
        distance = dist0 * (pinch0 / Math.max(pin, 1));
        clampView();
      }
    } else if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw += dx * 0.008;
      pitch += dy * 0.008;
      clampView();
    }
    e.preventDefault();
  }
  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch0 = 0;
    if (pointers.size === 0) dragging = false;
    else if (pointers.size === 1) {
      const pt = [...pointers.values()][0];
      dragging = true;
      lastX = pt.x;
      lastY = pt.y;
    }
  }
  function onWheel(e) {
    distance *= Math.exp(e.deltaY * 0.0015);
    clampView();
    e.preventDefault();
  }
  function onKeyDown(e) {
    keys.add(e.key);
    let handled = true;
    const step = 0.08;
    if (e.key === 'ArrowLeft') yaw -= step;
    else if (e.key === 'ArrowRight') yaw += step;
    else if (e.key === 'ArrowUp') pitch += step;
    else if (e.key === 'ArrowDown') pitch -= step;
    else if (e.key === '+' || e.key === '=') distance *= 0.92;
    else if (e.key === '-' || e.key === '_') distance *= 1.087;
    else handled = false;
    if (handled) {
      clampView();
      e.preventDefault();
    }
  }
  function onKeyUp(e) { keys.delete(e.key); }
  function onFocus() {}

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('webglcontextlost', onCtxLost);
  canvas.addEventListener('webglcontextrestored', onCtxRestored);

  function render(timeSeconds) {
    if (disposed || ctxLost) return;
    const w = canvas.width, h = canvas.height;
    if (w < 1 || h < 1) return;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uR, w, h);
    gl.uniform1f(uT, timeSeconds);
    const c = camPos();
    gl.uniform3f(uC, c[0], c[1], c[2]);
    gl.uniform2f(uV, yaw, pitch);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setView(y, p, d) {
    yaw = y;
    pitch = p;
    distance = d;
    clampView();
  }

  function getView() {
    return { yaw, pitch, distance };
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
    canvas.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('webglcontextlost', onCtxLost);
    canvas.removeEventListener('webglcontextrestored', onCtxRestored);
    try {
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } catch (_) {}
  }

  return { render, setView, getView, dispose };
}
