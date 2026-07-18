export function createPelicanSdf(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, alpha: false, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL2 unavailable');

  let yaw = 0.85, pitch = 0.35, distance = 9.5;
  let disposed = false, ctxLost = false;
  const pointers = new Map();
  let prevPinch = 0;

  const VS = `#version 300 es
in vec2 a;
void main(){gl_Position=vec4(a,0.,1.);}`;

  const FS = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 R;
uniform float T;
uniform vec3 C0,CU,CR,CF;
uniform float CD;

float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
mat2 ro(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
float sdSph(vec3 p,float r){return length(p)-r;}
float sdEll(vec3 p,vec3 r){float k0=length(p/r);return k0*(k0-1.)/length(p/(r*r));}
float sdCyl(vec3 p,float h,float r){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
float sdCylX(vec3 p,float h,float r){return sdCyl(p.yxz,h,r);}
float sdCylZ(vec3 p,float h,float r){return sdCyl(p.xzy,h,r);}
float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y);return length(q)-t.y;}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sdCapsule(vec3 a,vec3 b,float r){vec3 pa=a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdCone(vec3 p,vec2 c,float h){vec2 q=h*vec2(c.x/c.y,-1.);vec2 w=vec2(length(p.xz),p.y);vec2 a=w-q*clamp(dot(w,q)/dot(q,q),0.,1.);vec2 b=w-q*vec2(clamp(w.x/q.x,0.,1.),1.);float k=sign(q.y);float d=min(dot(a,a),dot(b,b));float s=max(k*(w.x*q.y-w.y*q.x),k*(w.y-q.y));return sqrt(d)*sign(s);}

float wheel(vec3 p,float th){
  float tire=sdTorus(p,vec2(.72,.09));
  float rim=sdTorus(p,vec2(.62,.03));
  float hub=sdCylZ(p,.04,.1);
  float sp=1e3;
  for(int i=0;i<8;i++){
    float a=float(i)*3.14159265/4.+th;
    vec3 q=p;q.xy=ro(a)*q.xy;
    sp=min(sp,sdBox(q-vec3(.31,0.,0.),vec3(.31,.018,.018)));
  }
  return min(tire,min(rim,min(hub,sp)));
}

float bicycle(vec3 p,out float mat){
  float d=1e3;mat=1.;
  vec3 w1=p-vec3(1.35,-.85,0.);
  vec3 w2=p-vec3(-1.25,-.85,0.);
  float fw=wheel(w1,0.);
  float rw=wheel(w2,.4);
  float wheels=min(fw,rw);
  if(wheels<d){d=wheels;mat=1.;}

  float chainring=sdCylZ(p-vec3(.05,-.55,0.),.03,.22);
  float pedL=sdCapsule(vec3(.05,-.55,.0)+vec3(cos(T*2.),sin(T*2.),0.)*.28,
    vec3(.05,-.55,.18)+vec3(cos(T*2.),sin(T*2.),0.)*.28,.04);
  float pedR=sdCapsule(vec3(.05,-.55,.0)+vec3(cos(T*2.+3.14),sin(T*2.+3.14),0.)*.28,
    vec3(.05,-.55,-.18)+vec3(cos(T*2.+3.14),sin(T*2.+3.14),0.)*.28,.04);
  float crank=min(chainring,min(pedL,pedR));
  float cog=sdCylZ(w2,.03,.08);
  crank=min(crank,cog);
  if(crank<d){d=crank;mat=2.;}

  float dt=sdCapsule(vec3(1.35,-.85,0.),vec3(.2,-.1,0.),.045);
  float st=sdCapsule(vec3(-1.25,-.85,0.),vec3(-.35,-.05,0.),.045);
  float tt=sdCapsule(vec3(.2,-.1,0.),vec3(-.35,-.05,0.),.04);
  float seatst=sdCapsule(vec3(-.35,-.05,0.),vec3(-.55,.55,0.),.04);
  float hdst=sdCapsule(vec3(.2,-.1,0.),vec3(.55,.55,0.),.04);
  float cs=sdCapsule(vec3(-1.25,-.85,0.),vec3(-.55,.55,0.),.035);
  float frame=min(dt,min(st,min(tt,min(seatst,min(hdst,cs)))));
  float seat=sdEll(p-vec3(-.6,.72,0.),vec3(.28,.07,.14));
  frame=min(frame,seat);
  vec3 hp=p-vec3(.55,.7,0.);
  float hbar=sdCylX(hp,.55,.035);
  float gripL=sdSph(hp-vec3(0.,0.,.55),.05);
  float gripR=sdSph(hp-vec3(0.,0.,-.55),.05);
  float stem=sdCapsule(vec3(.55,.55,0.),vec3(.55,.7,0.),.03);
  frame=min(frame,min(hbar,min(gripL,min(gripR,stem))));
  if(frame<d){d=frame;mat=3.;}

  float axleF=sdCylZ(w1,.12,.04);
  float axleR=sdCylZ(w2,.12,.04);
  float ax=min(axleF,axleR);
  if(ax<d){d=ax;mat=2.;}
  return d;
}

float pelican(vec3 p,out float mat){
  float d=1e3;mat=4.;
  vec3 bp=p-vec3(-.15,.95,0.);
  float body=sdEll(bp,vec3(.7,.45,.38));
  float chest=sdEll(bp-vec3(.35,-.05,0.),vec3(.35,.38,.32));
  body=smin(body,chest,.2);
  if(body<d){d=body;mat=4.;}

  vec3 np=bp-vec3(.55,.35,0.);
  float neck=sdCapsule(vec3(.4,-.05,0.),vec3(.75,.55,0.),.12);
  neck=smin(neck,sdEll(np-vec3(.2,.55,0.),vec3(.22,.2,.2)),.1);
  if(neck<d){d=neck;mat=4.;}

  vec3 hp=np-vec3(.22,.58,0.);
  float head=sdEll(hp,vec3(.2,.18,.17));
  if(head<d){d=head;mat=4.;}

  float eye=sdSph(hp-vec3(.12,.06,.14),.045);
  float eye2=sdSph(hp-vec3(.12,.06,-.14),.045);
  eye=min(eye,eye2);
  if(eye<d){d=eye;mat=5.;}

  vec3 bk=hp-vec3(.15,-.02,0.);
  float beakTop=sdEll(bk-vec3(.45,0.,0.),vec3(.5,.06,.1));
  float beakBot=sdEll(bk-vec3(.4,-.08,0.),vec3(.42,.05,.09));
  float pouch=sdEll(bk-vec3(.3,-.18,0.),vec3(.35,.14,.12));
  float beak=smin(beakTop,smin(beakBot,pouch,.08),.06);
  if(beak<d){d=beak;mat=6.;}

  vec3 wp=bp-vec3(-.1,.1,0.);
  vec3 wl=wp;wl.z-=.25;wl.xy=ro(-.3)*wl.xy;
  float wingL=sdEll(wl,vec3(.55,.18,.08));
  vec3 wr=wp;wr.z+=.25;wr.xy=ro(-.3)*wr.xy;
  float wingR=sdEll(wr,vec3(.55,.18,.08));
  float wings=min(wingL,wingR);
  if(wings<d){d=wings;mat=7.;}

  float legL=sdCapsule(vec3(-.2,.55,.12),vec3(-.35,.15,.15),.045);
  float legR=sdCapsule(vec3(-.05,.55,-.1),vec3(.15,.05,-.12),.045);
  float footL=sdEll(p-vec3(-.38,.12,.15),vec3(.1,.03,.08));
  float footR=sdEll(p-vec3(.18,.02,-.12),vec3(.1,.03,.08));
  float legs=min(min(legL,legR),min(footL,footR));
  if(legs<d){d=legs;mat=8.;}

  float tail=sdEll(bp-vec3(-.7,-.05,0.),vec3(.25,.12,.16));
  if(tail<d){d=tail;mat=7.;}
  return d;
}

float map(vec3 p,out float mat){
  float mb;float db=bicycle(p,mb);
  float mp;float dp=pelican(p,mp);
  if(db<dp){mat=mb;return db;}
  mat=mp;return dp;
}

float mapN(vec3 p){float m;return map(p,m);}

vec3 calcN(vec3 p){
  const float e=8e-4;
  return normalize(vec3(
    mapN(p+vec3(e,0,0))-mapN(p-vec3(e,0,0)),
    mapN(p+vec3(0,e,0))-mapN(p-vec3(0,e,0)),
    mapN(p+vec3(0,0,e))-mapN(p-vec3(0,0,e))
  ));
}

float softShadow(vec3 ro,vec3 rd,float tmax){
  float res=1.;float t=.05;
  for(int i=0;i<48;i++){
    float h=mapN(ro+rd*t);
    res=min(res,16.*h/t);
    t+=clamp(h,.03,.2);
    if(res<.01||t>tmax)break;
  }
  return clamp(res,0.,1.);
}

float ao(vec3 p,vec3 n){
  float occ=0.;float sc=1.;
  for(int i=0;i<5;i++){
    float h=.02+.12*float(i);
    occ+=(h-mapN(p+n*h))*sc;
    sc*=.7;
  }
  return clamp(1.-1.5*occ,0.,1.);
}

vec3 sky(vec3 rd){
  float h=rd.y*.5+.5;
  vec3 col=mix(vec3(.75,.85,.95),vec3(.35,.55,.9),h);
  col=mix(col,vec3(1.,.9,.75),pow(max(dot(rd,normalize(vec3(.4,.3,.7))),0.),8.)*.4);
  float g=smoothstep(-.05,.05,rd.y);
  col=mix(vec3(.55,.62,.45),col,g);
  return col;
}

vec3 shade(vec3 p,vec3 rd,float mat,float t){
  vec3 n=calcN(p);
  vec3 lp=normalize(vec3(.5,.85,.4));
  vec3 lcol=vec3(1.,.96,.9);
  float dif=max(dot(n,lp),0.);
  float sh=softShadow(p+n*.02,lp,12.);
  float amb=ao(p,n);
  float fre=pow(1.-max(dot(n,-rd),0.),3.);
  float spe=pow(max(dot(reflect(rd,n),lp),0.),32.);
  vec3 alb=vec3(.7);
  if(mat<1.5) alb=vec3(.08,.08,.1);
  else if(mat<2.5) alb=vec3(.55,.52,.48);
  else if(mat<3.5) alb=vec3(.75,.2,.15);
  else if(mat<4.5) alb=vec3(.95,.95,.97);
  else if(mat<5.5) alb=vec3(.05,.05,.08);
  else if(mat<6.5) alb=vec3(.95,.75,.2);
  else if(mat<7.5) alb=vec3(.85,.85,.9);
  else alb=vec3(.95,.7,.15);
  if(mat>3.5&&mat<4.5){
    float spots=sin(p.x*18.)*sin(p.y*15.)*sin(p.z*18.);
    alb=mix(alb,vec3(.7,.72,.78),smoothstep(.4,.7,spots)*.3);
  }
  vec3 col=alb*(dif*sh*lcol*.9+amb*vec3(.45,.5,.6)*.55);
  col+=lcol*spe*sh*(mat<3.5?.4:.15);
  col+=fre*vec3(.3,.4,.55)*.15;
  col=mix(col,sky(rd),1.-exp(-.012*t*t));
  return col;
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;
  vec3 ro=C0;
  vec3 rd=normalize(uv.x*CR+uv.y*CU+1.6*CF);
  float t=0.;float mat=0.;bool hit=false;
  for(int i=0;i<96;i++){
    vec3 p=ro+rd*t;
    float m;float d=map(p,m);
    if(d<.001){hit=true;mat=m;break;}
    t+=d;
    if(t>40.)break;
  }
  vec3 col=sky(rd);
  if(hit) col=shade(ro+rd*t,rd,mat,t);
  col=pow(clamp(col,0.,1.),vec3(.92));
  O=vec4(col,1.);
}`;

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

  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'a');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Shader link failed: ' + gl.getProgramInfoLog(prog));
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const uR = gl.getUniformLocation(prog, 'R');
  const uT = gl.getUniformLocation(prog, 'T');
  const uC0 = gl.getUniformLocation(prog, 'C0');
  const uCU = gl.getUniformLocation(prog, 'CU');
  const uCR = gl.getUniformLocation(prog, 'CR');
  const uCF = gl.getUniformLocation(prog, 'CF');
  const uCD = gl.getUniformLocation(prog, 'CD');

  canvas.tabIndex = 0;
  canvas.style.outline = 'none';
  canvas.style.touchAction = 'none';

  function onLost(e) { e.preventDefault(); ctxLost = true; }
  function onRestored() { ctxLost = false; }

  function clampView() {
    pitch = Math.max(-1.4, Math.min(1.4, pitch));
    distance = Math.max(1.2, Math.min(22, distance));
  }

  function orbit(dx, dy) {
    yaw += dx * 0.008;
    pitch += dy * 0.008;
    clampView();
  }

  function zoom(f) {
    distance *= f;
    clampView();
  }

  function onPointerDown(e) {
    canvas.focus();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      prevPinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const nx = e.clientX, ny = e.clientY;
    if (pointers.size === 1) {
      orbit(nx - prev.x, ny - prev.y);
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: nx, y: ny });
      const pts = [...pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (prevPinch > 0) zoom(prevPinch / d);
      prevPinch = d;
    }
    pointers.set(e.pointerId, { x: nx, y: ny });
    e.preventDefault();
  }
  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) prevPinch = 0;
  }
  function onWheel(e) {
    zoom(e.deltaY > 0 ? 1.08 : 0.92);
    e.preventDefault();
  }
  function onKey(e) {
    const step = 0.08;
    let handled = true;
    if (e.key === 'ArrowLeft') yaw -= step;
    else if (e.key === 'ArrowRight') yaw += step;
    else if (e.key === 'ArrowUp') pitch += step;
    else if (e.key === 'ArrowDown') pitch -= step;
    else if (e.key === '+' || e.key === '=') zoom(0.92);
    else if (e.key === '-' || e.key === '_') zoom(1.08);
    else handled = false;
    if (handled) { clampView(); e.preventDefault(); }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  function camera() {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const tx = 0.1, ty = 0.35, tz = 0;
    const ox = distance * cp * sy;
    const oy = distance * sp;
    const oz = distance * cp * cy;
    const eye = [tx + ox, ty + oy, tz + oz];
    const fw = [tx - eye[0], ty - eye[1], tz - eye[2]];
    const fl = Math.hypot(fw[0], fw[1], fw[2]) || 1;
    fw[0] /= fl; fw[1] /= fl; fw[2] /= fl;
    const up0 = [0, 1, 0];
    let rx = fw[1] * up0[2] - fw[2] * up0[1];
    let ry = fw[2] * up0[0] - fw[0] * up0[2];
    let rz = fw[0] * up0[1] - fw[1] * up0[0];
    let rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    const ux = ry * fw[2] - rz * fw[1];
    const uy = rz * fw[0] - rx * fw[2];
    const uz = rx * fw[1] - ry * fw[0];
    return { eye, right: [rx, ry, rz], up: [ux, uy, uz], fwd: fw };
  }

  function render(timeSeconds) {
    if (disposed || ctxLost) return;
    const w = canvas.width, h = canvas.height;
    if (w < 1 || h < 1) return;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const cam = camera();
    gl.uniform2f(uR, w, h);
    gl.uniform1f(uT, timeSeconds);
    gl.uniform3fv(uC0, cam.eye);
    gl.uniform3fv(uCU, cam.up);
    gl.uniform3fv(uCR, cam.right);
    gl.uniform3fv(uCF, cam.fwd);
    gl.uniform1f(uCD, distance);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setView(y, p, d) {
    yaw = y; pitch = p; distance = d;
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
    canvas.removeEventListener('keydown', onKey);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    try {
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } catch (_) {}
  }

  return { render, setView, getView, dispose };
}
