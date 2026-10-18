export function createPelicanSdf(canvas){
if(!canvas||typeof canvas.getContext!=='function')throw new Error('createPelicanSdf: an HTMLCanvasElement is required');
const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
if(!gl)throw new Error('createPelicanSdf: WebGL2 is not available');
const VS=`#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FS=`#version 300 es
precision highp float;
uniform vec2 uR,uW;
uniform vec3 uC,uX,uY,uZ;
uniform vec4 uA;
uniform vec3 uH[2],uK[2],uF[2],uP[2];
out vec4 oC;
const vec3 SUN=vec3(.532,.726,.436),RH=vec3(-.75,.4,0),FH=vec3(.75,.4,0),BB=vec3(-.06,.33,0),FOG=vec3(.68,.74,.72);
const vec3 BMN=vec3(-1.17,0.,-.4),BMX=vec3(1.17,2.2,.4);
mat2 R2(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
float sB(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sC(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sT(vec3 p,vec3 a,vec3 b,float r,float s){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(r,s,h);}
float sE(vec3 p,vec3 r){float a=length(p/r),b=length(p/(r*r));return a*(a-1.)/max(b,1e-6);}
float sm(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float cy(vec3 p,float r,float h){vec2 d=vec2(length(p.xy)-r,abs(p.z)-h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
float sUC(vec2 p,float r1,float r2,float h){p.x=abs(p.x);float b=(r1-r2)/h,a=sqrt(1.-b*b),k=dot(p,vec2(-b,a));if(k<0.)return length(p)-r1;if(k>a*h)return length(p-vec2(0,h))-r2;return dot(p,vec2(a,b))-r1;}
void U(inout vec2 r,float d,float m){if(d<r.x)r=vec2(d,m);}
void wh(vec3 q,inout vec2 r){
 float l=length(q.xy);
 U(r,length(vec2(l-.365,q.z))-.035,1.);
 vec2 e=abs(vec2(l-.316,q.z))-vec2(.014,.009);
 U(r,length(max(e,0.))+min(max(e.x,e.y),0.)-.004,3.);
 U(r,cy(q,.024,.058)-.005,3.);
 if(l<.32){
  vec2 w=mat2(uW.x,-uW.y,uW.y,uW.x)*q.xy;
  float i=floor(atan(w.y,w.x)/.3926991+.5);
  w=R2(-i*.3926991)*w;
  U(r,sC(vec3(w,q.z),vec3(.025,0,mod(i,2.)<.5?.04:-.04),vec3(.31,0,0),.004),3.);
 }
}
void fr(vec3 p,inout vec2 r){
 vec3 q=vec3(p.xy,abs(p.z));
 float d=sC(p,BB,vec3(-.28,1.,0),.026);
 d=min(d,sC(p,vec3(-.272,.975,0),vec3(.56,.99,0),.024));
 d=min(d,sC(p,BB,vec3(.6,.875,0),.03));
 d=min(d,sC(q,vec3(-.75,.4,.05),vec3(-.27,.95,.018),.013));
 d=min(d,sC(q,vec3(-.75,.4,.05),vec3(-.08,.335,.03),.015));
 U(r,d,2.);
 U(r,sC(p,vec3(-.28,1.,0),vec3(-.31,1.09,0),.017),3.);
 U(r,sm(sE(p-vec3(-.39,1.125,0),vec3(.085,.03,.08)),sE(p-vec3(-.28,1.12,0),vec3(.11,.024,.032)),.04),4.);
 float b=sB(p-vec3(.625,.765,0),vec3(.185,.405,.3));
 if(b<.03){
  d=sC(p,vec3(.609,.848,0),vec3(.552,1.03,0),.034);
  d=min(d,sT(q,vec3(.612,.835,.04),vec3(.75,.4,.05),.019,.012));
  d=min(d,sC(p,vec3(.612,.838,-.045),vec3(.612,.838,.045),.022));
  U(r,d,2.);
  d=sC(p,vec3(.552,1.03,0),vec3(.57,1.09,0),.02);
  d=min(d,sC(p,vec3(.57,1.09,0),vec3(.64,1.1,0),.018));
  d=min(d,sC(q,vec3(.64,1.1,0),vec3(.64,1.1,.2),.013));
  d=min(d,sC(q,vec3(.64,1.1,.2),vec3(.565,1.117,.243),.013));
  d=min(d,sC(q,vec3(.75,.4,0),vec3(.75,.4,.07),.011));
  U(r,d,3.);
  U(r,sC(q,vec3(.565,1.117,.243),vec3(.485,1.13,.272),.021),4.);
 }else r.x=min(r.x,b);
 b=sB(p-vec3(-.335,.335,0),vec3(.5,.19,.21));
 if(b<.03){
  vec3 c=p-BB;float l=length(c.xy);
  d=cy(c,.034,.075);
  d=min(d,sC(p,BB+vec3(0,0,.085),vec3(uP[0].xy,.085),.013));
  d=min(d,sC(p,BB-vec3(0,0,.085),vec3(uP[1].xy,-.085),.013));
  d=min(d,max(abs(l-.085)-.016,abs(c.z-.07)-.004));
  d=min(d,max(length((p-RH).xy)-.048,abs(p.z-.07)-.005));
  d=min(d,sC(q,vec3(-.75,.4,0),vec3(-.75,.4,.075),.011));
  vec2 cl=vec2(dot(c.xy,vec2(.10093,.9949)),dot(c.xy,vec2(-.9949,.10093)));
  d=min(d,max(abs(sUC(cl,.104,.052,.6935))-.0045,abs(c.z-.07)-.0045));
  U(r,d,3.);
  U(r,min(sB(p-uP[0],vec3(.042,.009,.042)),sB(p-uP[1],vec3(.042,.009,.042)))-.007,13.);
 }else r.x=min(r.x,b);
}
void pel(vec3 p,inout vec2 r){
 vec3 pp=p-vec3(0,uA.z,0),w=vec3(pp.xy,abs(pp.z));
 vec3 b=pp-vec3(-.2,1.38,0);b.xy=mat2(.9394,-.3429,.3429,.9394)*b.xy;
 float d=sm(sE(b,vec3(.37,.24,.25)),sE(pp-vec3(-.02,1.5,0),vec3(.19,.2,.19)),.12);
 d=sm(d,sm(sT(pp,vec3(0,1.52,0),vec3(.13,1.76,0),.11,.075),sT(pp,vec3(.13,1.76,0),vec3(.09,1.93,0),.075,.066),.05),.08);
 b=pp-vec3(-.56,1.29,0);b.xy=mat2(.9394,.3429,-.3429,.9394)*b.xy;
 d=sm(d,sE(b,vec3(.14,.04,.11)),.05);
 vec3 hc=pp-vec3(.1,2.,0);
 float hb=sB(pp-vec3(.36,1.96,0),vec3(.52,.25,.15));
 if(hb<.03){
  float hd=sm(sE(hc,vec3(.13,.105,.1)),sT(pp,vec3(0,2.05,0),vec3(-.1,2.1,0),.04,.012),.03);
  U(r,sm(d,hd,.05),hd<d?12.:5.);
  vec3 q=pp-vec3(.19,1.985,0);q.xy=mat2(.9801,.1987,-.1987,.9801)*q.xy;q.y+=.08*q.x*q.x;
  U(r,sT(vec3(q.x,q.y*2.,q.z),vec3(0),vec3(.6,0,0),.052,.026)*.5,8.);
  U(r,sE(q-vec3(.59,-.02,0),vec3(.035,.022,.02)),14.);
  U(r,max(sE(q-vec3(.24,-.075,0),vec3(.29,.08,.05)),q.y+.004),9.);
  vec3 e=vec3(hc.xy,abs(hc.z));
  U(r,length(e-vec3(.045,.028,.08))-.026,9.);
  U(r,length(e-vec3(.052,.03,.093))-.0165,11.);
 }else{U(r,d,5.);r.x=min(r.x,hb);}
 b=w-vec3(-.23,1.4,.205);b.xy=mat2(.9553,-.2955,.2955,.9553)*b.xy;
 vec3 S=vec3(-.01,1.52,.2),E=vec3(.17,1.33,.31),H=vec3(.505,1.145-uA.z,.255);
 float g=sm(sE(b,vec3(.32,.16,.065)),sT(w,S,E,.065,.045),.04);
 g=sm(g,sT(w,E,H,.045,.032),.03);
 b=w-vec3(.338,1.208,.283);b.xy=mat2(.875,.484,-.484,.875)*b.xy;
 U(r,sm(g,sE(b,vec3(.19,.055,.02)),.03),6.);
 b=w-vec3(-.5,1.31,.17);b.xy=mat2(.9394,-.3429,.3429,.9394)*b.xy;
 U(r,min(sE(b,vec3(.22,.05,.04)),sE(w-H,vec3(.065,.045,.042))),7.);
}
void lg(vec3 p,inout vec2 r){
 for(int i=0;i<2;i++){
  U(r,sT(p,uH[i],uK[i],.075,.042),5.);
  vec3 f=p-uP[i]-vec3(.03,.027,0);
  float d=sE(f,vec3(.07,.012,.042));
  d=min(d,sC(f,vec3(-.02,0,0),vec3(.1,0,.04),.01));
  d=min(d,sC(f,vec3(-.02,0,0),vec3(.105,0,0),.01));
  d=min(d,sC(f,vec3(-.02,0,0),vec3(.1,0,-.04),.01));
  U(r,sm(sT(p,uK[i],uF[i],.03,.022),d,.03),10.);
 }
}
vec2 map(vec3 p){
 vec2 r=vec2(1e5,0.);
 vec3 q=p-(p.x<0.?RH:FH);float b=max(length(q.xy)-.41,abs(q.z)-.07);
 if(b<.03)wh(q,r);else r.x=min(r.x,b);
 b=sB(p-vec3(-.01,.66,0),vec3(.82,.52,.3));
 if(b<.03)fr(p,r);else r.x=min(r.x,b);
 b=sB(p-vec3(.04,1.61,0),vec3(.8,.57,.37));
 if(b<.03)pel(p,r);else r.x=min(r.x,b);
 b=sB(p-vec3(.05,.725,0),vec3(.42,.575,.3));
 if(b<.03)lg(p,r);else r.x=min(r.x,b);
 return r;
}
vec2 bx(vec3 ro,vec3 rd){vec3 ir=1./(rd+vec3(1e-7)),a=(BMN-ro)*ir,b=(BMX-ro)*ir,mn=min(a,b),mx=max(a,b);return vec2(max(max(mn.x,mn.y),mn.z),min(min(mx.x,mx.y),mx.z));}
vec3 nor(vec3 p,float t){float e=.0002+t*.0003;vec3 n=vec3(0);for(int i=0;i<4;i++){vec3 k=.5773*(2.*vec3(float(((i+3)>>1)&1),float((i>>1)&1),float(i&1))-1.);n+=k*map(p+k*e).x;}return normalize(n);}
float shd(vec3 ro,vec3 rd){
 vec2 b=bx(ro,rd);if(b.x>b.y||b.y<0.)return 1.;
 float t=max(b.x,.004),s=1.;
 for(int i=0;i<48;i++){float h=map(ro+rd*t).x;s=min(s,12.*h/t);t+=clamp(h,.008,.15);if(s<.002||t>b.y)break;}
 s=clamp(s,0.,1.);return s*s*(3.-2.*s);
}
float ao(vec3 p,vec3 n){float o=0.,w=1.;for(int i=0;i<4;i++){float h=.012+.06*float(i);float d=min(map(p+n*h).x,p.y+n.y*h);o+=(h-d)*w;w*=.7;}return clamp(1.-2.2*o,0.,1.);}
vec3 sky(vec3 d){
 float y=max(d.y,0.),s=max(dot(d,SUN),0.);
 vec3 c=mix(vec3(.9,.86,.78),vec3(.3,.52,.85),pow(y,.5));
 vec2 u=d.xz/(y+.15);
 float k=sin(u.x*1.2+sin(u.y*.8))*sin(u.y*1.1+.6*sin(u.x*1.9));
 c=mix(c,vec3(1),smoothstep(.3,.9,k)*smoothstep(.02,.3,y)*.5);
 c+=vec3(1.,.85,.6)*(pow(s,800.)*8.+pow(s,10.)*.15);
 float a=atan(d.z,d.x),hh=.028+.02*sin(a*3.+1.)+.01*sin(a*7.3+2.);
 return mix(c,mix(c,vec3(.45,.6,.55),.7),smoothstep(hh+.003,hh-.003,d.y));
}
vec3 env(vec3 d){return d.y>0.?sky(d):mix(vec3(.16,.2,.12),FOG,exp(d.y*6.));}
float sq(float x,float w){return clamp((abs(fract(x)-.5)*2.-.5)/max(w,1e-4)+.5,0.,1.);}
float ln(float d,float w,float f){return clamp((w-abs(d))/max(f,1e-4)+.5,0.,1.);}
vec3 grd(vec3 g,vec2 f){
 float u=g.x+uA.w,z=abs(g.z);
 vec3 gr=mix(vec3(.17,.33,.08),vec3(.24,.42,.12),sq(u*.25,f.x*.5));
 vec3 ac=vec3(.2,.2,.21)*(1.+.1*sin(u*1.3+g.z*2.)*sin(u*.7-g.z*1.7));
 ac=mix(ac,vec3(.85),ln(z-1.3,.035,f.y));
 ac=mix(ac,vec3(.9,.72,.2),ln(g.z+.95,.03,f.y)*sq(u*.5,f.x));
 return mix(ac,gr,clamp((z-1.42)/max(f.y,1e-3)+.5,0.,1.));
}
void main(){
 vec2 uv=(2.*gl_FragCoord.xy-uR)/uR.y;
 vec3 ro=uC,rd=normalize(uX*uv.x+uY*uv.y+uZ*1.8);
 float tg=(rd.y<-1e-4&&ro.y>0.)?-ro.y/rd.y:1e9;
 vec3 g=ro+rd*min(tg,1e4);
 vec2 fw=vec2(fwidth(g.x),fwidth(g.z));
 vec2 bb=bx(ro,rd);
 float t=max(bb.x,.02),te=min(bb.y,tg);
 vec2 h=vec2(1,0);bool hit=false;
 if(bb.x<bb.y&&bb.y>0.){
  for(int i=0;i<128;i++){h=map(ro+rd*t);if(h.x<.0002+t*.0005){hit=true;break;}t+=h.x*.95;if(t>te)break;}
 }
 vec3 col;
 if(!hit&&tg>1e8)col=sky(rd);
 else{
  vec3 p,n;int m;
  if(hit){p=ro+rd*t;n=nor(p,t);m=int(h.y+.5);}else{p=g;n=vec3(0,1,0);m=0;}
  vec3 al=vec3(.5);float sp=0.,gl=16.,mt=0.,wr=0.,cc=0.;
  if(m==0)al=grd(p,fw);
  else if(m==1){al=vec3(.03);sp=.3;gl=24.;}
  else if(m==2){al=vec3(.02,.36,.42);sp=.8;gl=90.;cc=1.;}
  else if(m==3){al=vec3(.8,.82,.85);mt=1.;sp=1.;gl=140.;}
  else if(m==4){al=vec3(.22,.1,.05);sp=.3;gl=20.;}
  else if(m==5){al=vec3(.93,.92,.88);wr=.35;}
  else if(m==6){al=vec3(.8,.81,.83);wr=.3;}
  else if(m==7){al=vec3(.08,.08,.09);sp=.2;gl=20.;wr=.2;}
  else if(m==8){al=vec3(.98,.66,.16);sp=.5;gl=50.;}
  else if(m==9){al=vec3(.96,.46,.33);sp=.35;gl=30.;wr=.2;}
  else if(m==10){al=vec3(.97,.52,.18);sp=.3;gl=30.;}
  else if(m==11){al=vec3(.01);sp=2.;gl=300.;cc=1.;}
  else if(m==12){al=vec3(1.,.88,.58);wr=.35;vec3 c=p-vec3(.1,2.+uA.z,0);c.z=abs(c.z);al=mix(al,vec3(1.,.48,.42),smoothstep(.045,.018,length(c-vec3(.07,-.035,.07))));}
  else if(m==13){al=vec3(.07,.07,.08);sp=.4;gl=40.;}
  else{al=vec3(.85,.3,.12);sp=.5;gl=50.;}
  float nl=dot(n,SUN);
  float sh=nl>-wr?shd(p+n*(.003+wr*.04),SUN):0.;
  float oc=(m>0||(abs(p.x)<1.7&&abs(p.z)<.9))?ao(p,n):1.;
  float dif=clamp((nl+wr)/(1.+wr),0.,1.);
  float fr=pow(1.-clamp(dot(n,-rd),0.,1.),5.);
  vec3 sc=vec3(1.45,1.3,1.1);
  col=al*(sc*dif*sh+vec3(.32,.42,.6)*(.6+.4*n.y)*oc+vec3(.3,.25,.18)*clamp(.5-.5*n.y,0.,1.)*oc)*(1.-mt*.8);
  vec3 rf=reflect(rd,n);
  if(mt+cc>0.)col+=env(rf)*(mt*al+cc*(.04+.5*fr))*(.3+.7*oc);
  col+=sc*sp*pow(clamp(dot(n,normalize(SUN-rd)),0.,1.),gl)*(gl+8.)/40.*sh*step(0.,nl);
  col+=vec3(.55,.65,.85)*fr*wr*.5*oc;
  if(m==0)col=mix(col,FOG,1.-exp(-.03*tg));
 }
 col=max(col,0.);col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);
 vec2 v=gl_FragCoord.xy/uR-.5;col*=1.-.25*dot(v,v);
 oC=vec4(pow(clamp(col,0.,1.),vec3(.4545)),1);
}`;
const TAU=Math.PI*2,DEF=[0,1.08,0],MIND=.35,MAXD=9,FL=1.8,ROT=.0085,L1=.48,L2=.52;
const NAMES=['uR','uW','uC','uX','uY','uZ','uA','uH','uK','uF','uP'];
let prog=null,vao=null,L={},lost=false,dead=false;
let yaw=.62,pitch=.2,dist=3.5;const tgt=DEF.slice();
function mk(type,src){const s=gl.createShader(type);if(!s)throw new Error('createPelicanSdf: could not create shader');gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s)||'unknown error';gl.deleteShader(s);throw new Error('createPelicanSdf: shader compilation failed: '+log);}return s;}
function init(){const v=mk(gl.VERTEX_SHADER,VS),f=mk(gl.FRAGMENT_SHADER,FS),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.detachShader(p,v);gl.detachShader(p,f);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const log=gl.getProgramInfoLog(p)||'unknown error';gl.deleteProgram(p);throw new Error('createPelicanSdf: shader program link failed: '+log);}prog=p;vao=gl.createVertexArray();L={};for(const n of NAMES)L[n]=gl.getUniformLocation(p,n);}
if(gl.isContextLost())lost=true;else init();
function clampT(){tgt[0]=Math.min(1.3,Math.max(-1.3,tgt[0]));tgt[1]=Math.min(2.1,Math.max(.15,tgt[1]));tgt[2]=Math.min(.5,Math.max(-.5,tgt[2]));}
function clampV(){if(!Number.isFinite(yaw))yaw=0;if(!Number.isFinite(pitch))pitch=0;if(!Number.isFinite(dist))dist=3.5;dist=Math.min(MAXD,Math.max(MIND,dist));const mn=Math.max(-.5,-Math.asin(Math.min(1,Math.max(0,(tgt[1]-.05)/dist))));pitch=Math.min(1.5,Math.max(mn,pitch));}
function basis(){const cp=Math.cos(pitch),sp=Math.sin(pitch),sy=Math.sin(yaw),cy=Math.cos(yaw);return{p:[tgt[0]+sy*cp*dist,tgt[1]+sp*dist,tgt[2]+cy*cp*dist],x:[cy,0,-sy],y:[-sy*sp,cp,-cy*sp],z:[-sy*cp,-sp,-cy*cp]};}
function zoom(f,nx,ny){const nd=Math.min(MAXD,Math.max(MIND,dist*f)),k=nd/dist;
if(k<1&&nx!==undefined){const c=basis(),a=canvas.width/Math.max(1,canvas.height),ux=(2*nx-1)*a,uy=1-2*ny,s=dist/FL;for(let i=0;i<3;i++){const P=c.p[i]+(c.x[i]*ux+c.y[i]*uy+c.z[i]*FL)*s;tgt[i]=P+(tgt[i]-P)*k;}}
else if(k>1){const g=Math.pow(1/k,1.5);for(let i=0;i<3;i++)tgt[i]=DEF[i]+(tgt[i]-DEF[i])*g;}
dist=nd;clampT();clampV();}
function ik(h,a,sd){const d=[a[0]-h[0],a[1]-h[1],a[2]-h[2]],l=Math.hypot(d[0],d[1],d[2])||1e-6,n=d.map(v=>v/l),lc=Math.min(Math.max(l,.05),L1+L2-1e-4),x=(lc*lc+L1*L1-L2*L2)/(2*lc),y=Math.sqrt(Math.max(L1*L1-x*x,0));let b=[1,0,.3*sd];const k=b[0]*n[0]+b[1]*n[1]+b[2]*n[2];b=b.map((v,i)=>v-n[i]*k);const bl=Math.hypot(b[0],b[1],b[2])||1;return[0,1,2].map(i=>h[i]+n[i]*x+b[i]/bl*y);}
const fH=new Float32Array(6),fK=new Float32Array(6),fF=new Float32Array(6),fP=new Float32Array(6);
function render(time){
if(dead||lost||!prog||gl.isContextLost())return;
let t=+time;if(!Number.isFinite(t))t=0;
const th=-((t*3.6)%TAU),ph=-((t*8.64)%TAU),bob=.012*Math.cos(2*th),sc=(t*3.456)%8,c=Math.cos(th)*.15,s=Math.sin(th)*.15;
for(let i=0;i<2;i++){const sd=i?-1:1,px=-.06+c*sd,py=.33+s*sd,pz=.15*sd,h=[-.1,1.2+bob,.11*sd],a=[px-.015,py+.055,pz];fP.set([px,py,pz],i*3);fH.set(h,i*3);fF.set(a,i*3);fK.set(ik(h,a,sd),i*3);}
const cb=basis(),W=gl.drawingBufferWidth,Hh=gl.drawingBufferHeight;
gl.viewport(0,0,W,Hh);gl.useProgram(prog);gl.bindVertexArray(vao);
gl.uniform2f(L.uR,W,Hh);gl.uniform2f(L.uW,Math.cos(ph),Math.sin(ph));
gl.uniform3fv(L.uC,cb.p);gl.uniform3fv(L.uX,cb.x);gl.uniform3fv(L.uY,cb.y);gl.uniform3fv(L.uZ,cb.z);
gl.uniform4f(L.uA,th,ph,bob,sc);
gl.uniform3fv(L.uH,fH);gl.uniform3fv(L.uK,fK);gl.uniform3fv(L.uF,fF);gl.uniform3fv(L.uP,fP);
gl.drawArrays(gl.TRIANGLES,0,3);
}
const pts=new Map();let span=0;
function rel(x,y){const r=canvas.getBoundingClientRect();return[(x-r.left)/(r.width||1),(y-r.top)/(r.height||1)];}
function two(){if(pts.size<2)return null;const it=pts.values(),a=it.next().value,b=it.next().value;return{s:Math.hypot(a[0]-b[0],a[1]-b[1]),x:(a[0]+b[0])/2,y:(a[1]+b[1])/2};}
const onDown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();try{canvas.focus({preventScroll:true});}catch(_){}try{canvas.setPointerCapture(e.pointerId);}catch(_){}pts.set(e.pointerId,[e.clientX,e.clientY]);const q=two();span=q?q.s:0;};
const onMove=e=>{const q=pts.get(e.pointerId);if(!q)return;e.preventDefault();const dx=e.clientX-q[0],dy=e.clientY-q[1];q[0]=e.clientX;q[1]=e.clientY;
if(pts.size===1){yaw-=dx*ROT;pitch+=dy*ROT;clampV();}
else{const g=two();if(g&&span>1&&g.s>1){const r=rel(g.x,g.y);zoom(span/g.s,r[0],r[1]);}span=g?g.s:0;}};
const onUp=e=>{if(!pts.delete(e.pointerId))return;try{canvas.releasePointerCapture(e.pointerId);}catch(_){}const q=two();span=q?q.s:0;};
const onWheel=e=>{e.preventDefault();let d=e.deltaY;if(e.deltaMode===1)d*=16;else if(e.deltaMode===2)d*=400;if(e.ctrlKey)d*=3;d=Math.max(-300,Math.min(300,d));const r=rel(e.clientX,e.clientY);zoom(Math.exp(d*.0015),r[0],r[1]);};
const onKey=e=>{const k=e.key;let u=true;
if(k==='ArrowLeft')yaw-=.1;else if(k==='ArrowRight')yaw+=.1;else if(k==='ArrowUp')pitch+=.08;else if(k==='ArrowDown')pitch-=.08;
else if(k==='+'||k==='='||k==='Add')zoom(.85);else if(k==='-'||k==='_'||k==='Subtract')zoom(1/.85);else u=false;
if(u){e.preventDefault();clampV();}};
const onDbl=e=>{e.preventDefault();tgt[0]=DEF[0];tgt[1]=DEF[1];tgt[2]=DEF[2];clampV();};
const onLost=e=>{e.preventDefault();lost=true;prog=null;vao=null;};
const onRestored=()=>{if(dead)return;lost=false;try{init();}catch(_){prog=null;vao=null;}};
const prevTA=canvas.style.touchAction,prevTab=canvas.getAttribute('tabindex');
canvas.style.touchAction='none';if(prevTab===null)canvas.setAttribute('tabindex','0');
const LS=[['pointerdown',onDown,{passive:false}],['pointermove',onMove,{passive:false}],['pointerup',onUp],['pointercancel',onUp],['lostpointercapture',onUp],['wheel',onWheel,{passive:false}],['keydown',onKey],['dblclick',onDbl],['webglcontextlost',onLost],['webglcontextrestored',onRestored]];
for(const [n,f,o] of LS)canvas.addEventListener(n,f,o||false);
clampV();
return{
render,
setView(y,p,d){if(Number.isFinite(+y))yaw=+y;if(Number.isFinite(+p))pitch=+p;if(Number.isFinite(+d))dist=+d;tgt[0]=DEF[0];tgt[1]=DEF[1];tgt[2]=DEF[2];clampV();},
getView(){return{yaw,pitch,distance:dist};},
dispose(){if(dead)return;dead=true;for(const [n,f,o] of LS)canvas.removeEventListener(n,f,o||false);
for(const id of pts.keys()){try{canvas.releasePointerCapture(id);}catch(_){}}pts.clear();
canvas.style.touchAction=prevTA;if(prevTab===null)canvas.removeAttribute('tabindex');
try{if(!gl.isContextLost()){if(prog)gl.deleteProgram(prog);if(vao)gl.deleteVertexArray(vao);}}catch(_){}prog=null;vao=null;}
};
}
