const VS=`#version 300 es
void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.-1.,0.,1.);}`;
const FS=`#version 300 es
precision highp float;
uniform vec2 uRes;uniform float uT,uCrank;uniform vec3 uCam,uTgt,uKR,uKL,uPR,uPL;
out vec4 o;
vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
float sdSph(vec3 p,float r){return length(p)-r;}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdEll(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/k1;}
float sdTor(vec3 p,float R,float r){return length(vec2(length(p.xy)-R,p.z))-r;}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sdCylZ(vec3 p,float r,float h){vec2 d=abs(vec2(length(p.xy),p.z))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
float sdRC(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 ba=b-a;float l2=dot(ba,ba);float rr=r1-r2;float a2=l2-rr*rr;float il2=1./l2;vec3 pa=p-a;float y=dot(pa,ba);float z=y-l2;vec3 xx=pa*l2-ba*y;float x2=dot(xx,xx);float y2=y*y*l2;float z2=z*z*l2;float k=sign(rr)*rr*rr*x2;if(sign(z)*a2*z2>k)return sqrt(x2+z2)*il2-r2;if(sign(y)*a2*y2<k)return sqrt(x2+y2)*il2-r1;return(sqrt(x2*a2*il2)+y*rr)*il2-r1;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
vec2 wheel(vec3 p,float ang){
vec2 r=vec2(sdTor(p,.5,.07),2.);
r=U(r,vec2(sdTor(p,.44,.02),3.));
vec3 q=p;q.xy=rot(ang)*q.xy;
float s=.6283185;float a=mod(atan(q.y,q.x)+s*.5,s)-s*.5;float l=length(q.xy);
vec2 sp=vec2(l*cos(a),l*sin(a));
float d=max(length(vec2(sp.y,q.z))-.009,abs(sp.x-.26)-.2);
d=min(d,sdCylZ(p,.06,.08));
return U(r,vec2(d,3.));}
vec2 map(vec3 p){
vec2 r=vec2(p.y,0.);
float bd=sdBox(p-vec3(.15,1.6,0.),vec3(1.6,1.5,.5))-.1;
if(bd>.3)return U(r,vec2(bd,1.));
vec3 BB=vec3(-.05,.6,0),RH=vec3(-.95,.57,0),FH=vec3(.95,.57,0),ST=vec3(-.4,1.3,0),HT=vec3(.62,1.25,0),HB=vec3(.72,.95,0);
vec3 pm=vec3(p.xy,abs(p.z));
float f=sdCap(p,BB,ST,.035);
f=min(f,sdCap(p,ST,HT,.035));
f=min(f,sdCap(p,HB,BB,.04));
f=min(f,sdCap(p,HT,HB,.045));
f=min(f,sdCap(pm,BB+vec3(0,0,.07),RH+vec3(0,0,.07),.022));
f=min(f,sdCap(pm,ST,RH+vec3(0,0,.07),.022));
f=min(f,sdCap(pm,HB,FH+vec3(0,0,.07),.025));
f=min(f,sdCap(p,ST,vec3(-.47,1.47,0),.025));
f=min(f,sdCap(p,HT,vec3(.58,1.38,0),.03));
f=min(f,sdCap(p,vec3(.58,1.38,-.33),vec3(.58,1.38,.33),.022));
r=U(r,vec2(f,1.));
r=U(r,vec2(sdCap(pm,vec3(.58,1.38,.22),vec3(.58,1.38,.36),.03),4.));
r=U(r,vec2(sdEll(p-vec3(-.5,1.5,0),vec3(.18,.045,.1)),4.));
float cr=sdCylZ(p-BB-vec3(0,0,.09),.16,.008);
cr=min(cr,sdCylZ(p-RH-vec3(0,0,.09),.06,.008));
cr=min(cr,sdCap(p,BB+vec3(0,.16,.09),RH+vec3(0,.06,.09),.012));
cr=min(cr,sdCap(p,BB+vec3(0,-.16,.09),RH+vec3(0,-.06,.09),.012));
cr=min(cr,sdCap(p,BB+vec3(0,0,.12),uPR,.025));
cr=min(cr,sdCap(p,BB-vec3(0,0,.12),uPL,.025));
cr=min(cr,sdCylZ(p-BB,.04,.14));
r=U(r,vec2(cr,3.));
r=U(r,vec2(min(sdBox(p-uPR,vec3(.07,.012,.04)),sdBox(p-uPL,vec3(.07,.012,.04))),4.));
float wa=-uCrank*2.6;
r=U(r,wheel(p-RH,wa));r=U(r,wheel(p-FH,wa));
float b=sdEll(p-vec3(-.25,1.9,0),vec3(.5,.34,.3));
b=smin(b,sdEll(p-vec3(-.8,2.0,0),vec3(.25,.08,.13)),.08);
b=smin(b,sdCap(p,vec3(.15,2.0,0),vec3(.3,2.4,0),.13),.08);
b=smin(b,sdCap(p,vec3(.3,2.4,0),vec3(.45,2.65,0),.12),.05);
vec3 hd=vec3(.52,2.72,0);
b=smin(b,sdSph(p-hd,.19),.04);
vec3 w=pm-vec3(.15,1.72,.3);w.xy=rot(.75)*w.xy;
b=smin(b,sdEll(w,vec3(.5,.13,.06)),.06);
r=U(r,vec2(b,5.));
float bk=sdRC(p,hd+vec3(.1,-.02,0),vec3(1.5,2.5,0),.085,.02);
r=U(r,vec2(bk,6.));
vec3 pq=p-vec3(.95,2.45,0);pq.xy=rot(.2)*pq.xy;
float po=sdEll(pq,vec3(.5,.13,.08));
r=U(r,vec2(smin(po,sdSph(p-hd-vec3(.05,-.1,0),.13),.08),7.));
r=U(r,vec2(sdSph(pm-vec3(.6,2.76,.15),.045),8.));
r=U(r,vec2(sdSph(pm-vec3(.59,2.76,.125),.06),6.));
float lg=sdCap(p,vec3(-.15,1.55,.15),uKR,.07);lg=min(lg,sdCap(p,uKR,uPR+vec3(0,.03,0),.045));
lg=min(lg,sdCap(p,vec3(-.15,1.55,-.15),uKL,.07));lg=min(lg,sdCap(p,uKL,uPL+vec3(0,.03,0),.045));
lg=min(lg,sdBox(p-uPR-vec3(.03,.035,0),vec3(.11,.012,.055)));
lg=min(lg,sdBox(p-uPL-vec3(.03,.035,0),vec3(.11,.012,.055)));
r=U(r,vec2(lg,6.));
return r;}
vec3 nrm(vec3 p){vec2 e=vec2(.0007,-.0007);return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
float sh(vec3 ro,vec3 rd){float r=1.,t=.02;for(int i=0;i<32;i++){float h=map(ro+rd*t).x;r=min(r,12.*h/t);if(r<.01||t>8.)break;t+=clamp(h,.01,.3);}return clamp(r,0.,1.);}
float ao(vec3 p,vec3 n){float o=0.,s=1.;for(int i=1;i<=5;i++){float h=.03*float(i);o+=(h-map(p+n*h).x)*s;s*=.6;}return clamp(1.-3.*o,0.,1.);}
vec3 col(float m,vec3 p){
if(m<.5){float c=mod(floor(p.x*1.5)+floor(p.z*1.5),2.);return mix(vec3(.38,.42,.3),vec3(.46,.5,.36),c);}
if(m<1.5)return vec3(.8,.12,.1);
if(m<2.5)return vec3(.08);
if(m<3.5)return vec3(.7,.72,.75);
if(m<4.5)return vec3(.25,.15,.08);
if(m<5.5)return vec3(.95,.93,.88);
if(m<6.5)return vec3(1.,.6,.1);
if(m<7.5)return vec3(1.,.7,.45);
return vec3(.02);}
void main(){
vec2 uv=(gl_FragCoord.xy*2.-uRes)/uRes.y;
vec3 fw=normalize(uTgt-uCam),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw);
vec3 rd=normalize(fw*1.7+uv.x*rt+uv.y*up),ro=uCam;
vec3 sun=normalize(vec3(.6,.8,.5));
vec3 sky=mix(vec3(.6,.75,.92),vec3(.15,.32,.65),clamp(rd.y,0.,1.))+vec3(1.,.8,.5)*pow(max(dot(rd,sun),0.),40.)*.6;
float t=0.,m=-1.;
for(int i=0;i<128;i++){vec2 h=map(ro+rd*t);if(h.x<.0004*t||t>40.)break;t+=h.x*.9;m=h.y;}
vec3 c=sky;
if(t<40.){
vec3 p=ro+rd*t,n=nrm(p);
vec3 alb=col(m,p);
float dif=max(dot(n,sun),0.)*sh(p+n*.01,sun);
float a=ao(p,n);
vec3 hv=normalize(sun-rd);
float spe=pow(max(dot(n,hv),0.),m>2.5&&m<3.5?80.:30.)*(m>2.5&&m<3.5?1.2:.3)*dif;
float fr=pow(1.-max(dot(n,-rd),0.),4.);
vec3 amb=mix(vec3(.3,.35,.4),vec3(.55,.65,.85),n.y*.5+.5)*a;
c=alb*(dif*vec3(1.,.92,.8)*1.4+amb*.5)+spe+fr*sky*.2*a;
c=mix(c,sky,1.-exp(-.0012*t*t));
}
c=pow(c,vec3(.4545));
o=vec4(c,1.);}`;
export function createPelicanSdf(canvas){
const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:false,preserveDrawingBuffer:true});
if(!gl)throw new Error('WebGL2 is not available');
let yaw=0.65,pitch=0.22,dist=6.0,lost=false,prog=null,loc={},vao=null;
const tgt=[0.1,1.5,0];
const TMIN=1.2,TMAX=16;
function mk(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('Shader compile failed: '+e);}return s;}
function init(){
const v=mk(gl.VERTEX_SHADER,VS),f=mk(gl.FRAGMENT_SHADER,FS);
prog=gl.createProgram();gl.attachShader(prog,v);gl.attachShader(prog,f);gl.linkProgram(prog);
gl.deleteShader(v);gl.deleteShader(f);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('Program link failed: '+gl.getProgramInfoLog(prog));
vao=gl.createVertexArray();
for(const n of['uRes','uT','uCrank','uCam','uTgt','uKR','uKL','uPR','uPL'])loc[n]=gl.getUniformLocation(prog,n);
}
init();
const onLost=e=>{e.preventDefault();lost=true;};
const onRestored=()=>{try{init();lost=false;}catch(e){lost=true;}};
canvas.addEventListener('webglcontextlost',onLost,false);
canvas.addEventListener('webglcontextrestored',onRestored,false);
function clampV(){pitch=Math.max(-1.45,Math.min(1.45,pitch));dist=Math.max(TMIN,Math.min(TMAX,dist));}
function camPos(){const cp=Math.cos(pitch);return[tgt[0]+Math.sin(yaw)*cp*dist,tgt[1]+Math.sin(pitch)*dist,tgt[2]+Math.cos(yaw)*cp*dist];}
function leg(hz,px,py){const hx=-0.15,hy=1.55,fx=px,fy=py+0.03;let dx=fx-hx,dy=fy-hy,d=Math.hypot(dx,dy);const L1=0.56,L2=0.6;const dd=Math.min(d,L1+L2-0.01);dx/=d;dy/=d;const a=(dd*dd+L1*L1-L2*L2)/(2*dd);const h=Math.sqrt(Math.max(L1*L1-a*a,0));return[hx+dx*a-dy*h,hy+dy*a+dx*h,hz];}
function render(time){
if(lost||!prog)return;
const W=canvas.width,H=canvas.height;
gl.viewport(0,0,W,H);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
gl.useProgram(prog);gl.bindVertexArray(vao);
const t=+time||0,a=-t*4.0;
const BBx=-0.05,BBy=0.6,R=0.17;
const PR=[BBx+R*Math.cos(a),BBy+R*Math.sin(a),0.17],PL=[BBx-R*Math.cos(a),BBy-R*Math.sin(a),-0.17];
const KR=leg(0.17,PR[0],PR[1]),KL=leg(-0.17,PL[0],PL[1]);
const cam=camPos();
gl.uniform2f(loc.uRes,W,H);gl.uniform1f(loc.uT,t);gl.uniform1f(loc.uCrank,a);
gl.uniform3fv(loc.uCam,cam);gl.uniform3fv(loc.uTgt,tgt);
gl.uniform3fv(loc.uKR,KR);gl.uniform3fv(loc.uKL,KL);gl.uniform3fv(loc.uPR,PR);gl.uniform3fv(loc.uPL,PL);
gl.drawArrays(gl.TRIANGLES,0,3);
}
canvas.tabIndex=0;canvas.style.touchAction='none';canvas.style.outline='none';
const ptrs=new Map();let lastPinch=0;
const onDown=e=>{canvas.focus();ptrs.set(e.pointerId,[e.clientX,e.clientY]);try{canvas.setPointerCapture(e.pointerId);}catch(_){}if(ptrs.size===2){const p=[...ptrs.values()];lastPinch=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);}e.preventDefault();};
const onMove=e=>{if(!ptrs.has(e.pointerId))return;const prev=ptrs.get(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);
if(ptrs.size===1){yaw+=(e.clientX-prev[0])*0.01;pitch+=(e.clientY-prev[1])*0.01;}
else if(ptrs.size===2){const p=[...ptrs.values()];const d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(lastPinch>0&&d>0)dist*=lastPinch/d;lastPinch=d;}
clampV();e.preventDefault();};
const onUp=e=>{ptrs.delete(e.pointerId);try{canvas.releasePointerCapture(e.pointerId);}catch(_){}lastPinch=0;};
const onWheel=e=>{e.preventDefault();dist*=Math.exp(e.deltaY*(e.deltaMode===1?0.03:0.0012));clampV();};
const onKey=e=>{let h=true;switch(e.key){case'ArrowLeft':yaw-=0.08;break;case'ArrowRight':yaw+=0.08;break;case'ArrowUp':pitch+=0.06;break;case'ArrowDown':pitch-=0.06;break;case'+':case'=':dist*=0.9;break;case'-':case'_':dist/=0.9;break;default:h=false;}if(h){clampV();e.preventDefault();}};
const onTouch=e=>{e.preventDefault();};
canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);
canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onUp);
canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('keydown',onKey);
canvas.addEventListener('touchstart',onTouch,{passive:false});canvas.addEventListener('touchmove',onTouch,{passive:false});
canvas.addEventListener('contextmenu',onTouch);
return{
render,
setView(y,p,d){if(Number.isFinite(y))yaw=y;if(Number.isFinite(p))pitch=p;if(Number.isFinite(d))dist=d;clampV();},
getView(){return{yaw,pitch,distance:dist};},
dispose(){
canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointermove',onMove);
canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onUp);
canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('keydown',onKey);
canvas.removeEventListener('touchstart',onTouch);canvas.removeEventListener('touchmove',onTouch);
canvas.removeEventListener('contextmenu',onTouch);
canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);
if(!lost){try{if(vao)gl.deleteVertexArray(vao);if(prog)gl.deleteProgram(prog);}catch(_){}}
prog=null;vao=null;
}
};
}
