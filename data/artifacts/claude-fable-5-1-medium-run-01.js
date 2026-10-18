const VS=`#version 300 es
void main(){vec2 v=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(v*2.-1.,0.,1.);}`;
const FS=`#version 300 es
precision highp float;
out vec4 O;
uniform vec2 R;uniform float T;uniform vec3 CP;
const vec3 SUN=normalize(vec3(.55,.75,.45));
const vec3 BC=vec3(0.,1.5,0.);
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float sS(vec3 p,float r){return length(p)-r;}
float sC(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sT(vec3 p,float R1,float r){vec2 q=vec2(length(p.xy)-R1,p.z);return length(q)-r;}
float sE(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r));return k0*(k0-1.)/k1;}
float sB(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float sZ(vec3 p,float h,float r){vec2 d=abs(vec2(length(p.xy),p.z))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
float sRC(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 ba=b-a;float l2=dot(ba,ba),rr=r1-r2,a2=l2-rr*rr,il2=1./l2;vec3 pa=p-a;float y=dot(pa,ba),z=y-l2;vec3 xp=pa*l2-ba*y;float x2=dot(xp,xp),y2=y*y*l2,z2=z*z*l2,k=sign(rr)*rr*rr*x2;if(sign(z)*a2*z2>k)return sqrt(x2+z2)*il2-r2;if(sign(y)*a2*y2<k)return sqrt(x2+y2)*il2-r1;return (sqrt(x2*a2*il2)+y*rr)*il2-r1;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
void U(inout vec2 r,float d,float m){if(d<r.x)r=vec2(d,m);}
vec2 wheel(vec3 p,float an){
p.xy=rot(an)*p.xy;
vec2 r=vec2(sT(p,.68,.07),1.);
U(r,sT(p,.6,.02),3.);
U(r,sZ(p,.06,.06),3.);
float a=atan(p.y,p.x),s=.5235988;a=mod(a+s*.5,s)-s*.5;float l=length(p.xy);
U(r,sC(vec3(l*cos(a),l*sin(a),p.z),vec3(.06,0.,0.),vec3(.6,0.,0.),.008),3.);
return r;}
vec2 bike(vec3 p,float ca,out vec3 P1,out vec3 P2){
vec3 A=vec3(-1.1,.75,0.),F=vec3(1.1,.75,0.),B=vec3(-.15,.5,0.),S=vec3(-.45,1.55,0.),H1=vec3(.75,1.5,0.),H2=vec3(.92,1.,0.);
vec2 r=wheel(p-A,ca*2.);
vec2 w=wheel(p-F,ca*2.);if(w.x<r.x)r=w;
vec3 q=vec3(p.x,p.y,abs(p.z));
float f=sC(p,B,H2,.035);f=min(f,sC(p,S,H1,.032));f=min(f,sC(p,B,S,.032));f=min(f,sC(p,H1,H2,.04));
f=min(f,sC(q,A,B+vec3(0.,0.,.06),.02));f=min(f,sC(q,A+vec3(0.,0.,.06),S,.02));f=min(f,sC(q,H2+vec3(0.,0.,.06),F+vec3(0.,0.,.06),.022));
U(r,f,2.);
float c=sC(p,H1,vec3(.78,1.68,0.),.03);c=min(c,sC(p,vec3(.78,1.68,-.36),vec3(.78,1.68,.36),.022));c=min(c,sC(p,S,vec3(-.47,1.68,0.),.02));
U(r,c,3.);
U(r,sC(q,vec3(.78,1.68,.22),vec3(.78,1.68,.36),.034),1.);
U(r,sE(p-vec3(-.5,1.72,0.),vec3(.21,.035,.1)),8.);
U(r,sZ(p-B,.13,.03),3.);
vec2 cd=vec2(cos(ca),-sin(ca));
P1=B+vec3(cd*.19,.14);P2=B+vec3(-cd*.19,-.14);
float k=sC(p,B+vec3(0.,0.,.1),P1,.025);k=min(k,sC(p,B-vec3(0.,0.,.1),P2,.025));
U(r,k,3.);
float pd=sB(p-P1-vec3(0.,0.,.07),vec3(.07,.012,.05),.01);pd=min(pd,sB(p-P2+vec3(0.,0.,.07),vec3(.07,.012,.05),.01));
U(r,pd,1.);
U(r,sT(p-B-vec3(0.,0.,.09),.19,.014),3.);
U(r,sT(p-A-vec3(0.,0.,.09),.07,.012),3.);
float ch=sC(p,B+vec3(0.,.19,.09),A+vec3(0.,.07,.09),.011);ch=min(ch,sC(p,B+vec3(0.,-.19,.09),A+vec3(0.,-.07,.09),.011));
U(r,ch,1.);
return r;}
vec2 pelican(vec3 p,vec3 P1,vec3 P2){
vec3 q=vec3(p.x,p.y,abs(p.z));
vec3 bp=p-vec3(-.35,2.,0.);bp.xy=rot(-.25)*bp.xy;
float b=sE(bp,vec3(.5,.32,.34));
b=smin(b,sRC(p,vec3(-.6,2.05,0.),vec3(-1.05,2.25,0.),.14,.03),.08);
b=smin(b,sC(p,vec3(-.05,2.15,0.),vec3(.2,2.55,0.),.13),.12);
b=smin(b,sC(p,vec3(.2,2.55,0.),vec3(.4,2.82,0.),.12),.08);
b=smin(b,sS(p-vec3(.42,2.88,0.),.19),.05);
float wg=sE(q-vec3(-.3,1.98,.36),vec3(.4,.2,.07));
wg=smin(wg,sC(q,vec3(0.,2.05,.3),vec3(.8,1.72,.36),.075),.1);
b=smin(b,wg,.06);
vec2 r=vec2(b,4.);
float bk=sRC(p,vec3(.52,2.86,0.),vec3(1.4,2.74,0.),.075,.025);
float lm=sRC(p,vec3(.52,2.8,0.),vec3(1.38,2.72,0.),.05,.02);
float po=sE(p-vec3(.9,2.62,0.),vec3(.48,.16,.085));
U(r,bk,5.);U(r,lm,5.);U(r,smin(po,lm,.08),7.);
U(r,sS(q-vec3(.52,2.94,.165),.045),6.);
for(int i=0;i<2;i++){
float s=i==0?1.:-1.;
vec3 P=i==0?P1:P2;
vec3 hp=vec3(-.28,1.78,.2*s),ft=P+vec3(0.,.035,.12*s);
vec3 kn=mix(hp,ft,.5)+vec3(.3,.15,.02*s);
float lg=sC(p,hp,kn,.07);lg=min(lg,sC(p,kn,ft,.045));
lg=min(lg,sB(p-ft-vec3(.04,0.,0.),vec3(.12,.02,.06),.015));
U(r,lg,9.);}
return r;}
vec2 map(vec3 p){float ca=T*2.5;vec3 P1,P2;vec2 r=bike(p,ca,P1,P2);vec2 q=pelican(p,P1,P2);return q.x<r.x?q:r;}
vec3 calcN(vec3 p){vec2 e=vec2(1.,-1.)*.0006;return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
vec2 march(vec3 ro,vec3 rd,float t0,float t1){float t=t0;for(int i=0;i<120;i++){vec2 h=map(ro+rd*t);if(h.x<.0006*t+.0003)return vec2(t,h.y);t+=h.x*.92;if(t>t1)break;}return vec2(-1.,0.);}
bool bsph(vec3 ro,vec3 rd,out float t0,out float t1){vec3 oc=ro-BC;float b=dot(oc,rd),c=dot(oc,oc)-6.5,d=b*b-c;if(d<0.)return false;float s=sqrt(d);t0=max(-b-s,0.);t1=-b+s;return t1>t0;}
float shadow(vec3 ro,vec3 rd){float t0,t1;if(!bsph(ro,rd,t0,t1))return 1.;float t=max(t0,.02),res=1.;for(int i=0;i<40;i++){float h=map(ro+rd*t).x;res=min(res,12.*h/t);if(res<.005||t>t1)break;t+=clamp(h,.015,.2);}return clamp(res,0.,1.);}
float calcAO(vec3 p,vec3 n){float o=0.,s=1.;for(int i=1;i<=5;i++){float h=.015+.1*float(i)/5.;float d=map(p+n*h).x;o+=(h-d)*s;s*=.65;}return clamp(1.-2.2*o,0.,1.);}
vec3 sky(vec3 d){vec3 c=mix(vec3(.78,.86,.95),vec3(.24,.45,.86),clamp(d.y*1.3,0.,1.));c=mix(c,vec3(.48,.5,.5),smoothstep(0.,-.35,d.y));float s=max(dot(d,SUN),0.);c+=vec3(1.,.92,.75)*pow(s,96.)*.7+vec3(1.,.85,.65)*pow(s,6.)*.18;return c;}
void matl(float m,vec3 p,out vec3 alb,out float sp,out float gl){
alb=vec3(.5);sp=.3;gl=16.;
if(m<1.5){alb=vec3(.03,.03,.035);sp=.25;gl=12.;}
else if(m<2.5){alb=vec3(.72,.1,.09);sp=.9;gl=70.;}
else if(m<3.5){alb=vec3(.55,.56,.58);sp=1.2;gl=90.;}
else if(m<4.5){alb=vec3(.95,.93,.88)*(.96+.04*sin(p.x*45.+p.y*25.));sp=.08;gl=8.;}
else if(m<5.5){alb=vec3(1.,.62,.15);sp=.5;gl=30.;}
else if(m<6.5){alb=vec3(.02);sp=1.5;gl=150.;}
else if(m<7.5){alb=vec3(1.,.78,.4);sp=.3;gl=20.;}
else if(m<8.5){alb=vec3(.28,.16,.09);sp=.4;gl=25.;}
else if(m<9.5){alb=vec3(1.,.55,.18);sp=.3;gl=20.;}
else{float c=mod(floor(p.x)+floor(p.z),2.);alb=vec3(.46,.47,.42)*(.85+.15*c);sp=.05;gl=6.;}}
void main(){
vec2 uv=(2.*gl_FragCoord.xy-R)/R.y;
vec3 ta=vec3(0.,1.4,0.),ro=CP;
vec3 fw=normalize(ta-ro),rt=normalize(cross(fw,vec3(0.,1.,0.))),up=cross(rt,fw);
vec3 rd=normalize(fw*1.9+uv.x*rt+uv.y*up);
float tg=-ro.y/rd.y;if(tg<0.)tg=1e9;
float t=-1.,m=0.,t0,t1;
if(bsph(ro,rd,t0,t1)){t1=min(t1,tg);if(t1>t0){vec2 h=march(ro,rd,t0,t1);t=h.x;m=h.y;}}
if(t<0.&&tg<1e8){t=tg;m=10.;}
vec3 col;
if(t<0.)col=sky(rd);
else{
vec3 p=ro+rd*t;
vec3 n=m>9.5?vec3(0.,1.,0.):calcN(p);
vec3 alb;float sp,gl;matl(m,p,alb,sp,gl);
bool near=length(p-BC)<3.4;
float sh=near?shadow(p+n*.01,SUN):1.;
float ao=near?calcAO(p,n):1.;
float dif=max(dot(n,SUN),0.)*sh;
vec3 h=normalize(SUN-rd);
float spe=pow(max(dot(n,h),0.),gl)*sp*sh;
float sk=.5+.5*n.y;
col=alb*(dif*vec3(1.15,1.02,.9)*1.5+sk*vec3(.5,.62,.85)*.6*ao+vec3(.08)*ao)+spe*vec3(1.,.95,.9);
if(m>2.5&&m<3.5){vec3 rf=reflect(rd,n);col+=sky(rf)*ao*(.25+.5*pow(1.-max(dot(n,-rd),0.),3.));}
if(m>5.5&&m<6.5){col+=vec3(.6)*pow(max(dot(n,normalize(vec3(.3,.8,.9))),0.),60.);}
col=mix(col,sky(rd)*.9,1.-exp(-.004*t*t));}
col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);
col=pow(clamp(col,0.,1.),vec3(1./2.2));
O=vec4(col,1.);}`;
export function createPelicanSdf(canvas){
const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
if(!gl)throw new Error('WebGL2 is not available');
let prog=null,vao=null,uR=null,uT=null,uC=null,lost=false,disposed=false;
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)&&!gl.isContextLost()){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('Shader compilation failed: '+log);}return s;}
function build(){const v=sh(gl.VERTEX_SHADER,VS),f=sh(gl.FRAGMENT_SHADER,FS);const p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS)&&!gl.isContextLost()){const log=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error('Program link failed: '+log);}prog=p;uR=gl.getUniformLocation(p,'R');uT=gl.getUniformLocation(p,'T');uC=gl.getUniformLocation(p,'CP');vao=gl.createVertexArray();}
build();
const view={yaw:.65,pitch:.28,dist:6.5};
const TAU=Math.PI*2;
function clampView(){if(!isFinite(view.yaw))view.yaw=0;if(!isFinite(view.pitch))view.pitch=0;if(!isFinite(view.dist))view.dist=6.5;view.yaw=((view.yaw%TAU)+TAU)%TAU;view.pitch=Math.max(-1.5,Math.min(1.5,view.pitch));view.dist=Math.max(1.2,Math.min(16,view.dist));}
canvas.tabIndex=0;
canvas.style.touchAction='none';
canvas.style.userSelect='none';
canvas.style.outline='none';
const pointers=new Map();
let pinchDist=0;
const onDown=e=>{e.preventDefault();try{canvas.setPointerCapture(e.pointerId);}catch(_){}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()];pinchDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}try{canvas.focus({preventScroll:true});}catch(_){canvas.focus();}};
const onMove=e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const pt=pointers.get(e.pointerId);const dx=e.clientX-pt.x,dy=e.clientY-pt.y;pt.x=e.clientX;pt.y=e.clientY;if(pointers.size===1){view.yaw+=dx*.01;view.pitch+=dy*.01;clampView();}else if(pointers.size===2){const a=[...pointers.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchDist>0&&d>0){view.dist*=pinchDist/d;clampView();}pinchDist=d;}};
const onUp=e=>{if(pointers.has(e.pointerId)){pointers.delete(e.pointerId);try{canvas.releasePointerCapture(e.pointerId);}catch(_){}}pinchDist=0;if(pointers.size===2){const a=[...pointers.values()];pinchDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}};
const onWheel=e=>{e.preventDefault();let d=e.deltaY;if(e.deltaMode===1)d*=16;else if(e.deltaMode===2)d*=100;view.dist*=Math.exp(Math.max(-200,Math.min(200,d))*.0015);clampView();};
const onKey=e=>{let used=true;switch(e.key){case'ArrowLeft':view.yaw-=.08;break;case'ArrowRight':view.yaw+=.08;break;case'ArrowUp':view.pitch+=.06;break;case'ArrowDown':view.pitch-=.06;break;case'+':case'=':case'Add':view.dist*=.9;break;case'-':case'_':case'Subtract':view.dist/=.9;break;default:used=false;}if(used){e.preventDefault();clampView();}};
const onTouch=e=>{e.preventDefault();};
const onLost=e=>{e.preventDefault();lost=true;};
const onRestored=()=>{try{build();lost=false;}catch(err){lost=true;}};
const onCtx=e=>{e.preventDefault();};
canvas.addEventListener('pointerdown',onDown);
canvas.addEventListener('pointermove',onMove);
canvas.addEventListener('pointerup',onUp);
canvas.addEventListener('pointercancel',onUp);
canvas.addEventListener('lostpointercapture',onUp);
canvas.addEventListener('wheel',onWheel,{passive:false});
canvas.addEventListener('keydown',onKey);
canvas.addEventListener('touchstart',onTouch,{passive:false});
canvas.addEventListener('touchmove',onTouch,{passive:false});
canvas.addEventListener('contextmenu',onCtx);
canvas.addEventListener('webglcontextlost',onLost);
canvas.addEventListener('webglcontextrestored',onRestored);
return{
render(timeSeconds){
if(disposed||lost||!prog||gl.isContextLost())return;
const t=isFinite(timeSeconds)?timeSeconds:0;
const w=canvas.width,h=canvas.height;
if(!(w>0&&h>0))return;
const cp=Math.cos(view.pitch),sp=Math.sin(view.pitch);
const cx=Math.sin(view.yaw)*cp*view.dist,cy=1.4+sp*view.dist,cz=Math.cos(view.yaw)*cp*view.dist;
gl.viewport(0,0,w,h);
gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);
gl.useProgram(prog);
gl.bindVertexArray(vao);
gl.uniform2f(uR,w,h);
gl.uniform1f(uT,t);
gl.uniform3f(uC,cx,cy,cz);
gl.drawArrays(gl.TRIANGLES,0,3);
gl.bindVertexArray(null);
},
setView(yaw,pitch,distance){view.yaw=+yaw;view.pitch=+pitch;view.dist=+distance;clampView();},
getView(){return{yaw:view.yaw,pitch:view.pitch,distance:view.dist};},
dispose(){
if(disposed)return;disposed=true;
canvas.removeEventListener('pointerdown',onDown);
canvas.removeEventListener('pointermove',onMove);
canvas.removeEventListener('pointerup',onUp);
canvas.removeEventListener('pointercancel',onUp);
canvas.removeEventListener('lostpointercapture',onUp);
canvas.removeEventListener('wheel',onWheel);
canvas.removeEventListener('keydown',onKey);
canvas.removeEventListener('touchstart',onTouch);
canvas.removeEventListener('touchmove',onTouch);
canvas.removeEventListener('contextmenu',onCtx);
canvas.removeEventListener('webglcontextlost',onLost);
canvas.removeEventListener('webglcontextrestored',onRestored);
pointers.clear();
if(!gl.isContextLost()){try{if(vao)gl.deleteVertexArray(vao);if(prog)gl.deleteProgram(prog);}catch(_){}}
prog=null;vao=null;
}
};
}
