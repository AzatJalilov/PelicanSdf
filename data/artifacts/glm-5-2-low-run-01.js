export function createPelicanSdf(canvas){
  const gl = canvas.getContext('webgl2',{antialias:false,powerPreference:'high-performance'});
  if(!gl) throw new Error('WebGL2 unavailable');

  const VS = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos,0.0,1.0); }`;

  const FS = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamTarget;

float sdSphere(vec3 p,float r){ return length(p)-r; }
float sdRoundBox(vec3 p,vec3 b,float r){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r; }
float sdCapsule(vec3 p,vec3 a,vec3 b,float r){
  vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h)-r;
}
float sdEllipsoid(vec3 p,vec3 r){ float k0=length(p/r), k1=length(p/(r*r)); return k0*(k0-1.0)/k1; }

vec2 opU(vec2 a,vec2 b){ return a.x<b.x?a:b; }
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
mat3 rotZ(float a){ float c=cos(a),s=sin(a); return mat3(c,-s,0.0,s,c,0.0,0.0,0.0,1.0); }

vec2 wheel(vec3 p,vec3 c,float ang){
  vec2 res=vec2(1e9,1.0);
  vec3 q=p-c;
  res=opU(res,vec2(length(vec2(length(q.xy)-0.40,q.z))-0.05,1.0));
  res=opU(res,vec2(length(vec2(length(q.xy)-0.34,q.z))-0.016,2.0));
  res=opU(res,vec2(sdCapsule(p,c+vec3(0.0,0.0,-0.06),c+vec3(0.0,0.0,0.06),0.035),2.0));
  for(int i=0;i<8;i++){
    float a=ang+float(i)*0.785398;
    vec3 e=c+vec3(cos(a),sin(a),0.0)*0.34;
    res=opU(res,vec2(sdCapsule(p,c,e,0.006),2.0));
  }
  return res;
}

vec2 map(vec3 p){
  vec2 res=vec2(p.y,11.0);
  float wt=uTime*1.5;
  res=opU(res,wheel(p,vec3(-0.62,0.42,0.0),wt));
  res=opU(res,wheel(p,vec3( 0.66,0.42,0.0),wt));

  vec3 rearHub=vec3(-0.62,0.42,0.0), frontHub=vec3(0.66,0.42,0.0);
  vec3 bb=vec3(0.0,0.42,0.0);
  vec3 seatTop=vec3(-0.08,1.02,0.0);
  vec3 headTop=vec3(0.52,1.12,0.0), headBot=vec3(0.44,0.74,0.0);
  float fr=0.022;
  res=opU(res,vec2(sdCapsule(p,bb,seatTop,fr),0.0));
  res=opU(res,vec2(sdCapsule(p,seatTop,headTop,fr),0.0));
  res=opU(res,vec2(sdCapsule(p,bb,headBot,fr),0.0));
  res=opU(res,vec2(sdCapsule(p,headBot,headTop,fr*1.4),4.0));
  res=opU(res,vec2(sdCapsule(p,rearHub,bb,fr),0.0));
  res=opU(res,vec2(sdCapsule(p,rearHub,seatTop,fr),0.0));
  res=opU(res,vec2(sdCapsule(p,headTop,frontHub,fr),0.0));

  vec3 sq=rotZ(0.15)*(p-(seatTop+vec3(0.0,0.02,0.0)));
  res=opU(res,vec2(sdRoundBox(sq,vec3(0.12,0.03,0.07),0.02),3.0));

  vec3 hbA=headTop+vec3(0.0,0.06,0.0);
  res=opU(res,vec2(sdCapsule(p,headTop,hbA,0.02),4.0));
  res=opU(res,vec2(sdCapsule(p,hbA,hbA+vec3(0.02,-0.03,0.16),0.022),4.0));
  res=opU(res,vec2(sdCapsule(p,hbA,hbA+vec3(0.02,-0.03,-0.16),0.022),4.0));

  float cang=wt;
  vec3 cd=vec3(cos(cang),sin(cang),0.0);
  vec3 ped1=bb+cd*0.16, ped2=bb-cd*0.16;
  res=opU(res,vec2(sdCapsule(p,bb,ped1,0.012),4.0));
  res=opU(res,vec2(sdCapsule(p,bb,ped2,0.012),4.0));
  res=opU(res,vec2(sdCapsule(p,bb+vec3(0,0,0.05),bb-vec3(0,0,0.05),0.018),4.0));
  {
    vec3 pp=p-ped1;
    pp=vec3(dot(pp,vec3(cd.x,cd.y,0.0)),dot(pp,vec3(-cd.y,cd.x,0.0)),pp.z);
    res=opU(res,vec2(sdRoundBox(pp,vec3(0.02,0.04,0.06),0.01),4.0));
    vec3 pp2=p-ped2;
    pp2=vec3(dot(pp2,vec3(-cd.x,-cd.y,0.0)),dot(pp2,vec3(cd.y,-cd.x,0.0)),pp2.z);
    res=opU(res,vec2(sdRoundBox(pp2,vec3(0.02,0.04,0.06),0.01),4.0));
  }

  float bob=sin(uTime*3.0)*0.012;
  vec3 bodyC=vec3(-0.10,1.32+bob,0.0);
  vec3 bq=rotZ(-0.25)*(p-bodyC);
  res=opU(res,vec2(sdEllipsoid(bq,vec3(0.30,0.34,0.24)),5.0));

  vec3 headC=vec3(0.42,1.52+bob*0.5,0.0);
  vec3 ndir=normalize(headC-bodyC);
  vec3 nA=bodyC+ndir*0.16, nB=headC-ndir*0.10;
  res=opU(res,vec2(sdCapsule(p,nA,nB,0.085),5.0));
  res=opU(res,vec2(sdSphere(p-headC,0.13),5.0));

  vec3 beakBase=headC+vec3(0.05,-0.01,0.0);
  vec3 beakTip=beakBase+vec3(0.42,-0.06,0.0);
  vec3 bdir=normalize(beakTip-beakBase);
  float blen=length(beakTip-beakBase);
  vec3 bp=p-beakBase;
  float along=dot(bp,bdir);
  vec3 perp=bp-along*bdir;
  float tt=along/blen;
  float rr=mix(0.11,0.0,clamp(tt,0.0,1.0));
  res=opU(res,vec2(max(length(perp)-rr,max(along-blen,-along)),6.0));

  vec3 pouchC=beakBase+vec3(0.18,-0.09,0.0);
  vec3 pq=rotZ(-0.1)*(p-pouchC);
  res=opU(res,vec2(sdEllipsoid(pq,vec3(0.17,0.11,0.12)),7.0));

  vec3 eyeC=headC+vec3(0.06,0.05,0.10);
  res=opU(res,vec2(sdSphere(p-eyeC,0.025),8.0));
  res=opU(res,vec2(sdSphere(p-vec3(eyeC.x,eyeC.y,-eyeC.z),0.025),8.0));

  vec3 wingC=bodyC+vec3(-0.02,0.0,0.22);
  vec3 wq=rotZ(-0.2)*(p-wingC);
  res=opU(res,vec2(sdEllipsoid(wq,vec3(0.28,0.20,0.06)),9.0));
  vec3 wingC2=bodyC+vec3(-0.02,0.0,-0.22);
  vec3 wq2=rotZ(-0.2)*(p-wingC2);
  res=opU(res,vec2(sdEllipsoid(wq2,vec3(0.28,0.20,0.06)),9.0));

  vec3 hipL=bodyC+vec3(-0.05,-0.20,0.12), hipR=bodyC+vec3(-0.05,-0.20,-0.12);
  vec3 footL=ped1+vec3(0.0,0.0,0.09), footR=ped2-vec3(0.0,0.0,0.09);
  vec3 kneeL=mix(hipL,footL,0.5)+vec3(0.0,0.03,0.05);
  vec3 kneeR=mix(hipR,footR,0.5)+vec3(0.0,0.03,-0.05);
  res=opU(res,vec2(smin(sdCapsule(p,hipL,kneeL,0.045),sdCapsule(p,kneeL,footL,0.038),0.03),10.0));
  res=opU(res,vec2(smin(sdCapsule(p,hipR,kneeR,0.045),sdCapsule(p,kneeR,footR,0.038),0.03),10.0));
  res=opU(res,vec2(sdRoundBox(p-footL,vec3(0.03,0.02,0.045),0.012),10.0));
  res=opU(res,vec2(sdRoundBox(p-footR,vec3(0.03,0.02,0.045),0.012),10.0));

  return res;
}

vec3 calcNormal(vec3 p){
  vec2 e=vec2(0.0008,0.0);
  return normalize(vec3(
    map(p+e.xyy).x-map(p-e.xyy).x,
    map(p+e.yxy).x-map(p-e.yxy).x,
    map(p+e.yyx).x-map(p-e.yyx).x));
}
float softShadow(vec3 ro,vec3 rd,float mint,float maxt,float k){
  float res=1.0,t=mint;
  for(int i=0;i<32;i++){
    float h=map(ro+rd*t).x;
    if(h<0.001) return 0.0;
    res=min(res,k*h/t);
    t+=clamp(h,0.02,0.2);
    if(t>maxt) break;
  }
  return clamp(res,0.0,1.0);
}
float ao(vec3 p,vec3 n){
  float occ=0.0,sca=1.0;
  for(int i=0;i<4;i++){
    float h=0.01+0.14*float(i);
    float d=map(p+n*h).x;
    occ+=(h-d)*sca; sca*=0.85;
  }
  return clamp(1.0-3.0*occ,0.0,1.0);
}
vec3 background(vec3 rd){
  float t=clamp(rd.y*0.5+0.5,0.0,1.0);
  vec3 hor=vec3(0.92,0.88,0.82), top=vec3(0.45,0.66,0.93);
  vec3 c=mix(hor,top,pow(t,0.7));
  float sun=clamp(dot(rd,normalize(vec3(0.5,0.8,0.6))),0.0,1.0);
  c+=vec3(1.0,0.9,0.7)*pow(sun,80.0)*0.5;
  return c;
}
vec3 matColor(float m){
  if(m<0.5) return vec3(0.55,0.57,0.62);
  if(m<1.5) return vec3(0.05,0.05,0.06);
  if(m<2.5) return vec3(0.82,0.84,0.87);
  if(m<3.5) return vec3(0.42,0.26,0.16);
  if(m<4.5) return vec3(0.7,0.72,0.75);
  if(m<5.5) return vec3(0.95,0.93,0.90);
  if(m<6.5) return vec3(0.96,0.72,0.16);
  if(m<7.5) return vec3(0.98,0.55,0.40);
  if(m<8.5) return vec3(0.02,0.02,0.02);
  if(m<9.5) return vec3(0.80,0.78,0.74);
  if(m<10.5) return vec3(0.95,0.6,0.2);
  return vec3(0.62,0.64,0.60);
}
vec3 shade(vec3 p,vec3 n,vec3 rd,float m){
  vec3 al=matColor(m);
  vec3 ld=normalize(vec3(0.5,0.8,0.6));
  float diff=max(dot(n,ld),0.0);
  float sh=softShadow(p+n*0.01,ld,0.02,4.0,8.0);
  float amb=ao(p,n);
  vec3 sky=vec3(0.5,0.6,0.7)*max(n.y*0.5+0.5,0.0);
  vec3 col=al*(diff*sh*vec3(1.0,0.95,0.85)+amb*sky+0.06);
  if(m<0.5||abs(m-4.0)<0.5||abs(m-2.0)<0.5){
    vec3 hv=normalize(ld-rd);
    float sp=pow(max(dot(n,hv),0.0),28.0);
    col+=sp*vec3(0.8)*sh;
  }
  return col;
}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/uRes.y;
  vec3 ro=uCamPos;
  vec3 fwd=normalize(uCamTarget-ro);
  vec3 right=normalize(cross(fwd,vec3(0.0,1.0,0.0)));
  vec3 up=cross(right,fwd);
  vec3 rd=normalize(uv.x*right+uv.y*up+fwd*1.7);
  float t=0.02; float m=11.0; bool hit=false;
  for(int i=0;i<128;i++){
    vec3 p=ro+rd*t;
    vec2 d=map(p);
    if(d.x<0.0008){ hit=true; m=d.y; break; }
    t+=d.x;
    if(t>40.0) break;
  }
  vec3 col;
  if(hit){
    vec3 p=ro+rd*t;
    vec3 n=calcNormal(p);
    col=shade(p,n,rd,m);
    col=mix(col,background(rd),1.0-exp(-0.0006*t*t*t));
  } else col=background(rd);
  col=col/(col+1.0);
  col=pow(col,vec3(0.4545));
  fragColor=vec4(col,1.0);
}`;

  function compile(type,src){
    const s=gl.createShader(type);
    gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
      const log=gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile failed: '+log);
    }
    return s;
  }
  const prog=gl.createProgram();
  gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS));
  gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){
    throw new Error('Program link failed: '+gl.getProgramInfoLog(prog));
  }
  const vao=gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 3,-1, -1,3]),gl.STATIC_DRAW);
  const aPos=gl.getAttribLocation(prog,'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);

  const uRes=gl.getUniformLocation(prog,'uRes');
  const uTime=gl.getUniformLocation(prog,'uTime');
  const uCamPos=gl.getUniformLocation(prog,'uCamPos');
  const uCamTarget=gl.getUniformLocation(prog,'uCamTarget');

  const TARGET=new Float32Array([0.0,0.85,0.0]);
  const state={yaw:0.5,pitch:0.20,distance:4.2};
  let lost=false;

  function clampDist(){ if(state.distance<1.4) state.distance=1.4; if(state.distance>14) state.distance=14; }
  function clampPitch(){ if(state.pitch<-1.45) state.pitch=-1.45; if(state.pitch>1.45) state.pitch=1.45; }

  function camPos(){
    const cp=Math.cos(state.pitch), sp=Math.sin(state.pitch);
    const cy=Math.cos(state.yaw), sy=Math.sin(state.yaw);
    return [TARGET[0]+state.distance*cp*sy, TARGET[1]+state.distance*sp, TARGET[2]+state.distance*cp*cy];
  }

  const pointers=new Map();
  let dragging=false, lastX=0, lastY=0, pinchDist=0;

  function onPointerDown(e){
    try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1){ dragging=true; lastX=e.clientX; lastY=e.clientY; }
    else if(pointers.size===2){ dragging=false; const v=[...pointers.values()]; pinchDist=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y); }
    canvas.focus({preventScroll:true});
    e.preventDefault();
  }
  function onPointerMove(e){
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){
      const v=[...pointers.values()];
      const d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);
      if(pinchDist>0){ state.distance*=pinchDist/d; clampDist(); }
      pinchDist=d;
    } else if(dragging){
      const dx=e.clientX-lastX, dy=e.clientY-lastY;
      state.yaw-=dx*0.01; state.pitch+=dy*0.01; clampPitch();
      lastX=e.clientX; lastY=e.clientY;
    }
    e.preventDefault();
  }
  function onPointerUp(e){
    pointers.delete(e.pointerId);
    if(pointers.size<2) pinchDist=0;
    if(pointers.size===1){ const v=[...pointers.values()][0]; dragging=true; lastX=v.x; lastY=v.y; }
    else if(pointers.size===0) dragging=false;
  }
  function onWheel(e){
    e.preventDefault();
    state.distance*=Math.exp(e.deltaY*0.0015);
    clampDist();
  }
  function onKey(e){
    let h=true;
    const k=e.key;
    if(k==='ArrowLeft') state.yaw+=0.08;
    else if(k==='ArrowRight') state.yaw-=0.08;
    else if(k==='ArrowUp') state.pitch+=0.06;
    else if(k==='ArrowDown') state.pitch-=0.06;
    else if(k==='+'||e.code==='NumpadAdd'||e.code==='Equal') state.distance*=0.9;
    else if(k==='-'||e.code==='NumpadSubtract'||e.code==='Minus') state.distance*=1.1;
    else h=false;
    if(h){ clampPitch(); clampDist(); e.preventDefault(); }
  }
  function onContext(e){ e.preventDefault(); }
  function onLost(e){ lost=true; e.preventDefault(); }
  function onRest(e){ lost=false; }

  canvas.setAttribute('tabindex','0');
  canvas.style.outline='none';
  canvas.style.touchAction='none';
  canvas.style.cursor='grab';
  canvas.addEventListener('pointerdown',onPointerDown);
  canvas.addEventListener('pointermove',onPointerMove);
  canvas.addEventListener('pointerup',onPointerUp);
  canvas.addEventListener('pointercancel',onPointerUp);
  canvas.addEventListener('wheel',onWheel,{passive:false});
  canvas.addEventListener('keydown',onKey);
  canvas.addEventListener('contextmenu',onContext);
  canvas.addEventListener('webglcontextlost',onLost);
  canvas.addEventListener('webglcontextrestored',onRest);

  function render(timeSeconds){
    if(lost) return;
    const w=canvas.width, h=canvas.height;
    if(!w||!h) return;
    gl.viewport(0,0,w,h);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.uniform2f(uRes,w,h);
    gl.uniform1f(uTime,timeSeconds);
    const cp=camPos();
    gl.uniform3f(uCamPos,cp[0],cp[1],cp[2]);
    gl.uniform3f(uCamTarget,TARGET[0],TARGET[1],TARGET[2]);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function setView(yaw,pitch,distance){
    state.yaw=yaw; state.pitch=pitch; state.distance=distance;
    clampPitch(); clampDist();
  }
  function getView(){ return {yaw:state.yaw,pitch:state.pitch,distance:state.distance}; }
  function dispose(){
    canvas.removeEventListener('pointerdown',onPointerDown);
    canvas.removeEventListener('pointermove',onPointerMove);
    canvas.removeEventListener('pointerup',onPointerUp);
    canvas.removeEventListener('pointercancel',onPointerUp);
    canvas.removeEventListener('wheel',onWheel);
    canvas.removeEventListener('keydown',onKey);
    canvas.removeEventListener('contextmenu',onContext);
    canvas.removeEventListener('webglcontextlost',onLost);
    canvas.removeEventListener('webglcontextrestored',onRest);
    if(!lost){
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
    }
  }
  return {render,setView,getView,dispose};
}
