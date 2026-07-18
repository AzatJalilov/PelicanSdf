export function createPelicanSdf(canvas){
 const gl=canvas.getContext('webgl2',{antialias:true,depth:false,stencil:false,alpha:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
 if(!gl)throw new Error('WebGL2 is not available');
 const VS=`#version 300 es
void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);}`;
 const FS=`#version 300 es
precision highp float;
uniform vec2 R;uniform float T;uniform vec3 CP;uniform mat3 CM;
out vec4 O;
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdRC(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(r1,r2,h);}
float sdEll(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/max(k1,1e-6);}
float sdTor(vec3 p,vec2 t){return length(vec2(length(p.xy)-t.x,p.z))-t.y;}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 wheel(vec3 p,float sp){
 float tire=sdTor(p,vec2(.72,.07));
 float rim=sdTor(p,vec2(.655,.026));
 vec2 dh=abs(vec2(length(p.xy),p.z))-vec2(.06,.08);
 float hub=min(max(dh.x,dh.y),0.)+length(max(dh,0.));
 float an=atan(p.y,p.x)+sp;
 an=mod(an,.6981317)-.34906585;
 float r=length(p.xy);
 vec2 sq=vec2(r*cos(an),r*sin(an));
 float spk=length(vec3(sq.x-clamp(sq.x,.06,.64),sq.y,p.z))-.013;
 return U(vec2(tire,2.),vec2(min(min(rim,hub),spk),3.));
}
vec3 knee(vec3 hp,vec3 ft){
 vec2 d=ft.xy-hp.xy;
 float L=max(length(d),1e-4);
 vec2 dn=d/L;
 float Lc=min(L,1.4);
 float a=(.4624-.5476+Lc*Lc)/(2.*Lc);
 float h=sqrt(max(.4624-a*a,0.));
 vec2 pp=vec2(dn.y,-dn.x);
 if(pp.x<0.)pp=-pp;
 return vec3(hp.xy+dn*a+pp*h,mix(hp.z,ft.z,.45));
}
vec2 map(vec3 p){
 float gd=p.y;
 float bd=length(p-vec3(0.,1.05,0.))-2.05;
 if(bd>.5)return gd<bd?vec2(gd,1.):vec2(bd,2.);
 vec2 res=vec2(gd,1.);
 float ca=.7-1.2*T;
 vec3 pm=vec3(p.x,p.y,abs(p.z));
 res=U(res,wheel(p-vec3(-1.02,.72,0.),2.4*T));
 res=U(res,wheel(p-vec3(1.02,.72,0.),2.4*T));
 float fr=sdCap(p,vec3(.02,.5,0.),vec3(-.35,1.52,0.),.042);
 fr=min(fr,sdCap(p,vec3(.02,.5,0.),vec3(.8,1.1,0.),.05));
 fr=min(fr,sdCap(p,vec3(-.28,1.32,0.),vec3(.72,1.42,0.),.04));
 fr=min(fr,sdCap(p,vec3(.8,1.1,0.),vec3(.72,1.42,0.),.056));
 fr=min(fr,sdCap(pm,vec3(.02,.5,.07),vec3(-1.02,.72,.115),.02));
 fr=min(fr,sdCap(pm,vec3(-.28,1.32,.03),vec3(-1.02,.72,.115),.018));
 fr=min(fr,sdCap(pm,vec3(.8,1.1,.02),vec3(1.02,.72,.08),.024));
 fr=min(fr,sdCap(p,vec3(.72,1.42,0.),vec3(.76,1.56,0.),.032));
 res=U(res,vec2(fr,4.));
 res=U(res,vec2(sdCap(p,vec3(.76,1.56,-.34),vec3(.76,1.56,.34),.024),3.));
 res=U(res,vec2(sdEll(p-vec3(-.4,1.57,0.),vec3(.2,.055,.11)),5.));
 vec2 cd=vec2(cos(ca),sin(ca))*.18;
 vec3 P1=vec3(.02+cd.x,.5+cd.y,.15),P2=vec3(.02-cd.x,.5-cd.y,-.15);
 float cr=sdCap(p,vec3(.02,.5,.06),vec3(P1.xy,.13),.026);
 cr=min(cr,sdCap(p,vec3(.02,.5,-.06),vec3(P2.xy,-.13),.026));
 cr=min(cr,sdTor(p-vec3(.02,.5,.08),vec2(.14,.02)));
 cr=min(cr,sdCap(p,vec3(.02,.64,.08),vec3(-1.02,.79,.08),.011));
 cr=min(cr,sdCap(p,vec3(.02,.36,.08),vec3(-1.02,.65,.08),.011));
 res=U(res,vec2(cr,3.));
 float pd=min(sdBox(p-P1,vec3(.1,.018,.05)),sdBox(p-P2,vec3(.1,.018,.05)));
 pd=min(pd,sdCap(pm,vec3(.76,1.56,.23),vec3(.76,1.56,.35),.036));
 res=U(res,vec2(pd,12.));
 float bob=.02*sin(2.4*T);
 vec3 q=p-vec3(-.22,1.86+bob,0.);
 float cs=cos(.15),sn=sin(.15);
 q.xy=mat2(cs,-sn,sn,cs)*q.xy;
 float body=sdEll(q,vec3(.46,.32,.3));
 body=smin(body,sdRC(p,vec3(-.55,1.92+bob,0.),vec3(-.88,2.06+bob,0.),.14,.02),.08);
 vec3 H=vec3(.33,2.52+bob,0.);
 float nk=sdRC(p,vec3(.08,2.+bob,0.),vec3(.3,2.28+bob,0.),.11,.08);
 nk=smin(nk,sdRC(p,vec3(.3,2.28+bob,0.),H,.08,.1),.05);
 body=smin(body,nk,.09);
 body=smin(body,length(p-H)-.15,.04);
 float wg=sdRC(pm,vec3(-.02,1.94+bob,.22),vec3(.4,1.78,.3),.075,.05);
 wg=smin(wg,sdRC(pm,vec3(.4,1.78,.3),vec3(.73,1.6,.3),.05,.04),.04);
 wg=smin(wg,sdEll(pm-vec3(.77,1.57,.3),vec3(.085,.05,.06)),.03);
 body=smin(body,wg,.05);
 vec3 F1=vec3(P1.x-.04,P1.y+.06,.15),F2=vec3(P2.x-.04,P2.y+.06,-.15);
 vec3 h1=vec3(-.14,1.66+bob,.16),h2=vec3(-.14,1.66+bob,-.16);
 vec3 K1=knee(h1,F1),K2=knee(h2,F2);
 body=smin(body,min(sdRC(p,h1,K1,.09,.05),sdRC(p,h2,K2,.09,.05)),.05);
 res=U(res,vec2(body,6.));
 float sh2=min(sdRC(p,K1,F1,.045,.03),sdRC(p,K2,F2,.045,.03));
 sh2=min(sh2,min(sdEll(p-vec3(P1.x+.05,P1.y+.045,.15),vec3(.13,.03,.07)),sdEll(p-vec3(P2.x+.05,P2.y+.045,-.15),vec3(.13,.03,.07))));
 res=U(res,vec2(sh2,10.));
 vec3 s3=vec3(1.,2.,1.);
 float bk=sdRC(p*s3,vec3(.43,(2.55+bob)*2.,0.),vec3(1.24,(2.32+bob)*2.,0.),.1,.028)*.5;
 res=U(res,vec2(bk,7.));
 float pc=sdRC(p,vec3(.4,2.44+bob,0.),vec3(1.12,2.3+bob,0.),.09,.02);
 pc=smin(pc,length(p-vec3(.6,2.2+bob,0.))-.13,.15);
 res=U(res,vec2(pc,8.));
 res=U(res,vec2(length(pm-vec3(.39,2.57+bob,.12))-.032,9.));
 return res;
}
vec3 calcN(vec3 p){
 vec2 e=vec2(.0006,-.0006);
 return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);
}
float shadow(vec3 ro,vec3 rd){
 float s=1.,t=.03;
 for(int i=0;i<26;i++){
  float h=map(ro+rd*t).x;
  s=min(s,14.*h/t);
  t+=clamp(h,.02,.3);
  if(s<.01||t>7.)break;
 }
 return clamp(s,0.,1.);
}
float ao(vec3 p,vec3 n){
 float o=0.,s=1.;
 for(int i=1;i<6;i++){
  float d=.035*float(i);
  o+=(d-map(p+n*d).x)*s;
  s*=.7;
 }
 return clamp(1.-2.*o,0.,1.);
}
vec3 sky(vec3 rd){
 vec3 c=mix(vec3(.8,.88,.96),vec3(.33,.55,.85),clamp(rd.y*1.5+.15,0.,1.));
 c+=vec3(1.,.85,.6)*pow(clamp(dot(rd,normalize(vec3(.55,.7,.4))),0.,1.),20.)*.3;
 return c;
}
void main(){
 vec2 uv=(2.*gl_FragCoord.xy-R)/R.y;
 vec3 ro=CP,rd=normalize(CM*vec3(uv,1.9));
 float t=0.,id=-1.;
 for(int i=0;i<110;i++){
  vec2 hh=map(ro+rd*t);
  if(hh.x<max(.0006*t,.0004)){id=hh.y;break;}
  t+=hh.x*.92;
  if(t>30.)break;
 }
 vec3 col;
 vec3 L=normalize(vec3(.55,.7,.4));
 if(id<0.)col=sky(rd);
 else{
  vec3 p=ro+rd*t,n=calcN(p);
  vec3 alb;float rough=.5,spc=.3;
  if(id<1.5){
   float ck=mod(floor(p.x*1.2)+floor(p.z*1.2),2.);
   float road=smoothstep(1.15,.95,abs(p.z));
   vec3 g1=mix(vec3(.48,.58,.4),vec3(.54,.63,.44),ck);
   vec3 g2=mix(vec3(.56,.53,.49),vec3(.62,.59,.54),ck);
   alb=mix(g1,g2,road);rough=.7;spc=.05;
  }else if(id<2.5){alb=vec3(.08);rough=.45;spc=.15;}
  else if(id<3.5){alb=vec3(.6,.62,.66);rough=.16;spc=1.1;}
  else if(id<4.5){alb=vec3(.68,.09,.13);rough=.22;spc=.8;}
  else if(id<5.5){alb=vec3(.3,.16,.08);rough=.4;spc=.25;}
  else if(id<6.5){alb=vec3(.96,.94,.88);rough=.5;spc=.15;}
  else if(id<7.5){alb=vec3(.95,.58,.14);rough=.3;spc=.5;}
  else if(id<8.5){alb=vec3(.98,.74,.38);rough=.35;spc=.35;}
  else if(id<9.5){alb=vec3(.02);rough=.08;spc=2.;}
  else if(id<10.5){alb=vec3(.9,.5,.15);rough=.35;spc=.3;}
  else{alb=vec3(.12);rough=.4;spc=.2;}
  float dif=clamp(dot(n,L),0.,1.);
  float sha=dif>.001?shadow(p+n*.015,L):0.;
  float occ=ao(p,n);
  vec3 hf=normalize(L-rd);
  float spe=pow(clamp(dot(n,hf),0.,1.),2./(rough*rough))*spc*sha;
  col=alb*(vec3(1.05,.98,.88)*1.3*dif*sha+vec3(.42,.5,.62)*(.5+.5*n.y)*occ+vec3(.3,.25,.2)*clamp(-n.y,0.,1.)*occ*.6);
  col+=vec3(spe);
  float fre=pow(1.-clamp(dot(n,-rd),0.,1.),4.);
  col+=fre*vec3(.25,.35,.5)*.3*occ;
  col=mix(col,sky(rd),1.-exp(-.0015*t*t));
 }
 col=pow(clamp(col,0.,1.),vec3(.4545));
 O=vec4(col,1.);
}`;
 let prog=null,vao=null,uT=null,uR=null,uCP=null,uCM=null,lost=false,disposed=false;
 function compile(type,src){
  const s=gl.createShader(type);
  gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)&&!gl.isContextLost()){
   const log=gl.getShaderInfoLog(s);gl.deleteShader(s);
   throw new Error('Shader compile failed: '+log);
  }
  return s;
 }
 function build(){
  const v=compile(gl.VERTEX_SHADER,VS),f=compile(gl.FRAGMENT_SHADER,FS);
  const p=gl.createProgram();
  gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
  gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)&&!gl.isContextLost())
   throw new Error('Program link failed: '+gl.getProgramInfoLog(p));
  prog=p;
  uT=gl.getUniformLocation(p,'T');uR=gl.getUniformLocation(p,'R');
  uCP=gl.getUniformLocation(p,'CP');uCM=gl.getUniformLocation(p,'CM');
  vao=gl.createVertexArray();
 }
 build();
 let yaw=.65,pitch=.3,dist=5.0;
 const clampView=()=>{
  pitch=Math.max(-.1,Math.min(1.5,pitch));
  dist=Math.max(.8,Math.min(20,dist));
 };
 canvas.tabIndex=0;
 canvas.style.touchAction='none';
 canvas.style.outline='none';
 const ptrs=new Map();
 let pinch=0;
 const pdn=e=>{
  e.preventDefault();canvas.focus();
  try{canvas.setPointerCapture(e.pointerId);}catch(_){}
  ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptrs.size===2){const a=[...ptrs.values()];pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);}
 };
 const pmv=e=>{
  if(!ptrs.has(e.pointerId))return;
  e.preventDefault();
  const pr=ptrs.get(e.pointerId);
  ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptrs.size===1){
   yaw+=(e.clientX-pr[0])*.008;
   pitch+=(e.clientY-pr[1])*.008;
   clampView();
  }else if(ptrs.size===2){
   const a=[...ptrs.values()];
   const d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);
   if(pinch>0&&d>0)dist*=pinch/d;
   pinch=d;clampView();
  }
 };
 const pup=e=>{ptrs.delete(e.pointerId);pinch=0;};
 const whl=e=>{e.preventDefault();dist*=Math.exp(e.deltaY*.0012);clampView();};
 const kdn=e=>{
  let h=true;
  if(e.key==='ArrowLeft')yaw-=.08;
  else if(e.key==='ArrowRight')yaw+=.08;
  else if(e.key==='ArrowUp')pitch+=.06;
  else if(e.key==='ArrowDown')pitch-=.06;
  else if(e.key==='+'||e.key==='=')dist/=1.08;
  else if(e.key==='-'||e.key==='_')dist*=1.08;
  else h=false;
  if(h){clampView();e.preventDefault();}
 };
 const cmn=e=>e.preventDefault();
 const clo=e=>{e.preventDefault();lost=true;};
 const cre=()=>{try{build();lost=false;}catch(_){}};
 canvas.addEventListener('pointerdown',pdn);
 canvas.addEventListener('pointermove',pmv);
 canvas.addEventListener('pointerup',pup);
 canvas.addEventListener('pointercancel',pup);
 canvas.addEventListener('wheel',whl,{passive:false});
 canvas.addEventListener('keydown',kdn);
 canvas.addEventListener('contextmenu',cmn);
 canvas.addEventListener('webglcontextlost',clo);
 canvas.addEventListener('webglcontextrestored',cre);
 function render(timeSeconds){
  if(disposed||lost||gl.isContextLost()||!prog)return;
  const t=(typeof timeSeconds==='number'&&isFinite(timeSeconds))?timeSeconds:0;
  const w=gl.drawingBufferWidth,ht=gl.drawingBufferHeight;
  gl.viewport(0,0,w,ht);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
  gl.useProgram(prog);gl.bindVertexArray(vao);
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const tx=.05,ty=1.2,tz=0;
  const ex=tx+dist*sy*cp,ey=ty+dist*sp,ez=tz+dist*cy*cp;
  let fx=tx-ex,fy=ty-ey,fz=tz-ez;
  const fl=Math.hypot(fx,fy,fz)||1;fx/=fl;fy/=fl;fz/=fl;
  let rx=-fz,rz=fx;
  const rl=Math.hypot(rx,rz)||1;rx/=rl;rz/=rl;
  const ux=-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy;
  gl.uniform2f(uR,w,ht);
  gl.uniform1f(uT,t);
  gl.uniform3f(uCP,ex,ey,ez);
  gl.uniformMatrix3fv(uCM,false,[rx,0,rz,ux,uy,uz,fx,fy,fz]);
  gl.drawArrays(gl.TRIANGLES,0,3);
 }
 function setView(y,p,d){
  if(typeof y==='number'&&isFinite(y))yaw=y;
  if(typeof p==='number'&&isFinite(p))pitch=p;
  if(typeof d==='number'&&isFinite(d))dist=d;
  clampView();
 }
 function getView(){return{yaw:yaw,pitch:pitch,distance:dist};}
 function dispose(){
  if(disposed)return;
  disposed=true;
  canvas.removeEventListener('pointerdown',pdn);
  canvas.removeEventListener('pointermove',pmv);
  canvas.removeEventListener('pointerup',pup);
  canvas.removeEventListener('pointercancel',pup);
  canvas.removeEventListener('wheel',whl);
  canvas.removeEventListener('keydown',kdn);
  canvas.removeEventListener('contextmenu',cmn);
  canvas.removeEventListener('webglcontextlost',clo);
  canvas.removeEventListener('webglcontextrestored',cre);
  ptrs.clear();
  try{
   if(vao)gl.deleteVertexArray(vao);
   if(prog)gl.deleteProgram(prog);
  }catch(_){}
  vao=null;prog=null;
 }
 return{render:render,setView:setView,getView:getView,dispose:dispose};
}
