export function createPelicanSdf(canvas) {
  const VS = `#version 300 es
void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);}`;
  const FS = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 uR;
uniform float uT;
uniform vec3 uCP,uCX,uCY,uCZ,uPR,uPL,uKR,uKL;
uniform vec4 uA;
#define PI 3.141592653
mat2 rt(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smn(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float sg(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float rc(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return (length(pa-ba*h)-mix(r1,r2,h))*.9;}
float el(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/max(k1,1e-5);}
float tor(vec3 p,float R,float r){return length(vec2(length(p.xy)-R,p.z))-r;}
float cyl(vec3 p,float h,float r){vec2 d=vec2(length(p.xy)-r,abs(p.z)-h);return min(max(d.x,d.y),0.)+length(max(d,vec2(0.)));}
float bx(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,vec3(0.)))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float s2(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 wl(vec3 p){
vec2 r=vec2(tor(p,.9,.15),2.);
r=U(r,vec2(tor(p,.75,.045),3.));
r=U(r,vec2(cyl(p,.1,.08),3.));
vec3 q=p;q.xy=rt(uA.x)*q.xy;
float an=atan(q.y,q.x),se=PI/5.;
an=mod(an,se)-se*.5;
float ra=length(q.xy);
float sp=sg(vec3(ra*cos(an),ra*sin(an),q.z),vec3(.06,0.,0.),vec3(.73,0.,0.),.015);
return U(r,vec2(sp,3.));}
vec2 bk(vec3 p){
vec2 r=wl(p-vec3(-1.3,1.05,0.));
r=U(r,wl(p-vec3(1.3,1.05,0.)));
vec3 B=vec3(-.1,1.,0.);
vec3 pm=vec3(p.xy,abs(p.z));
float f=sg(p,vec3(-.62,2.02,0.),B,.048);
f=min(f,sg(p,vec3(-.56,1.9,0.),vec3(.9,1.87,0.),.048));
f=min(f,sg(p,vec3(1.,1.6,0.),B,.055));
f=min(f,sg(p,vec3(.92,2.,0.),vec3(1.09,1.42,0.),.06));
f=min(f,sg(pm,vec3(-.08,1.,.07),vec3(-1.28,1.05,.1),.026));
f=min(f,sg(pm,vec3(-.58,1.86,.05),vec3(-1.28,1.05,.1),.024));
f=min(f,sg(pm,vec3(1.09,1.42,.04),vec3(1.3,1.05,.08),.034));
f=min(f,sg(p,vec3(.92,2.,0.),vec3(1.02,2.2,0.),.042));
vec2 rr=vec2(f,4.);
rr=U(rr,vec2(sg(p,vec3(1.02,2.2,-.46),vec3(1.02,2.2,.46),.028),3.));
rr=U(rr,vec2(sg(pm,vec3(1.02,2.2,.29),vec3(1.02,2.2,.47),.04),5.));
float st=el(p-vec3(-.6,2.07,0.),vec3(.27,.055,.12));
st=smn(st,el(p-vec3(-.38,2.08,0.),vec3(.14,.04,.06)),.04);
rr=U(rr,vec2(st,5.));
float ch=abs(s2(p.xy,B.xy,vec2(-1.3,1.05))-.145)-.018;
ch=max(ch,abs(p.z-.12)-.022);
rr=U(rr,vec2(ch,6.));
rr=U(rr,vec2(cyl(p-vec3(-.1,1.,.12),.014,.16),6.));
rr=U(rr,vec2(cyl(p-vec3(-1.3,1.05,.12),.016,.115),6.));
float ar=cyl(p-B,.17,.045);
ar=min(ar,sg(p,vec3(B.xy,.16),vec3(uPR.xy,.16),.035));
ar=min(ar,sg(p,vec3(B.xy,-.16),vec3(uPL.xy,-.16),.035));
ar=min(ar,sg(p,vec3(uPR.xy,.16),uPR,.025));
ar=min(ar,sg(p,vec3(uPL.xy,-.16),uPL,.025));
rr=U(rr,vec2(ar,6.));
float pd=bx(p-uPR,vec3(.095,.016,.048),.014);
pd=min(pd,bx(p-uPL,vec3(.095,.016,.048),.014));
rr=U(rr,vec2(pd,5.));
return U(r,rr);}
vec2 pel(vec3 p){
float bo=uA.z;
vec3 pm=vec3(p.xy,abs(p.z));
vec3 q=p-vec3(-.4,2.52+bo,0.);
q.xy=rt(-.2)*q.xy;
float bd=el(q,vec3(.58,.45,.4));
bd=smn(bd,el(pm-vec3(-.3,2.6+bo,.3),vec3(.42,.27,.14)),.06);
bd=smn(bd,rc(p,vec3(-.8,2.6+bo,0.),vec3(-1.14,2.98+bo,0.),.16,.02),.08);
vec3 n1=vec3(.3,3.2+bo*.7,0.),n2=vec3(.4,3.62+bo*.5,0.);
float nk=rc(p,vec3(.02,2.8+bo,0.),n1,.18,.13);
nk=smn(nk,rc(p,n1,n2,.13,.12),.06);
bd=smn(bd,nk,.1);
vec3 hd=vec3(.45,3.7+bo*.5,0.);
bd=smn(bd,el(p-hd,vec3(.21,.18,.16)),.04);
vec2 r=vec2(bd,7.);
vec3 A0=vec3(-.12,2.8+bo,.3),eb=vec3(.42,2.52+bo*.5,.44),gp=vec3(1.,2.27,.4);
float wg=rc(pm,A0,eb,.16,.09);
wg=smn(wg,rc(pm,eb,gp,.09,.05),.05);
wg=smn(wg,el(pm-gp,vec3(.1,.05,.06)),.03);
r=U(r,vec2(wg,7.));
vec3 bp=p-hd;
float up=rc(bp,vec3(.14,.05,0.),vec3(1.03,-.05,0.),.06,.018);
vec2 rb=vec2(up,8.);
float po=el(bp-vec3(.45,-.2+.015*sin(uT*2.5),0.),vec3(.44,.17,.1));
po=smn(po,rc(bp,vec3(.05,-.12,0.),vec3(-.02,-.55,0.),.1,.09),.12);
rb=U(rb,vec2(po,9.));
r=U(r,rb);
r=U(r,vec2(el(pm-vec3(hd.x+.06,hd.y+.05,.12),vec3(.075,.075,.05)),9.));
r=U(r,vec2(length(pm-vec3(hd.x+.07,hd.y+.05,.14))-.045,10.));
float lg=rc(p,vec3(-.44,2.28+bo,.17),uKR,.1,.055);
lg=smn(lg,rc(p,uKR,uPR+vec3(0.,.04,0.),.055,.03),.03);
float l2=rc(p,vec3(-.44,2.28+bo,-.17),uKL,.1,.055);
l2=smn(l2,rc(p,uKL,uPL+vec3(0.,.04,0.),.055,.03),.03);
lg=min(lg,l2);
lg=min(lg,el(p-uPR-vec3(.05,.05,0.),vec3(.15,.04,.08)));
lg=min(lg,el(p-uPL-vec3(.05,.05,0.),vec3(.15,.04,.08)));
r=U(r,vec2(lg,8.));
return r;}
vec2 map(vec3 p){
vec2 r=vec2(p.y,1.);
float b=length(p-vec3(0.,1.9,0.))-3.45;
if(b>.5)return U(r,vec2(b,0.));
r=U(r,bk(p));
return U(r,pel(p));}
vec2 march(vec3 ro,vec3 rd){
float t=0.;
for(int i=0;i<128;i++){
vec2 h=map(ro+rd*t);
if(h.x<max(8e-4*t,4e-4))return vec2(t,h.y);
t+=h.x*.92;
if(t>42.)break;}
return vec2(t,-1.);}
vec3 nrm(vec3 p){
vec2 e=vec2(6e-4,-6e-4);
return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
float shad(vec3 ro,vec3 rd){
float r=1.,t=.04;
for(int i=0;i<26;i++){
float h=map(ro+rd*t).x;
r=min(r,12.*h/t);
if(r<.015)break;
t+=clamp(h,.02,.45);
if(t>11.)break;}
return clamp(r,0.,1.);}
float ao(vec3 p,vec3 n){
float o=0.,s=1.;
for(int i=1;i<6;i++){
float d=.055*float(i);
o+=(d-map(p+n*d).x)*s;s*=.62;}
return clamp(1.-1.7*o,0.,1.);}
vec3 sky(vec3 rd,vec3 L){
float h=clamp(rd.y,0.,1.);
vec3 c=mix(vec3(.84,.92,.99),vec3(.3,.55,.92),pow(h,.65));
float s=max(dot(rd,L),0.);
c+=vec3(1.,.85,.55)*(pow(s,90.)*1.2+pow(s,6.)*.15);
return c;}
void main(){
vec2 uv=(2.*gl_FragCoord.xy-uR)/uR.y;
vec3 rd=normalize(uCX*uv.x+uCY*uv.y+uCZ*2.1);
vec3 L=normalize(vec3(.55,.7,.5));
vec2 h=march(uCP,rd);
vec3 col;
if(h.y>.5){
vec3 p=uCP+rd*h.x;
vec3 n=nrm(p);
float m=h.y;
vec3 alb=vec3(.5);float ks=.2,sn=16.;
if(m<1.5){
vec2 g=vec2(p.x+uA.w,p.z);
float pth=1.-smoothstep(1.2,1.6,abs(p.z));
alb=mix(vec3(.5,.62,.4),vec3(.82,.74,.58),pth);
alb*=.94+.06*sin(g.x*5.3)*sin(g.y*4.7);
float dsh=(1.-smoothstep(.05,.16,abs(p.z)))*(1.-smoothstep(.24,.28,abs(fract(g.x*.55)-.5)));
alb=mix(alb,vec3(.95,.9,.8),dsh*.55);
ks=.03;sn=6.;
}else if(m<2.5){
alb=vec3(.06,.065,.075);
float wx=p.x>0.?1.3:-1.3;
float a2=atan(p.y-1.05,p.x-wx)+uA.x;
alb*=1.+.5*smoothstep(.3,1.,sin(a2*24.));
ks=.06;sn=8.;
}else if(m<3.5){alb=vec3(.8,.82,.86);ks=.9;sn=50.;}
else if(m<4.5){alb=vec3(.04,.44,.5);ks=.55;sn=40.;}
else if(m<5.5){alb=vec3(.15,.1,.08);ks=.2;sn=12.;}
else if(m<6.5){alb=vec3(.3,.31,.34);ks=.7;sn=32.;}
else if(m<7.5){alb=vec3(.97,.95,.88);ks=.12;sn=10.;}
else if(m<8.5){alb=vec3(.96,.5,.12);ks=.35;sn=22.;}
else if(m<9.5){alb=vec3(1.,.73,.28);ks=.3;sn=18.;}
else{alb=vec3(.02);ks=1.;sn=90.;}
float dif=clamp(dot(n,L),0.,1.);
float sh=dif>.001?shad(p+n*.02,L):1.;
float oc=ao(p,n);
vec3 lin=vec3(1.,.93,.8)*2.4*dif*sh;
lin+=vec3(.45,.6,.85)*(.55+.45*n.y)*oc*.9;
lin+=vec3(.5,.44,.3)*clamp(-n.y,0.,1.)*.6*oc;
float fr=pow(clamp(1.+dot(n,rd),0.,1.),4.);
lin+=vec3(.7,.8,1.)*.3*fr*oc;
col=alb*lin;
vec3 hv=normalize(L-rd);
col+=ks*pow(clamp(dot(n,hv),0.,1.),sn)*(1.5+sn*.06)*sh*(.25+.75*dif)*vec3(1.,.95,.85);
col+=ks*fr*sky(reflect(rd,n),L)*.35*oc;
col=mix(col,vec3(.84,.92,.99),1.-exp(-pow(h.x*.05,2.)));
}else{col=sky(rd,L);}
col=col/(1.+.15*col);
col=pow(clamp(col,0.,10.),vec3(.4545));
col*=1.-.16*clamp(length(uv)*.42-.1,0.,1.);
O=vec4(col,1.);}`;

  const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, alpha: false });
  if (!gl) throw new Error('WebGL2 is not available on this canvas');

  let yaw = 0.65, pitch = 0.3, dist = 6.8;
  const TX = 0.1, TY = 1.85, TZ = 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let prog = null, vao = null, U = {}, lost = false;

  function mkShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(s) || '';
      gl.deleteShader(s);
      throw new Error('Shader compile failed: ' + log);
    }
    return s;
  }
  function init() {
    const v = mkShader(gl.VERTEX_SHADER, VS), f = mkShader(gl.FRAGMENT_SHADER, FS);
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost())
      throw new Error('Program link failed: ' + (gl.getProgramInfoLog(p) || ''));
    gl.deleteShader(v); gl.deleteShader(f);
    prog = p; vao = gl.createVertexArray();
    U = {};
    for (const n of ['uR', 'uT', 'uCP', 'uCX', 'uCY', 'uCZ', 'uPR', 'uPL', 'uKR', 'uKL', 'uA'])
      U[n] = gl.getUniformLocation(p, n);
  }
  init();

  function knee(hx, hy, hz, fx, fy, fz) {
    const dx = fx - hx, dy = fy - hy, dz = fz - hz;
    const L2 = dx * dx + dy * dy + dz * dz;
    const hh = Math.sqrt(Math.max(0.6724 - L2 * 0.25, 0.0004));
    const dt = (dx + 0.2 * dy) / (L2 || 1);
    const bx = 1 - dx * dt, by = 0.2 - dy * dt, bz = -dz * dt;
    const bl = Math.hypot(bx, by, bz) || 1;
    return [(hx + fx) * 0.5 + bx / bl * hh, (hy + fy) * 0.5 + by / bl * hh, (hz + fz) * 0.5 + bz / bl * hh];
  }

  function render(t) {
    if (lost || !prog || gl.isContextLost()) return;
    t = Number(t); if (!Number.isFinite(t)) t = 0;
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    if (w < 1 || h < 1) return;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const px = TX + dist * cp * sy, py = TY + dist * sp, pz = TZ + dist * cp * cy;
    let fx = TX - px, fy = TY - py, fz = TZ - pz;
    const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    const rl = Math.hypot(fz, fx) || 1;
    const rX = -fz / rl, rZ = fx / rl;
    const ux = -rZ * fy, uy = rZ * fx - rX * fz, uz = rX * fy;
    const spin = -2.6 * t, ca = -t - 0.7, trav = 2.73 * t;
    const bob = 0.025 * Math.sin(2 * ca);
    const c = Math.cos(ca), s = Math.sin(ca);
    const prx = -0.1 + 0.3 * c, pry = 1.0 + 0.3 * s;
    const plx = -0.1 - 0.3 * c, ply = 1.0 - 0.3 * s;
    const hy2 = 2.28 + bob;
    const kr = knee(-0.44, hy2, 0.17, prx, pry + 0.04, 0.26);
    const kl = knee(-0.44, hy2, -0.17, plx, ply + 0.04, -0.26);
    gl.uniform2f(U.uR, w, h);
    gl.uniform1f(U.uT, t);
    gl.uniform3f(U.uCP, px, py, pz);
    gl.uniform3f(U.uCX, rX, 0, rZ);
    gl.uniform3f(U.uCY, ux, uy, uz);
    gl.uniform3f(U.uCZ, fx, fy, fz);
    gl.uniform3f(U.uPR, prx, pry, 0.26);
    gl.uniform3f(U.uPL, plx, ply, -0.26);
    gl.uniform3f(U.uKR, kr[0], kr[1], kr[2]);
    gl.uniform3f(U.uKL, kl[0], kl[1], kl[2]);
    gl.uniform4f(U.uA, spin, ca, bob, trav);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  canvas.tabIndex = 0;
  try {
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    canvas.style.outline = 'none';
  } catch (e) {}

  const LS = [];
  function on(tg, tp, fn, op) { tg.addEventListener(tp, fn, op); LS.push([tg, tp, fn, op]); }
  const ptr = new Map();
  let pinD = 0;
  on(canvas, 'pointerdown', (e) => {
    e.preventDefault();
    try { canvas.focus({ preventScroll: true }); } catch (_) { canvas.focus(); }
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinD = 0;
  });
  on(canvas, 'pointermove', (e) => {
    if (!ptr.has(e.pointerId)) return;
    e.preventDefault();
    const p = ptr.get(e.pointerId);
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptr.size === 1) {
      yaw -= dx * 0.008;
      pitch = clamp(pitch + dy * 0.008, -1.5, 1.5);
    } else if (ptr.size === 2) {
      const a = [...ptr.values()];
      const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (pinD > 0 && d > 0) dist = clamp(dist * pinD / d, 1.6, 26);
      pinD = d;
    }
  });
  const endP = (e) => { ptr.delete(e.pointerId); pinD = 0; };
  on(canvas, 'pointerup', endP);
  on(canvas, 'pointercancel', endP);
  on(canvas, 'wheel', (e) => {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 120 : e.deltaY;
    dist = clamp(dist * Math.exp(d * 0.0013), 1.6, 26);
  }, { passive: false });
  on(canvas, 'keydown', (e) => {
    const k = e.key; let hd = true;
    if (k === 'ArrowLeft') yaw -= 0.08;
    else if (k === 'ArrowRight') yaw += 0.08;
    else if (k === 'ArrowUp') pitch = clamp(pitch + 0.06, -1.5, 1.5);
    else if (k === 'ArrowDown') pitch = clamp(pitch - 0.06, -1.5, 1.5);
    else if (k === '+' || k === '=') dist = clamp(dist * 0.92, 1.6, 26);
    else if (k === '-' || k === '_') dist = clamp(dist / 0.92, 1.6, 26);
    else hd = false;
    if (hd) e.preventDefault();
  });
  on(canvas, 'webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  on(canvas, 'webglcontextrestored', () => {
    lost = false;
    try { init(); } catch (e) { prog = null; }
  });

  function dispose() {
    for (const [tg, tp, fn, op] of LS) tg.removeEventListener(tp, fn, op);
    LS.length = 0;
    ptr.clear();
    try {
      if (!gl.isContextLost()) {
        if (prog) gl.deleteProgram(prog);
        if (vao) gl.deleteVertexArray(vao);
      }
    } catch (e) {}
    prog = null; vao = null;
  }

  return {
    render,
    setView(y, p, d) {
      y = Number(y); p = Number(p); d = Number(d);
      if (Number.isFinite(y)) yaw = y;
      if (Number.isFinite(p)) pitch = clamp(p, -1.5, 1.5);
      if (Number.isFinite(d)) dist = clamp(d, 1.6, 26);
    },
    getView() { return { yaw: yaw, pitch: pitch, distance: dist }; },
    dispose
  };
}
