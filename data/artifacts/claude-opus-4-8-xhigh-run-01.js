export function createPelicanSdf(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL2 is not available');

  canvas.tabIndex = canvas.tabIndex || 0;
  canvas.style.touchAction = 'none';
  canvas.style.outline = 'none';

  const VERT = `#version 300 es
precision highp float;
const vec2 P[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
void main(){gl_Position=vec4(P[gl_VertexID],0.,1.);}`;

  const FRAG = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 iRes;uniform vec3 camPos;uniform vec3 camTar;uniform float iTime;
float sdSph(vec3 p,float r){return length(p)-r;}
float sdEll(vec3 p,vec3 r){float k0=length(p/r);float k1=max(length(p/(r*r)),1e-5);return k0*(k0-1.0)/k1;}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*h)-r;}
float sdTorZ(vec3 p,float ra,float rb){vec2 q=vec2(length(p.xy)-ra,p.z);return length(q)-rb;}
float sdCylZ(vec3 p,float r,float h){vec2 d=vec2(length(p.xy)-r,abs(p.z)-h);return min(max(d.x,d.y),0.0)+length(max(d,0.0));}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}
vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec3 rotZ(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
float sdRoundCone(vec3 p,vec3 a,vec3 b,float r1,float r2){
 vec3 ba=b-a;float l2=dot(ba,ba);float rr=r1-r2;float a2=l2-rr*rr;float il2=1.0/l2;
 vec3 pa=p-a;float y=dot(pa,ba);float z=y-l2;vec3 xp=pa*l2-ba*y;float x2=dot(xp,xp);
 float y2=y*y*l2;float z2=z*z*l2;float k=sign(rr)*rr*rr*x2;
 if(sign(z)*a2*z2>k)return sqrt(x2+z2)*il2-r2;
 if(sign(y)*a2*y2<k)return sqrt(x2+y2)*il2-r1;
 return (sqrt(x2*a2*il2)+y*rr)*il2-r1;}
vec2 mapWheel(vec3 p){
 float R=0.5;float d=sdTorZ(p,R,0.06);vec2 r=vec2(d,1.0);
 float hub=sdCylZ(p,0.055,0.06);r=U(r,vec2(hub,3.0));
 float ang=atan(p.y,p.x);float sec=0.6981317;ang=mod(ang+sec*0.5,sec)-sec*0.5;
 float rad=length(p.xy);vec2 pl=vec2(cos(ang),sin(ang))*rad;pl.x-=clamp(pl.x,0.0,R-0.05);
 float sp=length(vec3(pl,p.z))-0.01;r=U(r,vec2(sp,3.0));
 float rim=sdTorZ(p,R-0.05,0.02);r=U(r,vec2(rim,3.0));return r;}
float legDist(vec3 p,vec2 hip,vec2 foot,float z){
 float L1=0.45,L2=0.45;vec2 dv=foot-hip;float dl=clamp(length(dv),0.05,L1+L2-0.02);
 vec2 dir=normalize(dv);float a=(L1*L1-L2*L2+dl*dl)/(2.0*dl);float h=sqrt(max(L1*L1-a*a,0.0));
 vec2 perp=vec2(dir.y,-dir.x);vec2 knee=hip+dir*a+perp*h;
 vec3 H=vec3(hip,z),K=vec3(knee,z),F=vec3(foot,z);
 float t=sdCap(p,H,K,0.05);t=min(t,sdCap(p,K,F,0.045));
 t=min(t,sdCap(p,F,F+vec3(0.09,-0.01,0.0),0.05));return t;}
vec2 map(vec3 p){
 vec2 r=vec2(p.y,0.0);
 float wa=iTime*-3.0;
 r=U(r,mapWheel(rotZ(p-vec3(-0.8,0.56,0.0),wa)));
 r=U(r,mapWheel(rotZ(p-vec3(0.8,0.56,0.0),wa)));
 vec3 bb=vec3(0.0,0.40,0.0),rh=vec3(-0.8,0.56,0.0),fh=vec3(0.8,0.56,0.0);
 vec3 st=vec3(-0.28,0.98,0.0),ht=vec3(0.52,1.00,0.0),hbo=vec3(0.66,0.66,0.0);
 float tr=0.028;float f=sdCap(p,bb,rh,tr);
 f=min(f,sdCap(p,st,rh,tr));f=min(f,sdCap(p,bb,st,tr));f=min(f,sdCap(p,bb,hbo,tr));
 f=min(f,sdCap(p,st,ht,tr));f=min(f,sdCap(p,ht,hbo,0.03));f=min(f,sdCap(p,hbo,fh,0.026));
 r=U(r,vec2(f,2.0));
 float seat=sdBox(p-vec3(-0.26,1.02,0.0),vec3(0.13,0.02,0.09))-0.02;r=U(r,vec2(seat,4.0));
 vec3 hg=vec3(0.46,1.20,0.0);float hb=sdCap(p,ht,hg,0.025);
 hb=min(hb,sdCap(p,hg-vec3(0,0,0.22),hg+vec3(0,0,0.22),0.02));r=U(r,vec2(hb,2.0));
 float grips=sdCap(p,hg+vec3(-0.01,0,0.15),hg+vec3(-0.01,0,0.23),0.03);
 grips=min(grips,sdCap(p,hg+vec3(-0.01,0,-0.15),hg+vec3(-0.01,0,-0.23),0.03));r=U(r,vec2(grips,4.0));
 float ca=iTime*3.0;vec2 pr=vec2(cos(ca),sin(ca))*0.20;
 vec3 pedR=vec3(bb.xy+pr,0.14),pedL=vec3(bb.xy-pr,-0.14);
 float crank=sdCap(p,bb+vec3(0,0,0.075),pedR,0.02);crank=min(crank,sdCap(p,bb+vec3(0,0,-0.075),pedL,0.02));
 r=U(r,vec2(crank,2.0));
 float ped=sdBox(p-pedR,vec3(0.05,0.012,0.03));ped=min(ped,sdBox(p-pedL,vec3(0.05,0.012,0.03)));
 r=U(r,vec2(ped,10.0));
 float ring=abs(sdTorZ(p-(bb+vec3(0,0,0.075)),0.11,0.008))-0.004;r=U(r,vec2(ring,3.0));
 float chain=sdCap(p,bb+vec3(0.11,0.0,0.075),rh+vec3(0.0,0.05,0.075),0.012);
 chain=min(chain,sdCap(p,bb+vec3(-0.05,-0.10,0.075),rh+vec3(0.0,-0.05,0.075),0.012));r=U(r,vec2(chain,1.0));
 float bob=0.02*sin(iTime*3.0);vec3 q=p-vec3(0.0,bob,0.0);
 float body=sdEll(q-vec3(-0.05,1.40,0.0),vec3(0.40,0.36,0.30));
 float neck=sdCap(q,vec3(0.12,1.58,0.0),vec3(0.50,1.92,0.0),0.13);
 float head=sdSph(q-vec3(0.56,1.98,0.0),0.19);
 float pel=smin(body,neck,0.14);pel=smin(pel,head,0.10);
 float wing=sdEll(q-vec3(0.15,1.45,0.24),vec3(0.38,0.20,0.07));
 wing=min(wing,sdEll(q-vec3(0.15,1.45,-0.24),vec3(0.38,0.20,0.07)));
 wing=min(wing,sdCap(q,vec3(0.45,1.35,0.24),vec3(0.46,1.21,0.22),0.05));
 wing=min(wing,sdCap(q,vec3(0.45,1.35,-0.24),vec3(0.46,1.21,-0.22),0.05));
 pel=smin(pel,wing,0.08);r=U(r,vec2(pel,5.0));
 float ub=sdRoundCone(q,vec3(0.70,2.00,0.0),vec3(1.55,1.90,0.0),0.10,0.02);
 float lb=sdRoundCone(q,vec3(0.70,1.92,0.0),vec3(1.53,1.85,0.0),0.075,0.02);
 r=U(r,vec2(min(ub,lb),6.0));
 float pouch=sdEll(q-vec3(1.02,1.72,0.0),vec3(0.32,0.19,0.15));pouch=smin(pouch,lb,0.08);r=U(r,vec2(pouch,7.0));
 float ew=sdSph(q-vec3(0.66,2.06,0.13),0.055);ew=min(ew,sdSph(q-vec3(0.66,2.06,-0.13),0.055));r=U(r,vec2(ew,8.0));
 float ep=sdSph(q-vec3(0.684,2.079,0.162),0.028);ep=min(ep,sdSph(q-vec3(0.684,2.079,-0.162),0.028));r=U(r,vec2(ep,9.0));
 float legs=legDist(p,vec2(0.02,1.05+bob),bb.xy+pr,0.14);
 legs=min(legs,legDist(p,vec2(0.02,1.05+bob),bb.xy-pr,-0.14));r=U(r,vec2(legs,11.0));
 return r;}
vec3 calcN(vec3 p){vec2 e=vec2(1.0,-1.0)*0.0009;
 return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
vec2 march(vec3 ro,vec3 rd){float t=0.0,m=-1.0;
 for(int i=0;i<140;i++){vec3 p=ro+rd*t;vec2 h=map(p);if(h.x<0.0006*t+0.0002){m=h.y;break;}t+=h.x;if(t>30.0)break;}
 return vec2(t,m);}
float shadow(vec3 ro,vec3 rd){float res=1.0,t=0.03;
 for(int i=0;i<28;i++){float h=map(ro+rd*t).x;res=min(res,9.0*h/t);t+=clamp(h,0.02,0.3);if(res<0.02||t>7.0)break;}
 return clamp(res,0.0,1.0);}
float ao(vec3 p,vec3 n){float s=0.0,w=1.0;
 for(int i=1;i<=5;i++){float d=0.045*float(i);s+=w*(d-map(p+n*d).x);w*=0.6;}return clamp(1.0-2.0*s,0.0,1.0);}
vec3 matcol(float m,vec3 p){
 if(m<0.5){float c=mod(floor(p.x*1.4)+floor(p.z*1.4),2.0);return vec3(0.24,0.27,0.22)*(0.75+0.25*c);}
 if(m<1.5)return vec3(0.04,0.04,0.05);
 if(m<2.5)return vec3(0.82,0.12,0.10);
 if(m<3.5)return vec3(0.80,0.82,0.86);
 if(m<4.5)return vec3(0.08,0.07,0.06);
 if(m<5.5)return vec3(0.96,0.96,0.94);
 if(m<6.5)return vec3(0.99,0.75,0.16);
 if(m<7.5)return vec3(0.99,0.52,0.10);
 if(m<8.5)return vec3(0.97,0.93,0.86);
 if(m<9.5)return vec3(0.02,0.02,0.02);
 if(m<10.5)return vec3(0.05,0.05,0.06);
 return vec3(0.98,0.58,0.10);}
vec3 bg(vec3 rd){float t=clamp(rd.y*0.5+0.5,0.0,1.0);
 vec3 c=mix(vec3(0.92,0.9,0.85),vec3(0.34,0.55,0.9),t);
 float sun=pow(clamp(dot(rd,normalize(vec3(0.6,0.8,0.4))),0.0,1.0),64.0);
 c+=vec3(1.0,0.9,0.7)*sun*0.5;return c;}
vec3 shade(vec3 ro,vec3 rd,float t,float m){
 vec3 p=ro+rd*t;vec3 n=calcN(p);vec3 base=matcol(m,p);
 vec3 ld=normalize(vec3(0.6,0.8,0.4));float dif=clamp(dot(n,ld),0.0,1.0);
 float sh=shadow(p+n*0.02,ld);float o=ao(p,n);
 vec3 sky=vec3(0.5,0.7,1.0);float amb=0.4+0.35*clamp(n.y,0.0,1.0);
 vec3 col=base*sky*amb*0.6*o;
 col+=base*dif*sh*vec3(1.0,0.95,0.85)*1.15;
 vec3 h=normalize(ld-rd);float sp=pow(clamp(dot(n,h),0.0,1.0),42.0)*sh;
 float sf=((m>1.5&&m<3.5)||m>9.5&&m<10.5)?0.8:0.22;col+=sp*sf;
 float rim=pow(1.0-clamp(dot(n,-rd),0.0,1.0),3.0);col+=rim*0.14*sky;
 return col;}
void main(){
 vec2 uv=(gl_FragCoord.xy*2.0-iRes)/iRes.y;
 vec3 ro=camPos;vec3 fw=normalize(camTar-camPos);
 vec3 rt=normalize(cross(fw,vec3(0,1,0)));vec3 up=cross(rt,fw);
 vec3 rd=normalize(uv.x*rt+uv.y*up+1.6*fw);
 vec2 res=march(ro,rd);vec3 col;
 if(res.y<0.0)col=bg(rd);
 else{col=shade(ro,rd,res.x,res.y);col=mix(bg(rd),col,exp(-0.0009*res.x*res.x));}
 col=pow(clamp(col,0.0,1.0),vec3(0.4545));
 O=vec4(col,1.0);}`;

  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compilation failed: ' + log);
    }
    return s;
  }

  let program, vao, uRes, uCamPos, uCamTar, uTime;
  function build() {
    const vs = sh(gl.VERTEX_SHADER, VERT);
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      throw new Error('Program link failed: ' + log);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    uRes = gl.getUniformLocation(program, 'iRes');
    uCamPos = gl.getUniformLocation(program, 'camPos');
    uCamTar = gl.getUniformLocation(program, 'camTar');
    uTime = gl.getUniformLocation(program, 'iTime');
    vao = gl.createVertexArray();
  }
  build();

  let yaw = 0.7, pitch = 0.2, dist = 4.2;
  const target = [0.1, 1.05, 0.0];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function camPos() {
    const cp = Math.cos(pitch);
    return [
      target[0] + dist * Math.sin(yaw) * cp,
      target[1] + dist * Math.sin(pitch),
      target[2] + dist * Math.cos(yaw) * cp
    ];
  }

  const pointers = new Map();
  let lastPinch = 0;
  const pinchDist = () => {
    const a = [...pointers.values()];
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };

  const onDown = (e) => {
    canvas.focus();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) lastPinch = pinchDist();
    e.preventDefault();
  };
  const onMove = (e) => {
    const pr = pointers.get(e.pointerId);
    if (!pr) return;
    const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
    pr.x = e.clientX; pr.y = e.clientY;
    if (pointers.size === 2) {
      const d = pinchDist();
      if (lastPinch > 0) dist = clamp(dist * lastPinch / d, 1.0, 12.0);
      lastPinch = d;
    } else {
      yaw += dx * 0.008;
      pitch = clamp(pitch - dy * 0.008, -1.4, 1.4);
    }
    e.preventDefault();
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
  };
  const onWheel = (e) => {
    dist = clamp(dist * Math.exp(e.deltaY * 0.001), 1.0, 12.0);
    e.preventDefault();
  };
  const onKey = (e) => {
    const k = e.key;
    if (k === 'ArrowLeft') yaw -= 0.08;
    else if (k === 'ArrowRight') yaw += 0.08;
    else if (k === 'ArrowUp') pitch = clamp(pitch + 0.06, -1.4, 1.4);
    else if (k === 'ArrowDown') pitch = clamp(pitch - 0.06, -1.4, 1.4);
    else if (k === '+' || k === '=') dist = clamp(dist * 0.9, 1.0, 12.0);
    else if (k === '-' || k === '_') dist = clamp(dist * 1.1, 1.0, 12.0);
    else return;
    e.preventDefault();
  };
  const onLost = (e) => { e.preventDefault(); };
  const onRestored = () => { build(); };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  function render(timeSeconds) {
    if (gl.isContextLost()) return;
    const w = canvas.width | 0, h = canvas.height | 0;
    gl.viewport(0, 0, w, h);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    const cp = camPos();
    gl.uniform2f(uRes, w, h);
    gl.uniform3f(uCamPos, cp[0], cp[1], cp[2]);
    gl.uniform3f(uCamTar, target[0], target[1], target[2]);
    gl.uniform1f(uTime, timeSeconds || 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  function setView(y, p, d) {
    yaw = y;
    pitch = p;
    dist = d;
  }
  function getView() {
    return { yaw: yaw, pitch: pitch, distance: dist };
  }
  function dispose() {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('keydown', onKey);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    pointers.clear();
    if (program) gl.deleteProgram(program);
    if (vao) gl.deleteVertexArray(vao);
    program = null;
    vao = null;
  }

  return { render, setView, getView, dispose };
}
