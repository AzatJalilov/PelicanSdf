export function createPelicanSdf(canvas){
const VS="#version 300 es\nvoid main(){vec2 v=vec2(float(gl_VertexID&1),float(gl_VertexID>>1))*4.-1.;gl_Position=vec4(v,0.,1.);}";
const FS=`#version 300 es
precision highp float;
uniform vec2 R;uniform float T,YW,PT,DS;
out vec4 O;
const vec3 LD=normalize(vec3(.55,.75,.4));
mat2 r2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float sS(vec3 p,float r){return length(p)-r;}
float sC(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sCT(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(r1,r2,h);}
float sT(vec3 p,vec2 t){return length(vec2(length(p.xy)-t.x,p.z))-t.y;}
float sE(vec3 p,vec3 r){float k0=length(p/r);return k0*(k0-1.)/max(length(p/(r*r)),1e-6);}
float sB(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sCy(vec3 p,float r,float h){vec2 d=abs(vec2(length(p.xy),p.z))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}
float sm(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
vec2 wl(vec3 p,float w,vec2 res){
 float ti=sT(p,vec2(.55,.075));
 if(ti<res.x)res=vec2(ti,1.);
 float rm=min(sT(p,vec2(.5,.02)),sCy(p,.06,.08));
 vec2 q=r2(w)*p.xy;
 float an=atan(q.y,q.x);
 an=mod(an,.7854)-.3927;
 float ln=length(q);
 rm=min(rm,sC(vec3(ln*cos(an),ln*sin(an),p.z),vec3(.06,0.,0.),vec3(.5,0.,0.),.012));
 if(rm<res.x)res=vec2(rm,2.);
 return res;
}
vec2 map(vec3 p){
 vec2 res=vec2(p.y,0.);
 float bb=length(p-vec3(.1,1.25,0.))-1.95;
 if(bb>.001){if(bb<res.x)res=vec2(bb,1.);return res;}
 float ca=T*2.4;
 res=wl(p-vec3(-.92,.62,0.),ca*1.8,res);
 res=wl(p-vec3(.92,.62,0.),ca*1.8,res);
 vec3 q=vec3(p.x,p.y,abs(p.z));
 float fr=sC(p,vec3(.05,.45,0.),vec3(-.28,1.24,0.),.038);
 fr=min(fr,sC(p,vec3(-.28,1.22,0.),vec3(.6,1.18,0.),.036));
 fr=min(fr,sC(p,vec3(.05,.45,0.),vec3(.7,.92,0.),.04));
 fr=min(fr,sC(p,vec3(.62,1.26,0.),vec3(.73,.88,0.),.046));
 fr=min(fr,sC(q,vec3(.05,.45,.05),vec3(-.92,.62,.07),.024));
 fr=min(fr,sC(q,vec3(-.28,1.22,.03),vec3(-.92,.62,.07),.02));
 fr=min(fr,sC(q,vec3(.72,.9,.01),vec3(.92,.62,.075),.026));
 fr=min(fr,sC(p,vec3(.6,1.26,0.),vec3(.57,1.38,0.),.03));
 if(fr<res.x)res=vec2(fr,3.);
 vec2 cd=vec2(cos(ca),sin(ca))*.15;
 float mt=sC(q,vec3(.57,1.38,0.),vec3(.57,1.38,.3),.024);
 mt=min(mt,sC(p,vec3(-.28,1.24,0.),vec3(-.3,1.42,0.),.022));
 mt=min(mt,sCy(p-vec3(.05,.45,.07),.16,.012));
 mt=min(mt,sCy(p-vec3(.05,.45,0.),.045,.11));
 vec3 pR=vec3(.05+cd.x,.45+cd.y,.17),pL=vec3(.05-cd.x,.45-cd.y,-.17);
 mt=min(mt,sC(p,vec3(.05,.45,.1),pR-vec3(0.,0.,.03),.025));
 mt=min(mt,sC(p,vec3(.05,.45,-.1),pL+vec3(0.,0.,.03),.025));
 if(mt<res.x)res=vec2(mt,2.);
 float pd=sB(p-pR,vec3(.085,.018,.05));
 pd=min(pd,sB(p-pL,vec3(.085,.018,.05)));
 pd=min(pd,sE(p-vec3(-.3,1.46,0.),vec3(.18,.05,.11)));
 pd=min(pd,sCT(q,vec3(.57,1.38,.19),vec3(.57,1.38,.31),.033,.035));
 if(pd<res.x)res=vec2(pd,4.);
 float bob=.02*sin(T*2.4);
 float bd=sE(p-vec3(-.08,1.68+bob,0.),vec3(.38,.32,.26));
 bd=sm(bd,sCT(p,vec3(-.32,1.72+bob,0.),vec3(-.64,1.96+bob,0.),.11,.028),.06);
 float hy=2.42+bob*1.5;
 vec3 hp=vec3(.52,hy,0.);
 float nk=sCT(p,vec3(.16,1.84+bob,0.),vec3(.4,2.2+bob*1.2,0.),.12,.09);
 nk=sm(nk,sCT(p,vec3(.4,2.2+bob*1.2,0.),hp,.09,.1),.04);
 bd=sm(bd,nk,.07);
 bd=sm(bd,sS(p-hp,.17),.03);
 float wg=sCT(q,vec3(.08,1.84+bob,.2),vec3(.33,1.6+bob*.5,.27),.08,.05);
 wg=sm(wg,sCT(q,vec3(.33,1.6+bob*.5,.27),vec3(.57,1.42,.26),.05,.04),.03);
 wg=sm(wg,sE(q-vec3(.59,1.41,.26),vec3(.07,.05,.05)),.02);
 bd=sm(bd,wg,.04);
 if(bd<res.x)res=vec2(bd,5.);
 float wp=sE(q-vec3(-.1,1.68+bob,.27),vec3(.29,.19,.05));
 if(wp<res.x)res=vec2(wp,10.);
 float bk=sCT(p,hp+vec3(.1,.04,0.),hp+vec3(.98,-.26,0.),.05,.016);
 bk=min(bk,sS(p-(hp+vec3(.98,-.29,0.)),.026));
 if(bk<res.x)res=vec2(bk,6.);
 float pu=sCT(p,hp+vec3(.1,-.06,0.),hp+vec3(.9,-.29,0.),.09,.02);
 pu=sm(pu,sS(p-(hp+vec3(.34,-.22,0.)),.085),.09);
 if(pu<res.x)res=vec2(pu,7.);
 float ey=sS(q-vec3(.58,hy+.08,.14),.034);
 if(ey<res.x)res=vec2(ey,8.);
 for(int i=0;i<2;i++){
  float s=i==0?1.:-1.;
  vec2 pe=vec2(.05,.45)+cd*s;
  vec2 hip=vec2(-.1,1.4);
  vec2 dv=pe-hip;
  float dl=length(dv);
  vec2 dn=dv/dl;
  vec2 kn=hip+dn*dl*.5+vec2(-dn.y,dn.x)*sqrt(max(.36-.25*dl*dl,1e-4));
  float zz=s*.14,zp=s*.17;
  float lg=sCT(p,vec3(hip,zz),vec3(kn,(zz+zp)*.5),.058,.042);
  lg=sm(lg,sC(p,vec3(kn,(zz+zp)*.5),vec3(pe,zp),.034),.03);
  lg=sm(lg,sE(p-vec3(pe.x+.06,pe.y+.04,zp),vec3(.11,.03,.06)),.02);
  if(lg<res.x)res=vec2(lg,9.);
 }
 return res;
}
vec3 nr(vec3 p){
 vec2 e=vec2(.0012,-.0012);
 return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);
}
float sh(vec3 ro,vec3 rd){
 float r=1.,t=.03;
 for(int i=0;i<24;i++){
  float h=map(ro+rd*t).x;
  r=min(r,12.*h/t);
  t+=clamp(h,.02,.35);
  if(r<.02||t>7.)break;
 }
 return clamp(r,0.,1.);
}
float ao(vec3 p,vec3 n){
 float o=0.,s=1.;
 for(int i=1;i<6;i++){
  float h=.03*float(i);
  o+=(h-map(p+n*h).x)*s;
  s*=.72;
 }
 return clamp(1.-2.2*o,0.,1.);
}
vec3 sky(vec3 rd){
 vec3 c=mix(vec3(.85,.9,.98),vec3(.35,.55,.85),clamp(rd.y*1.5+.25,0.,1.));
 c+=vec3(1.,.8,.55)*pow(max(dot(rd,LD),0.),24.)*.35;
 return c;
}
vec3 mc(float m,vec3 p){
 if(m<.5){float ch=mod(floor(p.x*1.6)+floor(p.z*1.6),2.);return mix(vec3(.33,.38,.3),vec3(.42,.47,.38),ch);}
 if(m<1.5)return vec3(.045);
 if(m<2.5)return vec3(.62,.64,.68);
 if(m<3.5)return vec3(.72,.1,.1);
 if(m<4.5)return vec3(.08,.06,.05);
 if(m<5.5)return vec3(.97,.95,.9);
 if(m<6.5)return vec3(.95,.55,.13);
 if(m<7.5)return vec3(.98,.74,.38);
 if(m<8.5)return vec3(.02);
 if(m<9.5)return vec3(.93,.52,.16);
 return vec3(.88,.86,.8);
}
void main(){
 vec2 uv=(2.*gl_FragCoord.xy-R)/R.y;
 vec3 tg=vec3(.15,1.15,0.);
 float cp=cos(PT);
 vec3 ro=tg+DS*vec3(sin(YW)*cp,sin(PT),cos(YW)*cp);
 vec3 fw=normalize(tg-ro);
 vec3 rt=normalize(cross(fw,vec3(0.,1.,0.)));
 vec3 up=cross(rt,fw);
 vec3 rd=normalize(fw*1.7+rt*uv.x+up*uv.y);
 float t=0.,m=-1.;
 for(int i=0;i<100;i++){
  vec2 h=map(ro+rd*t);
  if(h.x<.001*t+.0003){m=h.y;break;}
  t+=h.x*.9;
  if(t>30.)break;
 }
 vec3 col;
 if(m<0.)col=sky(rd);
 else{
  vec3 ps=ro+rd*t,n=nr(ps);
  vec3 al=mc(m,ps);
  float ks=.3;
  if(m>1.5&&m<2.5)ks=1.3;else if(m>2.5&&m<3.5)ks=.8;else if(m>7.5&&m<8.5)ks=1.6;else if(m<.5)ks=.05;else if(m<1.5)ks=.15;
  float df=clamp(dot(n,LD),0.,1.);
  float sd=df>.02?sh(ps+n*.012,LD):1.;
  float oc=ao(ps,n);
  vec3 lin=vec3(1.3,1.2,1.05)*df*sd;
  lin+=vec3(.4,.5,.68)*(.55+.45*n.y)*oc;
  lin+=vec3(.3,.26,.2)*clamp(-n.y,0.,1.)*oc;
  col=al*lin;
  vec3 hv=normalize(LD-rd);
  col+=ks*pow(clamp(dot(n,hv),0.,1.),48.)*df*sd*vec3(1.,.97,.92);
  col+=ks*.12*pow(1.-clamp(dot(n,-rd),0.,1.),4.)*oc*sky(reflect(rd,n));
  col=mix(col,sky(rd),1.-exp(-.0035*t*t));
 }
 col=1.-exp(-col*1.7);
 col=pow(col,vec3(.4545));
 O=vec4(col,1.);
}`;
const gl=canvas.getContext("webgl2",{antialias:false,depth:false,stencil:false,alpha:false});
if(!gl)throw new Error("WebGL2 is unavailable");
let yaw=0.65,pitch=0.3,dist=5.2;
let prog=null,vao=null,loc=null;
function compile(type,src){
 const s=gl.createShader(type);
 gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)&&!gl.isContextLost()){
  const e=gl.getShaderInfoLog(s);gl.deleteShader(s);
  throw new Error("Shader compile failed: "+e);
 }
 return s;
}
function init(){
 const v=compile(gl.VERTEX_SHADER,VS),f=compile(gl.FRAGMENT_SHADER,FS);
 prog=gl.createProgram();
 gl.attachShader(prog,v);gl.attachShader(prog,f);gl.linkProgram(prog);
 if(!gl.getProgramParameter(prog,gl.LINK_STATUS)&&!gl.isContextLost())
  throw new Error("Program link failed: "+gl.getProgramInfoLog(prog));
 gl.deleteShader(v);gl.deleteShader(f);
 vao=gl.createVertexArray();
 loc={R:gl.getUniformLocation(prog,"R"),T:gl.getUniformLocation(prog,"T"),YW:gl.getUniformLocation(prog,"YW"),PT:gl.getUniformLocation(prog,"PT"),DS:gl.getUniformLocation(prog,"DS")};
}
init();
function clampView(){
 if(!isFinite(yaw))yaw=0;
 pitch=Math.max(-1.5,Math.min(1.5,isFinite(pitch)?pitch:0));
 dist=Math.max(1.3,Math.min(12,isFinite(dist)?dist:5.2));
}
canvas.tabIndex=0;
canvas.style.touchAction="none";
const ptrs=new Map();
let lastPinch=0;
function pinchDist(){const a=[...ptrs.values()];return Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);}
function onDown(e){
 e.preventDefault();
 try{canvas.setPointerCapture(e.pointerId);}catch(_){}
 canvas.focus({preventScroll:true});
 ptrs.set(e.pointerId,[e.clientX,e.clientY]);
 if(ptrs.size===2)lastPinch=pinchDist();
}
function onMove(e){
 if(!ptrs.has(e.pointerId))return;
 e.preventDefault();
 const pv=ptrs.get(e.pointerId);
 const dx=e.clientX-pv[0],dy=e.clientY-pv[1];
 ptrs.set(e.pointerId,[e.clientX,e.clientY]);
 if(ptrs.size===1){
  yaw-=dx*0.008;pitch+=dy*0.008;clampView();
 }else if(ptrs.size===2){
  const d=pinchDist();
  if(lastPinch>0&&d>0)dist*=lastPinch/d;
  lastPinch=d;clampView();
 }
}
function onUp(e){
 ptrs.delete(e.pointerId);
 try{canvas.releasePointerCapture(e.pointerId);}catch(_){}
 if(ptrs.size<2)lastPinch=0;
}
function onWheel(e){
 e.preventDefault();
 dist*=Math.exp(e.deltaY*0.0012);
 clampView();
}
function onKey(e){
 let used=true;
 switch(e.key){
  case"ArrowLeft":yaw-=0.07;break;
  case"ArrowRight":yaw+=0.07;break;
  case"ArrowUp":pitch+=0.06;break;
  case"ArrowDown":pitch-=0.06;break;
  case"+":case"=":dist/=1.08;break;
  case"-":case"_":dist*=1.08;break;
  default:used=false;
 }
 if(used){e.preventDefault();clampView();}
}
function onLost(e){e.preventDefault();prog=null;}
function onRestored(){try{init();}catch(_){prog=null;}}
canvas.addEventListener("pointerdown",onDown);
canvas.addEventListener("pointermove",onMove);
canvas.addEventListener("pointerup",onUp);
canvas.addEventListener("pointercancel",onUp);
canvas.addEventListener("wheel",onWheel,{passive:false});
canvas.addEventListener("keydown",onKey);
canvas.addEventListener("webglcontextlost",onLost);
canvas.addEventListener("webglcontextrestored",onRestored);
return{
 render(timeSeconds){
  if(!prog||gl.isContextLost())return;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  gl.viewport(0,0,w,h);
  gl.useProgram(prog);
  gl.bindVertexArray(vao);
  gl.uniform2f(loc.R,w,h);
  gl.uniform1f(loc.T,Number(timeSeconds)||0);
  gl.uniform1f(loc.YW,yaw);
  gl.uniform1f(loc.PT,pitch);
  gl.uniform1f(loc.DS,dist);
  gl.drawArrays(gl.TRIANGLES,0,3);
 },
 setView(y,p,d){
  yaw=Number(y);pitch=Number(p);dist=Number(d);clampView();
 },
 getView(){
  return{yaw:yaw,pitch:pitch,distance:dist};
 },
 dispose(){
  canvas.removeEventListener("pointerdown",onDown);
  canvas.removeEventListener("pointermove",onMove);
  canvas.removeEventListener("pointerup",onUp);
  canvas.removeEventListener("pointercancel",onUp);
  canvas.removeEventListener("wheel",onWheel);
  canvas.removeEventListener("keydown",onKey);
  canvas.removeEventListener("webglcontextlost",onLost);
  canvas.removeEventListener("webglcontextrestored",onRestored);
  ptrs.clear();
  if(!gl.isContextLost()){
   if(prog)gl.deleteProgram(prog);
   if(vao)gl.deleteVertexArray(vao);
  }
  prog=null;vao=null;
 }
};
}
