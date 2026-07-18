const VERTEX = `#version 300 es
precision highp float;
void main(){
  vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCamera;

const float PI=3.14159265;

vec2 put(vec2 a,float d,float id){return d<a.x?vec2(d,id):a;}
float sph(vec3 p,vec3 c,float r){return length(p-c)-r;}
float ell(vec3 p,vec3 c,vec3 s){return (length((p-c)/s)-1.0)*min(s.x,min(s.y,s.z));}
float cap(vec3 p,vec3 a,vec3 b,float r){
  vec3 q=b-a;
  float h=clamp(dot(p-a,q)/dot(q,q),0.0,1.0);
  return length(p-(a+h*q))-r;
}
float tor(vec3 p,vec3 c,float R,float r){
  vec3 q=p-c;
  return length(vec2(length(q.xy)-R,q.z))-r;
}

vec2 wheel(vec3 p,float x){
  vec2 r=vec2(1e4,0.0);
  vec3 c=vec3(x,0.0,0.0);
  r=put(r,tor(p,c,1.25,.145),2.0);
  r=put(r,tor(p,c,1.17,.045),3.0);
  r=put(r,sph(p,c,.14),3.0);
  for(int i=0;i<8;i++){
    float a=float(i)*PI*.25;
    vec3 e=vec3(x+1.13*cos(a),1.13*sin(a),0.0);
    r=put(r,cap(p,c,e,.022),3.0);
  }
  return r;
}

vec2 bicycle(vec3 p){
  vec2 r=vec2(1e4,0.0);
  r=min(r,wheel(p,-2.05));
  r=min(r,wheel(p,2.05));
  vec3 rear=vec3(-2.05,0.0,0.0);
  vec3 front=vec3(2.05,0.0,0.0);
  vec3 crank=vec3(0.0,0.03,0.0);
  vec3 seat=vec3(-.72,1.18,0.0);
  vec3 head=vec3(1.08,1.10,0.0);
  r=put(r,cap(p,rear,seat,.09),4.0);
  r=put(r,cap(p,seat,crank,.09),4.0);
  r=put(r,cap(p,crank,rear,.075),4.0);
  r=put(r,cap(p,seat,head,.095),4.0);
  r=put(r,cap(p,head,crank,.095),4.0);
  r=put(r,cap(p,head,front,.085),4.0);
  r=put(r,cap(p,head,vec3(1.06,1.62,0.0),.075),4.0);
  r=put(r,cap(p,vec3(1.06,1.62,-.38),vec3(1.06,1.62,.38),.065),5.0);
  r=put(r,cap(p,vec3(-1.02,1.22,0.0),vec3(-.48,1.22,0.0),.12),5.0);
  r=put(r,tor(p,crank,.27,.035),12.0);
  r=put(r,sph(p,crank,.13),12.0);
  r=put(r,cap(p,vec3(0.02,.06,.08),vec3(.38,.28,.08),.035),12.0);
  r=put(r,cap(p,vec3(.34,.28,.08),vec3(.58,.28,.08),.055),12.0);
  r=put(r,cap(p,vec3(-.02,.01,-.08),vec3(-.33,-.22,-.08),.035),12.0);
  r=put(r,cap(p,vec3(-.29,-.22,-.08),vec3(-.53,-.22,-.08),.055),12.0);
  r=put(r,cap(p,vec3(-2.05,0.0,.0),vec3(2.05,0.0,.0),.025),5.0);
  return r;
}

vec2 bird(vec3 p){
  vec2 r=vec2(1e4,0.0);
  float b=.035*sin(uTime*2.6);
  p.y-=b;
  r=put(r,ell(p,vec3(-.42,2.38,0.0),vec3(1.12,.91,.63)),6.0);
  r=put(r,ell(p,vec3(-.05,2.94,0.0),vec3(.56,.72,.48)),6.0);
  r=put(r,sph(p,vec3(.18,3.43,0.0),.57),6.0);
  r=put(r,ell(p,vec3(-1.26,2.47,0.0),vec3(.58,.38,.36)),6.0);

  r=put(r,ell(p,vec3(-.42,2.37,.59),vec3(.73,.87,.19)),7.0);
  r=put(r,cap(p,vec3(-.30,2.72,.72),vec3(-.78,1.70,.76),.24),7.0);
  r=put(r,cap(p,vec3(-.58,2.45,.75),vec3(-1.02,1.92,.77),.18),7.0);
  r=put(r,ell(p,vec3(-.42,2.37,-.57),vec3(.72,.84,.18)),7.0);
  r=put(r,cap(p,vec3(-.28,2.69,-.70),vec3(-.76,1.76,-.73),.23),7.0);

  r=put(r,cap(p,vec3(.43,3.40,0.0),vec3(1.55,3.27,0.0),.205),8.0);
  r=put(r,ell(p,vec3(1.57,3.26,0.0),vec3(.25,.14,.17)),8.0);
  r=put(r,ell(p,vec3(.51,2.89,.03),vec3(.58,.53,.38)),10.0);
  r=put(r,ell(p,vec3(.40,2.92,.03),vec3(.38,.42,.34)),10.0);

  r=put(r,sph(p,vec3(.40,3.57,.40),.135),13.0);
  r=put(r,sph(p,vec3(.40,3.57,.515),.058),11.0);
  r=put(r,sph(p,vec3(.40,3.57,-.40),.135),13.0);
  r=put(r,sph(p,vec3(.40,3.57,-.515),.058),11.0);

  r=put(r,cap(p,vec3(-.34,1.83,.30),vec3(.14,1.07,.32),.115),9.0);
  r=put(r,cap(p,vec3(.14,1.07,.32),vec3(.28,.22,.32),.10),9.0);
  r=put(r,cap(p,vec3(.15,.18,.32),vec3(.56,.18,.32),.105),9.0);
  r=put(r,cap(p,vec3(-.55,1.82,-.30),vec3(-.25,1.00,-.32),.11),9.0);
  r=put(r,cap(p,vec3(-.25,1.00,-.32),vec3(-.16,.22,-.32),.095),9.0);
  r=put(r,cap(p,vec3(-.43,.18,-.32),vec3(-.08,.18,-.32),.10),9.0);
  return r;
}

vec2 mapScene(vec3 p){
  vec2 r=vec2(p.y+1.42,1.0);
  r=min(r,bicycle(p));
  r=min(r,bird(p));
  return r;
}

vec3 normalAt(vec3 p){
  float e=.0012;
  vec2 k=vec2(1.0,-1.0);
  return normalize(
    k.xyy*mapScene(p+k.xyy*e).x+
    k.yyx*mapScene(p+k.yyx*e).x+
    k.yxy*mapScene(p+k.yxy*e).x+
    k.xxx*mapScene(p+k.xxx*e).x);
}

float shadow(vec3 ro,vec3 rd){
  float t=.04;
  float s=1.0;
  for(int i=0;i<12;i++){
    float h=mapScene(ro+rd*t).x;
    s=min(s,14.0*h/t);
    t+=clamp(h,.025,.30);
  }
  return clamp(s,0.0,1.0);
}

vec3 material(float id){
  if(id<1.5)return vec3(.20,.28,.27);
  if(id<2.5)return vec3(.018,.025,.026);
  if(id<3.5)return vec3(.48,.58,.58);
  if(id<4.5)return vec3(.035,.32,.38);
  if(id<5.5)return vec3(.07,.09,.10);
  if(id<6.5)return vec3(.91,.88,.77);
  if(id<7.5)return vec3(.55,.48,.35);
  if(id<8.5)return vec3(.92,.64,.16);
  if(id<9.5)return vec3(.88,.39,.08);
  if(id<10.5)return vec3(.94,.48,.28);
  if(id<11.5)return vec3(.008,.006,.004);
  if(id<12.5)return vec3(.70,.24,.06);
  return vec3(.98,.98,.92);
}

void main(){
  vec2 uv=(2.0*gl_FragCoord.xy-uResolution)/uResolution.y;
  vec3 target=vec3(0.0,1.35,0.0);
  float yaw=uCamera.x;
  float pitch=uCamera.y;
  float dist=uCamera.z;
  float cp=cos(pitch);
  vec3 ro=target+vec3(sin(yaw)*cp*dist,sin(pitch)*dist,cos(yaw)*cp*dist);
  vec3 f=normalize(target-ro);
  vec3 right=normalize(cross(f,vec3(0,1,0)));
  vec3 up=cross(right,f);
  vec3 rd=normalize(f+uv.x*right+uv.y*up);

  vec3 sky=mix(vec3(.035,.075,.12),vec3(.42,.67,.76),clamp(rd.y*.8+.22,0.0,1.0));
  float t=0.0;
  float id=0.0;
  bool hit=false;
  for(int i=0;i<78;i++){
    vec2 h=mapScene(ro+rd*t);
    if(h.x<.0016){id=h.y;hit=true;break;}
    t+=h.x*.86;
    if(t>28.0)break;
  }

  vec3 col=sky;
  if(hit){
    vec3 pos=ro+rd*t;
    vec3 n=normalAt(pos);
    vec3 light=normalize(vec3(-.45,.86,.60));
    float sh=shadow(pos+n*.008,light);
    float diff=max(dot(n,light),0.0)*sh;
    float hemi=.5+.5*n.y;
    vec3 base=material(id);
    col=base*(.16+.68*diff+.18*hemi);
    vec3 halfV=normalize(light-rd);
    float spec=pow(max(dot(n,halfV),0.0),32.0);
    col+=vec3(.8,.9,1.0)*spec*.24*sh;
    if(id<1.5){
      float grid=mod(floor(pos.x)+floor(pos.z),2.0);
      col*=mix(.78,1.08,grid);
    }
    float edge=pow(1.0-max(dot(n,-rd),0.0),3.0);
    col+=vec3(.08,.16,.18)*edge;
  }
  col=col/(col+vec3(1.0));
  col=pow(max(col,vec3(0.0)),vec3(.4545));
  outColor=vec4(col,1.0);
}`;

export function createPelicanSdf(canvas){
  if(!canvas||typeof canvas.getContext!=="function")throw new Error("createPelicanSdf requires an HTMLCanvasElement");
  const gl=canvas.getContext("webgl2",{alpha:false,antialias:false});
  if(!gl)throw new Error("WebGL2 is unavailable");
  let program=null,locTime=null,locRes=null,locCam=null;
  let disposed=false,lost=false;
  let yaw=.55,pitch=.18,distance=8.7;
  const oldTab=canvas.getAttribute("tabindex");
  const oldTouch=canvas.style.touchAction;
  canvas.tabIndex=0;
  canvas.style.touchAction="none";

  function shader(type,src){
    const s=gl.createShader(type);
    gl.shaderSource(s,src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
      const log=gl.getShaderInfoLog(s)||"unknown shader error";
      gl.deleteShader(s);
      throw new Error("Shader compilation failed: "+log);
    }
    return s;
  }
  function init(){
    const v=shader(gl.VERTEX_SHADER,VERTEX);
    const f=shader(gl.FRAGMENT_SHADER,FRAGMENT);
    const p=gl.createProgram();
    gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
    gl.deleteShader(v);gl.deleteShader(f);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
      const log=gl.getProgramInfoLog(p)||"unknown link error";
      gl.deleteProgram(p);
      throw new Error("Shader linking failed: "+log);
    }
    program=p;
    locTime=gl.getUniformLocation(p,"uTime");
    locRes=gl.getUniformLocation(p,"uResolution");
    locCam=gl.getUniformLocation(p,"uCamera");
  }
  init();

  const pointers=new Map();
  let lastX=0,lastY=0,pinchDistance=0,pinchZoom=distance;
  function pointerDown(e){
    if(disposed)return;
    canvas.focus({preventScroll:true});
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(canvas.setPointerCapture)canvas.setPointerCapture(e.pointerId);
    if(pointers.size===1){lastX=e.clientX;lastY=e.clientY;}
    if(pointers.size===2){
      const a=[...pointers.values()];
      pinchDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      pinchZoom=distance;
    }
    e.preventDefault();
  }
  function pointerMove(e){
    const old=pointers.get(e.pointerId);
    if(!old)return;
    old.x=e.clientX;old.y=e.clientY;
    if(pointers.size===1){
      yaw+=(e.clientX-lastX)*.010;
      pitch= Math.max(-1.25,Math.min(1.25,pitch+(e.clientY-lastY)*.010));
      lastX=e.clientX;lastY=e.clientY;
    }else if(pointers.size>=2){
      const a=[...pointers.values()];
      const d=Math.max(2,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y));
      distance=Math.max(3.8,Math.min(18.0,pinchZoom*pinchDistance/d));
    }
    e.preventDefault();
  }
  function pointerUp(e){
    pointers.delete(e.pointerId);
    if(pointers.size===1){
      const a=[...pointers.values()][0];
      lastX=a.x;lastY=a.y;
    }
    e.preventDefault();
  }
  function wheel(e){
    distance=Math.max(3.8,Math.min(18.0,distance*Math.exp(e.deltaY*.001)));
    e.preventDefault();
  }
  function key(e){
    let used=true;
    if(e.key==="ArrowLeft")yaw-=.12;
    else if(e.key==="ArrowRight")yaw+=.12;
    else if(e.key==="ArrowUp")pitch=Math.max(-1.25,pitch-.10);
    else if(e.key==="ArrowDown")pitch=Math.min(1.25,pitch+.10);
    else if(e.key==="+"||e.key==="=")distance=Math.max(3.8,distance*.9);
    else if(e.key==="-"||e.key==="_")distance=Math.min(18.0,distance*1.1);
    else used=false;
    if(used)e.preventDefault();
  }
  function onLost(e){e.preventDefault();lost=true;}
  function onRestored(){
    if(disposed)return;
    try{init();lost=false;}catch(_){lost=true;}
  }
  canvas.addEventListener("pointerdown",pointerDown);
  canvas.addEventListener("pointermove",pointerMove);
  canvas.addEventListener("pointerup",pointerUp);
  canvas.addEventListener("pointercancel",pointerUp);
  canvas.addEventListener("wheel",wheel,{passive:false});
  canvas.addEventListener("keydown",key);
  canvas.addEventListener("webglcontextlost",onLost,false);
  canvas.addEventListener("webglcontextrestored",onRestored,false);

  return {
    render(timeSeconds){
      if(disposed||lost||!program)return;
      gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
      gl.useProgram(program);
      gl.uniform1f(locTime,Number.isFinite(timeSeconds)?timeSeconds:0);
      gl.uniform2f(locRes,gl.drawingBufferWidth,gl.drawingBufferHeight);
      gl.uniform3f(locCam,yaw,pitch,distance);
      gl.drawArrays(gl.TRIANGLES,0,3);
    },
    setView(y,p,d){
      if(Number.isFinite(y))yaw=y;
      if(Number.isFinite(p))pitch=Math.max(-1.25,Math.min(1.25,p));
      if(Number.isFinite(d))distance=Math.max(3.8,Math.min(18.0,d));
    },
    getView(){return {yaw,pitch,distance};},
    dispose(){
      if(disposed)return;
      disposed=true;
      canvas.removeEventListener("pointerdown",pointerDown);
      canvas.removeEventListener("pointermove",pointerMove);
      canvas.removeEventListener("pointerup",pointerUp);
      canvas.removeEventListener("pointercancel",pointerUp);
      canvas.removeEventListener("wheel",wheel);
      canvas.removeEventListener("keydown",key);
      canvas.removeEventListener("webglcontextlost",onLost);
      canvas.removeEventListener("webglcontextrestored",onRestored);
      if(program)gl.deleteProgram(program);
      program=null;
      if(oldTab===null)canvas.removeAttribute("tabindex");
      else canvas.setAttribute("tabindex",oldTab);
      canvas.style.touchAction=oldTouch;
    }
  };
}
