export function createPelicanSdf(canvas){
const gl=canvas&&canvas.getContext?canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true,powerPreference:'high-performance'}):null;
if(!gl)throw new Error('createPelicanSdf: WebGL2 is not available');
const VS='#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}';
const FS=`#version 300 es
precision highp float;
out vec4 fc;
uniform vec2 uR;uniform vec3 uC;uniform mat3 uM;uniform float uW,uB,uG,uK;
uniform vec3 uHP,uPR,uPL,uKR,uKL,uAR,uAL,uHR,uHL;
const vec3 L=vec3(-.381,.762,.524),RA=vec3(-.52,.342,0),FA=vec3(.53,.342,0),BB=vec3(-.02,.3,0),ST=vec3(-.165,.8,0),HT=vec3(.36,.87,0),HB=vec3(.4,.72,0),HN=vec3(.31,.99,0),FOG=vec3(.66,.72,.68);
vec2 res;
void U(float d,float m){if(d<res.x)res=vec2(d,m);}
float rs(float a,float b,float x){return 1.-smoothstep(a,b,x);}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float sE(vec3 p,vec3 r){float a=length(p/r),b=length(p/(r*r));return a*(a-1.)/b;}
float sC(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.))-r;}
float sB(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sR(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 ba=b-a;float l2=dot(ba,ba),rr=r1-r2,a2=l2-rr*rr,il=1./l2;vec3 pa=p-a;float y=dot(pa,ba),z=y-l2;vec3 xv=pa*l2-ba*y;float x2=dot(xv,xv),y2=y*y*l2,z2=z*z*l2,k=sign(rr)*rr*rr*x2;if(sign(z)*a2*z2>k)return sqrt(x2+z2)*il-r2;if(sign(y)*a2*y2<k)return sqrt(x2+y2)*il-r1;return(sqrt(x2*a2*il)+y*rr)*il-r1;}
void wheel(vec3 q){
float r=length(q.xy),b=max(r-.36,abs(q.z)-.085);
if(b>.04){U(b,0.);return;}
U(length(vec2(r-.312,q.z))-.03,2.);
U(length(vec2(r-.284,q.z*.8))-.012,3.);
U(min(sC(q,vec3(0,0,-.064),vec3(0,0,.064),.014),max(r-.03,abs(abs(q.z)-.03)-.004)),3.);
float s=max(abs(q.z)-.034,r-.288);
if(s>.01){U(s,0.);return;}
float a=atan(q.y,q.x)+uW,id=floor(a*2.86479+.5),c=a-id*.349066;
vec2 v=r*vec2(cos(c),sin(c));
float zs=(mod(id,2.)*2.-1.)*.028*(1.-clamp(v.x,0.,.284)/.284);
U(length(vec3(v.x-clamp(v.x,.02,.284),v.y,q.z-zs))-.0028,3.);
}
void frame(vec3 p){
vec3 q=vec3(p.xy,abs(p.z));
float b=sB(p-vec3(0,.62,0),vec3(.56,.36,.1));
if(b>.04){U(b,0.);return;}
float f=sC(p,BB,ST,.021);
f=smin(f,sC(p,ST-vec3(0,.01,0),vec3(.37,.835,0),.019),.015);
f=smin(f,sC(p,BB,vec3(.395,.745,0),.025),.02);
f=smin(f,sC(p,HT,HB,.03),.015);
f=smin(f,sC(q,vec3(-.03,.3,.035),RA+vec3(0,0,.06),.012),.02);
f=smin(f,sC(q,ST+vec3(.005,-.03,.035),RA+vec3(0,0,.06),.011),.02);
f=smin(f,sB(p-vec3(.405,.705,0),vec3(.022,.01,.058))-.008,.015);
f=min(f,sC(q,vec3(.41,.7,.05),FA+vec3(0,0,.05),.012));
f=min(f,sC(p,BB-vec3(0,0,.045),BB+vec3(0,0,.045),.027));
U(f,1.);
U(sC(p,ST,vec3(-.195,.9,0),.015),3.);
U(smin(sE(p-vec3(-.215,.915,0),vec3(.085,.028,.075)),sE(p-vec3(-.11,.92,0),vec3(.085,.02,.03)),.04),4.);
}
void bars(vec3 p){
vec3 q=vec3(p.xy,abs(p.z));
float b=sB(p-vec3(.33,.93,0),vec3(.08,.09,.29));
if(b>.04){U(b,0.);return;}
U(sC(p,HT,vec3(.35,.975,0),.016),3.);
float c=sC(q,vec3(.35,.975,0),vec3(.35,.975,.16),.013);
c=smin(c,sC(q,vec3(.35,.975,.16),vec3(.3,.985,.25),.013),.02);
U(c,3.);
U(max(length(p-vec3(.35,.99,-.1))-.022,.982-p.y),14.);
U(sC(q,vec3(.332,.978,.19),vec3(.297,.986,.252),.02),11.);
}
void drive(vec3 p){
float b=sB(p-vec3(-.19,.3,0),vec3(.42,.21,.2));
if(b>.04){U(b,0.);return;}
vec3 d=p-BB;float r=length(d.xy),z=abs(p.z-.08);
float c=max(abs(r-.086)-.01,z-.0035);
float a=mod(atan(d.y,d.x)+uK+.6283,1.2566)-.6283;
vec2 v=r*vec2(cos(a),sin(a));
c=min(c,max(max(abs(v.x-.045)-.04,abs(v.y)-.008),z-.003));
c=min(c,max(length((p-RA).xy)-.042,z-.004));
c=min(c,sC(p,BB-vec3(0,0,.1),BB+vec3(0,0,.1),.011));
c=min(c,min(sC(p,vec3(BB.xy,.1),vec3(uPR.xy,.1),.013),sC(p,vec3(BB.xy,-.1),vec3(uPL.xy,-.1),.013)));
c=min(c,min(sC(p,vec3(uPR.xy,.1),uPR,.006),sC(p,vec3(uPL.xy,-.1),uPL,.006)));
U(c,3.);
float ch=sR(vec3(p.xy,0),BB,RA,.094,.044);
U(max(abs(ch)-.0045,z-.0045),13.);
U(min(sB(p-uPR,vec3(.045,.011,.04)),sB(p-uPL,vec3(.045,.011,.04)))-.004,12.);
}
void leg(vec3 p,vec3 H,vec3 K,vec3 A,vec3 P){
float b=min(sC(p,H,K,.13),sC(p,K,P,.15));
if(b>.04){U(b,0.);return;}
U(sR(p,H,mix(H,K,.5),.085,.05),5.);
float l=smin(sR(p,H,K,.042,.03),sR(p,K,A,.03,.022),.02);
vec3 f=p-P-vec3(.03,.026,0),g=vec3(f.xy,abs(f.z));
float t=sE(f,vec3(.065,.009,.045));
t=smin(t,sC(f,vec3(-.03,0,0),vec3(.075,0,0),.011),.015);
t=smin(t,sC(g,vec3(-.03,0,0),vec3(.058,0,.045),.01),.015);
U(smin(l,t,.03),8.);
}
void bird(vec3 p){
float bb=sB(p-vec3(.12,1.4,0),vec3(.82,.56,.3));
if(bb>.04){U(bb,0.);return;}
vec3 c=p-vec3(-.12,1.2+uB,0),q=vec3(.9*c.x+.435*c.y,.9*c.y-.435*c.x,c.z),h=p-uHP,nm=vec3(.06,1.5+uB,0)+.5*(uHP-vec3(.19,1.74,0));
float f=smin(sE(q,vec3(.37,.25,.24)),sE(q-vec3(-.38,.03,0),vec3(.15,.04,.12)),.06);
f=smin(f,sR(p,vec3(.13,1.3+uB,0),nm,.105,.065),.06);
f=smin(f,sR(p,nm,uHP+vec3(-.035,-.07,0),.065,.058),.04);
f=smin(f,sE(h,vec3(.12,.095,.085)),.05);
f=smin(f,sR(h,vec3(-.06,.07,0),vec3(-.16,.1,0),.03,.008),.03);
float m=5.;
vec3 w=vec3(p.xy,0),S=vec3(-.02,1.27+uB,0);
float d=smin(sR(w,vec3(-.34,1.16+uB,0),S,.09,.13),sR(w,S,HN,.12,.035),.05);
vec2 e=vec2(d,abs(abs(p.z)-.2-.03*clamp((p.x+.34)/.65,0.,1.))-.01-.35*clamp(-d,0.,.06));
float g=(min(max(e.x,e.y),0.)+length(max(e,0.))-.018)*.8;
if(g<f)m=10.;f=smin(f,g,.025);
vec3 s=vec3(h.xy,h.z*1.3);
g=smin(sR(s,vec3(.07,-.005,0),vec3(.64,-.115,0),.04,.019)/1.3,length(h-vec3(.655,-.132,0))-.02,.02);
if(g<f)m=6.;f=smin(f,g,.03);
s=vec3(h.xy,h.z*1.45);
g=smin(sR(s,vec3(.1,-.055,0),vec3(.6,-.13,0),.06,.016),sE(s-vec3(.3,-.14,0),vec3(.21,.075,.075)),.06)/1.45;
if(g<f)m=7.;f=smin(f,g,.012);
s=vec3(h.xy,abs(h.z));
g=length(s-vec3(.04,.02,.06))-.03;
if(g<f)m=7.;f=smin(f,g,.01);
g=length(s-vec3(.052,.024,.074))-.017;
if(g<f){f=g;m=9.;}
U(f,m);
}
vec2 map(vec3 p){res=vec2(1e5,0);wheel(p-RA);wheel(p-FA);frame(p);bars(p);drive(p);bird(p);leg(p,uHR,uKR,uAR,uPR);leg(p,uHL,uKL,uAL,uPL);return res;}
vec2 box(vec3 o,vec3 d){vec3 i=1./d,a=(vec3(-.92,-.01,-.32)-o)*i,b=(vec3(.95,1.96,.32)-o)*i,n=min(a,b),f=max(a,b);return vec2(max(max(n.x,n.y),n.z),min(min(f.x,f.y),f.z));}
vec3 nor(vec3 p,float t){float e=.0004+.0002*t;vec3 n=vec3(0);for(int i=0;i<4;i++){vec3 k=.5773*(2.*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.);n+=k*map(p+k*e).x;}return normalize(n);}
float occ(vec3 p,vec3 n,float s){float o=0.,w=1.;for(int i=0;i<4;i++){float h=s*(.01+.045*float(i));o+=(h-map(p+n*h).x)*w;w*=.7;}return clamp(1.-2.5*o/s,0.,1.);}
float shadow(vec3 p){vec2 b=box(p,L);if(b.x>b.y||b.y<0.)return 1.;float r=1.,t=max(b.x,.004);for(int i=0;i<40;i++){float h=map(p+L*t).x;r=min(r,10.*h/t);t+=clamp(h,.006,.2);if(r<.003||t>b.y)break;}r=clamp(r,0.,1.);return r*r*(3.-2.*r);}
vec3 sky(vec3 d){float s=max(dot(d,L),0.);return mix(vec3(.96,.87,.74),vec3(.38,.6,.95),pow(max(d.y,0.),.5))+vec3(1.,.75,.45)*(.22*pow(s,6.)+2.*pow(s,400.));}
vec3 env(vec3 d){return d.y>0.?sky(d):mix(FOG,vec3(.3,.36,.24),min(-d.y*3.,1.));}
vec3 bg(vec3 d){vec3 c=sky(d);float a=atan(d.z,d.x),h1=.06+.025*sin(a*3.+1.)+.015*sin(a*7.+2.),h2=.03+.012*sin(a*5.+4.)+.008*sin(a*11.);
c=mix(c,mix(vec3(.58,.66,.78),c,.3),rs(-.0015,.0015,d.y-h1));
c=mix(c,mix(vec3(.4,.56,.36),FOG,rs(0.,h2,d.y)),rs(-.0015,.0015,d.y-h2));
return c;}
vec3 gcol(vec3 p,float t){
float x=p.x+uG,z=p.z,az=abs(z),w=.0012*t+.002;
vec3 g=vec3(.25,.42,.16)*(.88+.12*sin(x*3.1416+sin(z*1.7)*2.)),r=vec3(.28,.29,.31)*(.95+.05*sin(x*12.566+sin(z*7.)*3.));
g=mix(r,g,smoothstep(.85-w,.85+w,az));
g=mix(g,vec3(.88,.88,.84),rs(-w,w,abs(az-.78)-.02));
return mix(g,vec3(.95,.8,.3),rs(-w,w,abs(z+.4)-.018)*rs(-w,w,abs(fract(x*.8)-.5)-.2));
}
void main(){
vec2 uv=(2.*gl_FragCoord.xy-uR)/uR.y;
vec3 ro=uC,rd=normalize(uM*vec3(uv,1.9)),col;
float tg=(rd.y<0.&&ro.y>0.)?-ro.y/rd.y:1e5,t=0.,m=-1.;
vec2 bx=box(ro,rd);
if(bx.x<bx.y&&bx.y>0.){t=max(bx.x,0.);float te=min(bx.y,tg);bool o=false;
for(int i=0;i<128;i++){vec2 h=map(ro+rd*t);if(h.x<0.&&!o){t+=.002-h.x;if(t>te)break;continue;}o=true;if(h.x<.0002+.0004*t){m=h.y;break;}t+=h.x;if(t>te)break;}}
if(m>=0.||tg<1e4){
float tt=m>=0.?t:tg;
vec3 p=ro+rd*tt,n=m>=0.?nor(p,tt):vec3(0,1,0),h=p-uHP,al;
float ao=(m>=0.||abs(p.x)<1.4&&abs(p.z)<.8)?occ(p,n,m>=0.?1.:3.):1.,sh=shadow(p+n*.003),ks=0.,sp=8.,rf=0.,wr=0.;
if(m<0.)al=gcol(p,tt);
else if(m<1.5){al=vec3(.02,.4,.43);ks=1.;sp=80.;rf=.15;}
else if(m<2.5){vec3 q=p-(p.x<0.?RA:FA);al=vec3(.045)*(.7+.3*smoothstep(-.4,.4,sin((atan(q.y,q.x)+uW)*90.)));ks=.2;sp=12.;}
else if(m<3.5){al=vec3(.22,.23,.25);ks=1.4;sp=110.;rf=.7;}
else if(m<4.5){al=vec3(.3,.14,.07);ks=.5;sp=30.;rf=.04;}
else if(m<5.5){al=vec3(.97,.95,.9)*(.965+.035*sin(p.x*140.+sin(p.y*110.)*2.));al=mix(al,vec3(1.,.86,.5),smoothstep(.04,.1,h.y)*rs(-.07,0.,h.x));ks=.12;sp=10.;wr=.4;}
else if(m<6.5){al=mix(vec3(1.,.8,.35),vec3(.95,.38,.1),smoothstep(.2,.7,h.x));ks=.7;sp=50.;rf=.05;}
else if(m<7.5){al=vec3(1.,.6,.4)*(.93+.07*sin(h.x*90.+h.y*30.));ks=.45;sp=36.;rf=.04;wr=.3;}
else if(m<8.5){al=vec3(1.,.48,.12);ks=.4;sp=24.;rf=.03;wr=.2;}
else if(m<9.5){al=vec3(.01);ks=2.;sp=220.;rf=.3;}
else if(m<10.5){float k=clamp(rs(.09,.17,length(p.xy-HN.xy))+rs(-.38,-.27,p.x),0.,1.);al=mix(vec3(.96,.94,.9),vec3(.05,.05,.06),k)*(.92+.08*smoothstep(-.2,.8,sin((p.x-.6*p.y)*75.)));ks=.12;sp=10.;wr=.4;}
else if(m<11.5){al=vec3(.13,.08,.05);ks=.2;sp=12.;}
else if(m<12.5){al=vec3(.06);ks=.5;sp=40.;rf=.08;}
else if(m<13.5){al=vec3(.1);ks=.9;sp=60.;rf=.3;}
else{al=vec3(.9,.65,.2);ks=1.2;sp=90.;rf=.5;}
float nl=dot(n,L),dif=clamp((nl+wr)/(1.+wr),0.,1.)*sh,fr=pow(1.-clamp(dot(n,-rd),0.,1.),5.);
col=al*(dif*vec3(2.1,1.9,1.6)+ao*(.55+.45*n.y)*vec3(.4,.48,.64)+ao*clamp(.4-.6*n.y,0.,1.)*vec3(.3,.28,.16))+al*fr*ao*wr*vec3(.9,.95,1.)
+ks*pow(clamp(dot(n,normalize(L-rd)),0.,1.),sp)*(sp+8.)*.04*sh*step(0.,nl)*vec3(1.,.95,.85);
if(rf>0.)col+=env(reflect(rd,n))*(rf+(1.-rf)*fr)*ao;
col=mix(col,FOG,1.-exp(-max(tt-4.,0.)*.04));
}else col=bg(rd);
col=max(col*.85,0.);col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);
col=pow(clamp(col,0.,1.),vec3(.4545))*(1.-.045*dot(uv,uv));
fc=vec4(col+(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.,1);
}`;
const N='uR uC uM uW uB uG uK uHP uPR uPL uKR uKL uAR uAL uHR uHL'.split(' ');
const TAU=Math.PI*2,T=[.1,.95,0],cl=(v,a,b)=>Math.min(b,Math.max(a,v));
const V={yaw:.62,pitch:.2,distance:3.4};
let prog=null,vao=null,loc={},lost=false,dead=false;
function mk(t,s){const h=gl.createShader(t);gl.shaderSource(h,s);gl.compileShader(h);if(!gl.getShaderParameter(h,gl.COMPILE_STATUS)&&!gl.isContextLost()){const l=gl.getShaderInfoLog(h);gl.deleteShader(h);throw new Error('createPelicanSdf: shader compilation failed: '+l);}return h;}
function build(){const v=mk(gl.VERTEX_SHADER,VS),f=mk(gl.FRAGMENT_SHADER,FS),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS)&&!gl.isContextLost()){const l=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error('createPelicanSdf: shader program link failed: '+l);}prog=p;vao=gl.createVertexArray();loc={};for(const n of N)loc[n]=gl.getUniformLocation(p,n);}
build();
if(!canvas.hasAttribute('tabindex'))canvas.tabIndex=0;
canvas.style.touchAction='none';canvas.style.userSelect='none';canvas.style.webkitUserSelect='none';
const ptr=new Map();let span=0,mx=0,my=0;
const orbit=(dx,dy)=>{V.yaw-=dx*.009;V.pitch=cl(V.pitch+dy*.007,-.3,1.5);};
const zoom=f=>{V.distance=cl(V.distance*f,.45,9);};
function regest(){const a=[...ptr.values()];if(a.length>1){span=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);mx=(a[0].x+a[1].x)/2;my=(a[0].y+a[1].y)/2;}}
function pd(e){if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();try{canvas.focus({preventScroll:true});}catch(_){}try{canvas.setPointerCapture(e.pointerId);}catch(_){}ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});regest();}
function pm(e){const p=ptr.get(e.pointerId);if(!p)return;e.preventDefault();if(ptr.size===1){orbit(e.clientX-p.x,e.clientY-p.y);p.x=e.clientX;p.y=e.clientY;return;}p.x=e.clientX;p.y=e.clientY;const a=[...ptr.values()],s=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),x=(a[0].x+a[1].x)/2,y=(a[0].y+a[1].y)/2;if(span>1&&s>1)zoom(span/s);orbit(x-mx,y-my);span=s;mx=x;my=y;}
function pu(e){if(!ptr.delete(e.pointerId))return;try{canvas.releasePointerCapture(e.pointerId);}catch(_){}regest();}
function wh(e){e.preventDefault();const d=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?400:1);zoom(Math.exp(cl(d,-400,400)*(e.ctrlKey?.008:.0015)));}
function kd(e){const k=e.key;let h=1;if(k==='ArrowLeft')V.yaw-=.1;else if(k==='ArrowRight')V.yaw+=.1;else if(k==='ArrowUp')V.pitch=cl(V.pitch+.07,-.3,1.5);else if(k==='ArrowDown')V.pitch=cl(V.pitch-.07,-.3,1.5);else if(k==='+'||k==='='||e.code==='NumpadAdd')zoom(1/1.15);else if(k==='-'||k==='_'||e.code==='NumpadSubtract')zoom(1.15);else h=0;if(h)e.preventDefault();}
function lostH(e){e.preventDefault();lost=true;prog=null;vao=null;ptr.clear();}
function restH(){if(dead)return;try{build();lost=false;}catch(_){lost=true;}}
const pv=e=>e.preventDefault(),OPT={passive:false};
const LS=[['pointerdown',pd],['pointermove',pm],['pointerup',pu],['pointercancel',pu],['lostpointercapture',pu],['wheel',wh],['keydown',kd],['webglcontextlost',lostH],['webglcontextrestored',restH],['gesturestart',pv],['touchmove',pv]];
for(const [n,f] of LS)canvas.addEventListener(n,f,OPT);
function render(time){
if(dead||lost||!prog||gl.isContextLost())return;
const t=Number.isFinite(+time)?+time:0,ph=t*4.2,bob=.009*Math.sin(2*ph+.4),w=ph*2.1,W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
gl.viewport(0,0,W,H);gl.useProgram(prog);gl.bindVertexArray(vao);
const d=V.distance,cp=Math.cos(V.pitch),cx=T[0]+d*cp*Math.sin(V.yaw),cy=T[1]+d*Math.sin(V.pitch),cz=T[2]+d*cp*Math.cos(V.yaw);
let fx=T[0]-cx,fy=T[1]-cy,fz=T[2]-cz,l=Math.hypot(fx,fy,fz)||1;fx/=l;fy/=l;fz/=l;
let rx=-fz,rz=fx;l=Math.hypot(rx,rz)||1;rx/=l;rz/=l;
gl.uniform2f(loc.uR,W,H);gl.uniform3f(loc.uC,cx,cy,cz);
gl.uniformMatrix3fv(loc.uM,false,[rx,0,rz,-rz*fy,rz*fx-rx*fz,rx*fy,fx,fy,fz]);
gl.uniform1f(loc.uW,w%TAU);gl.uniform1f(loc.uK,ph%TAU);gl.uniform1f(loc.uB,bob);gl.uniform1f(loc.uG,(w*.342)%20);
gl.uniform3f(loc.uHP,.19+.012*Math.sin(2*ph+.9),1.74+bob+.008*Math.sin(2*ph+2),0);
for(const s of [1,-1]){const a=ph+(s<0?Math.PI:0),px=-.02+.165*Math.sin(a),py=.3+.165*Math.cos(a),ax=px-.02,ay=py+.05,hx=-.06,hy=1+bob;let dx=ax-hx,dy=ay-hy;const dd=Math.hypot(dx,dy)||1;dx/=dd;dy/=dd;const q=cl(dd,.1,.8799),al=(q*q+.2025-.1849)/(2*q),hh=Math.sqrt(Math.max(.2025-al*al,0)),R=s>0?'R':'L';
gl.uniform3f(loc['uP'+R],px,py,.15*s);gl.uniform3f(loc['uA'+R],ax,ay,.14*s);gl.uniform3f(loc['uH'+R],hx,hy,.1*s);gl.uniform3f(loc['uK'+R],hx+dx*al-dy*hh,hy+dy*al+dx*hh,.115*s);}
gl.drawArrays(gl.TRIANGLES,0,3);
}
return{
render,
setView(yaw,pitch,distance){if(Number.isFinite(+yaw))V.yaw=+yaw;if(Number.isFinite(+pitch))V.pitch=cl(+pitch,-1.55,1.55);if(Number.isFinite(+distance))V.distance=cl(+distance,.2,50);},
getView(){return{yaw:V.yaw,pitch:V.pitch,distance:V.distance};},
dispose(){if(dead)return;dead=true;for(const [n,f] of LS)canvas.removeEventListener(n,f,OPT);ptr.clear();try{if(!gl.isContextLost()){if(prog)gl.deleteProgram(prog);if(vao)gl.deleteVertexArray(vao);}}catch(_){}prog=null;vao=null;}
};
}
