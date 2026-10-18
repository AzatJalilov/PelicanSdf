const VS = `#version 300 es
void main(){
  float x=float((gl_VertexID<<1)&2);
  float y=float(gl_VertexID&2);
  gl_Position=vec4(x*2.-1.,y*2.-1.,0.,1.);
}`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uEye,uFwd,uRight,uUp;
uniform float uFocal;
out vec4 fragColor;
const float PI=3.14159265;

vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
vec2 rot(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdTC(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(r1,r2,h);}
float sdEll(vec3 p,vec3 r){float k0=length(p/r);float k1=max(length(p/(r*r)),1e-6);return k0*(k0-1.)/k1;}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sdTor(vec3 p,float R,float r){return length(vec2(length(p.xy)-R,p.z))-r;}

vec2 wheel(vec3 p,vec3 c,float ang){
  vec3 q=p-c;
  q.xy=rot(q.xy,ang);
  vec2 r=vec2(sdTor(q,.32,.03),1.);
  r=U(r,vec2(sdTor(q,.285,.01),2.));
  float sec=PI/6.;
  float a=mod(atan(q.y,q.x),sec)-sec*.5;
  vec2 s=vec2(cos(a),sin(a))*length(q.xy);
  float sx=clamp(s.x,0.,.285);
  float sp=length(vec2(length(s-vec2(sx,0.)),q.z))-.005;
  r=U(r,vec2(sp,2.));
  r=U(r,vec2(length(q)-.045,2.));
  return r;
}

vec2 crank(vec3 p,float s){
  float ph=uTime*1.6+(s>0.?0.:PI);
  vec3 BB=vec3(-.12,.37,0.);
  vec3 P=BB+vec3(cos(ph),sin(ph),0.)*.17;
  vec2 r=vec2(sdCap(p,BB+vec3(0.,0.,s*.09),P+vec3(0.,0.,s*.09),.013),2.);
  r=U(r,vec2(sdCap(p,P+vec3(0.,0.,s*.09),P+vec3(0.,0.,s*.13),.008),2.));
  r=U(r,vec2(sdBox(p-(P+vec3(0.,0.,s*.13)),vec3(.05,.012,.028)),4.));
  return r;
}

vec2 leg(vec3 p,float s){
  float ph=uTime*1.6+(s>0.?0.:PI);
  vec3 A=vec3(-.12,.37,0.)+vec3(cos(ph),sin(ph),0.)*.17+vec3(0.,.04,s*.13);
  vec3 H=vec3(-.14,1.04,s*.1);
  vec3 d=A-H;
  float L=length(d);
  vec3 u=d/L;
  float Ln=min(L,.68);
  float a=(.014+Ln*Ln)/(2.*Ln);
  float hh=sqrt(max(.1296-a*a,0.));
  vec3 n=normalize(vec3(-u.y,u.x,0.));
  vec3 K=H+u*a+n*hh;
  vec2 r=vec2(sdTC(p,H,K,.065,.035),5.);
  r=U(r,vec2(sdTC(p,K,A,.035,.022),5.));
  r=U(r,vec2(sdCap(p,A,A+vec3(.09,-.04,0.),.02),5.));
  return r;
}

vec2 wing(vec3 p,float s){
  vec3 k=vec3(1.,1.,2.5);
  vec3 S=vec3(-.05,1.36,s*.15);
  vec3 T=vec3(.44,.96+.05*sin(uTime*5.+s),s*.2);
  float d=sdTC(p*k,S*k,T*k,.12,.03)*.4;
  return vec2(d,7.);
}

vec2 pelican(vec3 p){
  vec3 q=p-vec3(-.2,1.22,0.);
  q.xy=rot(q.xy,-.35);
  vec2 r=vec2(sdEll(q,vec3(.3,.2,.19)),6.);
  vec3 tq=p-vec3(-.5,1.16,0.);
  tq.xy=rot(tq.xy,-2.5);
  r=U(r,vec2(sdEll(tq,vec3(.17,.04,.11)),7.));
  r=U(r,vec2(sdTC(p,vec3(.1,1.3,0.),vec3(.22,1.5,0.),.11,.075),6.));
  r=U(r,vec2(sdTC(p,vec3(.22,1.5,0.),vec3(.31,1.68,0.),.075,.06),6.));
  r=U(r,vec2(sdEll(p-vec3(.33,1.8,0.),vec3(.13,.12,.11)),6.));
  float pd=sdEll(p-vec3(.52,1.5,0.),vec3(.16,.12,.085));
  float ld=sdTC(p,vec3(.34,1.74,0.),vec3(.76,1.6,0.),.04,.01);
  float bd=smin(pd,ld,.03);
  r=U(r,vec2(bd,pd<ld?8.:9.));
  r=U(r,vec2(sdTC(p,vec3(.36,1.82,0.),vec3(.84,1.64,0.),.05,.012),9.));
  r=U(r,vec2(length(p-vec3(.37,1.84,.1))-.03,10.));
  r=U(r,vec2(length(p-vec3(.38,1.84,.125))-.016,11.));
  r=U(r,wing(p,1.));
  r=U(r,wing(p,-1.));
  r=U(r,leg(p,1.));
  r=U(r,leg(p,-1.));
  return r;
}

vec2 bike(vec3 p){
  vec3 BB=vec3(-.12,.37,0.),Rh=vec3(-.55,.35,0.),Fh=vec3(.55,.35,0.);
  vec3 ST=vec3(-.3,.92,0.),HB=vec3(.38,.62,0.),HT=vec3(.42,.84,0.);
  vec2 r=wheel(p,Rh,uTime*3.);
  r=U(r,wheel(p,Fh,uTime*3.));
  float f=sdCap(p,BB,ST,.025);
  f=min(f,sdCap(p,BB,HB,.03));
  f=min(f,sdCap(p,ST,HT,.025));
  f=min(f,sdCap(p,BB,Rh,.022));
  f=min(f,sdCap(p,vec3(-.28,.84,0.),Rh,.018));
  f=min(f,sdCap(p,HB,HT,.035));
  f=min(f,sdCap(p,HB,Fh,.02));
  f=min(f,sdCap(p,HT,vec3(.46,.92,0.),.02));
  r=U(r,vec2(f,3.));
  r=U(r,vec2(sdCap(p,vec3(.46,.92,-.2),vec3(.46,.92,.2),.016),2.));
  r=U(r,vec2(sdBox(p-vec3(-.3,.98,0.),vec3(.12,.02,.04))-.01,4.));
  vec3 q=p-BB;
  r=U(r,vec2(max(length(q.xy)-.085,abs(q.z-.09)-.004),2.));
  r=U(r,vec2(sdCap(p,vec3(-.12,.46,.09),vec3(-.55,.4,.09),.005),4.));
  r=U(r,vec2(sdCap(p,vec3(-.12,.28,.09),vec3(-.55,.3,.09),.005),4.));
  r=U(r,crank(p,1.));
  r=U(r,crank(p,-1.));
  return r;
}

vec2 map(vec3 p){
  vec2 r=vec2(p.y,12.);
  float bb=sdBox(p-vec3(0.,.4,0.),vec3(.9,.42,.3));
  if(bb<.03) r=U(r,bike(p)); else r.x=min(r.x,bb);
  float pb=sdBox(p-vec3(.1,1.,0.),vec3(.85,1.05,.32));
  if(pb<.03) r=U(r,pelican(p)); else r.x=min(r.x,pb);
  return r;
}

vec3 calcN(vec3 p){
  const vec2 e=vec2(.0005,-.0005);
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);
}

float softSh(vec3 ro,vec3 rd){
  float res=1.,t=.02;
  for(int i=0;i<48;i++){
    float h=map(ro+rd*t).x;
    res=min(res,8.*h/t);
    t+=clamp(h,.01,.15);
    if(res<.01||t>4.)break;
  }
  return smoothstep(0.,1.,res);
}

float ao(vec3 p,vec3 n){
  float o=0.,s=1.;
  for(int i=1;i<=4;i++){
    float h=.04*float(i);
    o+=(h-map(p+n*h).x)*s;
    s*=.9;
  }
  return clamp(1.-2.5*o,0.,1.);
}

vec3 matCol(float id){
  if(id<1.5)return vec3(.07,.07,.08);
  if(id<2.5)return vec3(.8,.82,.85);
  if(id<3.5)return vec3(.78,.12,.1);
  if(id<4.5)return vec3(.03);
  if(id<5.5)return vec3(.95,.5,.12);
  if(id<6.5)return vec3(.94,.93,.9);
  if(id<7.5)return vec3(.6,.6,.58);
  if(id<8.5)return vec3(.98,.42,.2);
  if(id<9.5)return vec3(1.,.75,.2);
  if(id<10.5)return vec3(.97);
  if(id<11.5)return vec3(.02);
  return vec3(.5,.55,.5);
}

vec3 shade(vec3 ro,vec3 rd,float t,float id){
  vec3 p=ro+rd*t;
  vec3 n=calcN(p);
  vec3 alb=matCol(id);
  if(id>11.5)alb*=mix(.85,1.,mod(floor(p.x*3.)+floor(p.z*3.),2.));
  vec3 L=normalize(vec3(.55,.8,.45));
  float dif=max(dot(n,L),0.);
  float sh=softSh(p+n*.004,L);
  float oc=ao(p,n);
  vec3 H=normalize(L-rd);
  float spe=pow(max(dot(n,H),0.),40.)*.3*sh;
  float hs=.5+.5*n.y;
  vec3 c=alb*(1.1*dif*sh*vec3(1.,.97,.9)+.45*hs*oc*vec3(.5,.6,.75)+.1*oc);
  return c+spe;
}

void main(){
  vec2 uv=(2.*gl_FragCoord.xy-uRes)/uRes.y;
  vec3 rd=normalize(uv.x*uRight+uv.y*uUp+uFocal*uFwd);
  float t=0.,id=-1.;
  for(int i=0;i<220;i++){
    vec2 h=map(uEye+rd*t);
    if(h.x<.0002+.0003*t){id=h.y;break;}
    t+=h.x;
    if(t>30.)break;
  }
  vec3 sky=mix(vec3(.6,.72,.88),vec3(.2,.34,.62),clamp(rd.y*1.6,0.,1.));
  vec3 col=sky;
  if(id>=0.){
    col=shade(uEye,rd,t,id);
    col=mix(col,sky,1.-exp(-.008*t*t));
  }
  col=pow(clamp(col,0.,1.),vec3(.4545));
  vec2 q=gl_FragCoord.xy/uRes;
  col*=.55+.45*pow(16.*q.x*q.y*(1.-q.x)*(1.-q.y),.2);
  fragColor=vec4(col,1.);
}`;

export function createPelicanSdf(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('createPelicanSdf: a canvas element is required.');
  }
  const gl = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: false, stencil: false,
    preserveDrawingBuffer: true, powerPreference: 'high-performance'
  });
  if (!gl) throw new Error('createPelicanSdf: WebGL2 is not available.');

  const CEN = [0.05, 0.7, 0], FOC = [0.35, 1.2, 0];
  let prog = null, vao = null, disposed = false, lost = false, lastT = 0;
  let yaw = 0.7, pitch = 0.22, dist = 3.2;
  const U_ = {};

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('createPelicanSdf: shader compile failed: ' + log);
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
      throw new Error('createPelicanSdf: program link failed: ' + log);
    }
    prog = p;
    vao = gl.createVertexArray();
    for (const n of ['uRes', 'uTime', 'uEye', 'uFwd', 'uRight', 'uUp', 'uFocal']) {
      U_[n] = gl.getUniformLocation(p, n);
    }
  }

  build();

  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const clampP = (p) => Math.min(1.35, Math.max(-0.15, p));
  const clampD = (d) => Math.min(9, Math.max(0.6, d));

  function draw(t) {
    if (disposed || lost || !prog || gl.isContextLost()) return;
    lastT = Number.isFinite(t) ? t : 0;
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    gl.viewport(0, 0, w, h);
    const k0 = Math.min(1, Math.max(0, (3 - dist) / 2));
    const k = k0 * k0 * (3 - 2 * k0);
    const tg = [0, 1, 2].map((i) => CEN[i] + (FOC[i] - CEN[i]) * k);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const eye = [tg[0] + dist * Math.sin(yaw) * cp, tg[1] + dist * sp, tg[2] + dist * Math.cos(yaw) * cp];
    const fwd = norm([tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]]);
    const right = norm(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    gl.useProgram(prog);
    gl.uniform2f(U_.uRes, w, h);
    gl.uniform1f(U_.uTime, lastT);
    gl.uniform3fv(U_.uEye, eye);
    gl.uniform3fv(U_.uFwd, fwd);
    gl.uniform3fv(U_.uRight, right);
    gl.uniform3fv(U_.uUp, up);
    gl.uniform1f(U_.uFocal, 1.3);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const pts = new Map();
  let pinch = 0;
  const pinchDist = () => {
    const a = [...pts.values()];
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };

  canvas.style.touchAction = 'none';
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;

  function onDown(e) {
    if (disposed) return;
    e.preventDefault();
    try { canvas.focus({ preventScroll: true }); } catch (_) { canvas.focus(); }
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) pinch = pinchDist();
    draw(lastT);
  }

  function onMove(e) {
    const p = pts.get(e.pointerId);
    if (!p || disposed) return;
    e.preventDefault();
    const nx = e.clientX, ny = e.clientY;
    if (pts.size === 1) {
      yaw += (nx - p.x) * 0.0085;
      pitch = clampP(pitch + (ny - p.y) * 0.006);
    } else if (pts.size === 2) {
      p.x = nx; p.y = ny;
      const d = pinchDist();
      if (pinch > 0 && d > 0) dist = clampD(dist * pinch / d);
      pinch = d;
    }
    p.x = nx; p.y = ny;
    draw(lastT);
  }

  function onUp(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    pinch = pts.size === 2 ? pinchDist() : 0;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    draw(lastT);
  }

  function onWheel(e) {
    if (disposed) return;
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= 800;
    dist = clampD(dist * Math.exp(dy * 0.0015));
    draw(lastT);
  }

  function onKey(e) {
    if (disposed) return;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': yaw -= 0.06; break;
      case 'ArrowRight': yaw += 0.06; break;
      case 'ArrowUp': pitch = clampP(pitch + 0.05); break;
      case 'ArrowDown': pitch = clampP(pitch - 0.05); break;
      case '+': case '=': dist = clampD(dist * 0.92); break;
      case '-': case '_': dist = clampD(dist * 1.08); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      draw(lastT);
    }
  }

  function onLost(e) {
    e.preventDefault();
    lost = true;
  }

  function onRestored() {
    try {
      build();
      lost = false;
      draw(lastT);
    } catch (_) {
      lost = true;
    }
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    render(timeSeconds) {
      draw(timeSeconds);
    },
    setView(y, p, d) {
      if (Number.isFinite(y)) yaw = y;
      if (Number.isFinite(p)) pitch = clampP(p);
      if (Number.isFinite(d)) dist = clampD(d);
    },
    getView() {
      return { yaw, pitch, distance: dist };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      pts.clear();
      if (!gl.isContextLost()) {
        if (prog) gl.deleteProgram(prog);
        if (vao) gl.deleteVertexArray(vao);
      }
      prog = null;
      vao = null;
    }
  };
}
