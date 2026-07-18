export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false
  });
  if (!gl) throw new Error("createPelicanSdf: WebGL2 is unavailable");

  const vsSource = `#version 300 es
  const vec2 P[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
  void main(){gl_Position=vec4(P[gl_VertexID],0.,1.);}`;

  const fsSource = `#version 300 es
  precision highp float;
  precision highp int;
  out vec4 fragColor;
  uniform vec2 uRes;
  uniform vec3 uView;
  uniform float uTime;

  const float PI=3.14159265359;

  float sdSphere(vec3 p,float r){return length(p)-r;}
  float sdCapsule(vec3 p,vec3 a,vec3 b,float r){
    vec3 pa=p-a,ba=b-a;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
    return length(pa-ba*h)-r;
  }
  float sdEllipsoid(vec3 p,vec3 r){
    float k0=length(p/r),k1=length(p/(r*r));
    return k0*(k0-1.)/k1;
  }
  float sdRoundBox(vec3 p,vec3 b,float r){
    vec3 q=abs(p)-b;
    return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;
  }
  float sdTorusZ(vec3 p,float R,float r){
    return length(vec2(length(p.xy)-R,p.z))-r;
  }
  void put(inout vec2 h,float d,float m){if(d<h.x)h=vec2(d,m);}

  float spokeSet(vec3 q,float phase){
    float r=length(q.xy);
    float step=PI/6.;
    float a=mod(atan(q.y,q.x)+phase+step*.5,step)-step*.5;
    float line=abs(sin(a))*r;
    return max(max(line-.013,abs(q.z)-.018),abs(r-.42)-.34);
  }

  vec2 scene(vec3 p){
    vec2 h=vec2(p.y+1.62,11.);

    float bikeBound=length(p-vec3(0.,-.1,0.))-2.45;
    if(bikeBound<h.x){
      for(int i=0;i<2;i++){
        float x=i==0?-1.35:1.35;
        vec3 q=p-vec3(x,-.65,0.);
        put(h,sdTorusZ(q,.90,.085),1.);
        put(h,sdTorusZ(q,.735,.022),2.);
        put(h,spokeSet(q,uTime*1.15),2.);
        put(h,sdCapsule(p,vec3(x,-.65,-.17),vec3(x,-.65,.17),.052),2.);
      }

      vec3 rear=vec3(-1.35,-.65,0.);
      vec3 front=vec3(1.35,-.65,0.);
      vec3 crank=vec3(0.,-.55,0.);
      vec3 seatNode=vec3(-.42,.43,0.);
      vec3 headNode=vec3(.86,.52,0.);

      put(h,sdCapsule(p,rear,seatNode,.052),3.);
      put(h,sdCapsule(p,rear,crank,.052),3.);
      put(h,sdCapsule(p,seatNode,crank,.058),3.);
      put(h,sdCapsule(p,seatNode,headNode,.052),3.);
      put(h,sdCapsule(p,crank,headNode,.058),3.);
      put(h,sdCapsule(p,headNode,front,.052),3.);
      put(h,sdCapsule(p,front,vec3(.93,.70,0.),.045),2.);
      put(h,sdCapsule(p,seatNode,vec3(-.45,.58,0.),.045),2.);

      put(h,sdRoundBox(p-vec3(-.48,.62,0.),vec3(.28,.045,.20),.055),4.);
      put(h,sdCapsule(p,vec3(.92,.70,-.43),vec3(.92,.70,.43),.035),2.);
      put(h,sdCapsule(p,vec3(.92,.70,-.50),vec3(.92,.70,-.37),.055),4.);
      put(h,sdCapsule(p,vec3(.92,.70,.37),vec3(.92,.70,.50),.055),4.);

      vec3 cq=p-crank;
      put(h,sdTorusZ(cq,.22,.032),2.);
      put(h,sdCapsule(p,crank+vec3(0.,0.,-.22),crank+vec3(0.,0.,.22),.045),2.);

      float a=uTime*1.4+.45;
      vec3 pedR=crank+vec3(cos(a)*.23,sin(a)*.23,.25);
      vec3 pedL=crank+vec3(-cos(a)*.23,-sin(a)*.23,-.25);
      put(h,sdCapsule(p,crank+vec3(0.,0.,.22),pedR,.028),2.);
      put(h,sdCapsule(p,crank+vec3(0.,0.,-.22),pedL,.028),2.);
      put(h,sdCapsule(p,pedR+vec3(-.16,0.,0.),pedR+vec3(.16,0.,0.),.035),4.);
      put(h,sdCapsule(p,pedL+vec3(-.16,0.,0.),pedL+vec3(.16,0.,0.),.035),4.);

      vec3 hipR=vec3(-.08,.76,.32);
      vec3 kneeR=vec3(.36,.08,.34);
      vec3 hipL=vec3(-.08,.76,-.32);
      vec3 kneeL=vec3(-.48,.02,-.34);
      put(h,sdCapsule(p,hipR,kneeR,.075),10.);
      put(h,sdCapsule(p,kneeR,pedR,.065),10.);
      put(h,sdCapsule(p,hipL,kneeL,.075),10.);
      put(h,sdCapsule(p,kneeL,pedL,.065),10.);
      put(h,sdCapsule(p,pedR+vec3(-.16,.035,0.),pedR+vec3(.19,.035,0.),.065),10.);
      put(h,sdCapsule(p,pedL+vec3(-.16,.035,0.),pedL+vec3(.19,.035,0.),.065),10.);
    }

    float birdBound=length(p-vec3(.35,1.45,0.))-2.1;
    if(birdBound<h.x){
      put(h,sdEllipsoid(p-vec3(-.10,1.08,0.),vec3(.73,.91,.57)),7.);
      put(h,sdEllipsoid(p-vec3(-.56,1.00,0.),vec3(.58,.52,.45)),7.);
      put(h,sdCapsule(p,vec3(.12,1.38,0.),vec3(.72,2.10,0.),.31),7.);
      put(h,sdEllipsoid(p-vec3(.77,2.22,0.),vec3(.45,.48,.42)),7.);

      vec3 wing=p-vec3(-.22,1.15,0.);
      wing.z=abs(p.z)-.49;
      put(h,sdEllipsoid(wing,vec3(.64,.64,.17)),8.);
      vec3 feather=p-vec3(-.55,.88,0.);
      feather.z=abs(p.z)-.55;
      put(h,sdEllipsoid(feather,vec3(.43,.22,.12)),8.);

      put(h,sdRoundBox(p-vec3(1.47,2.24,0.),vec3(.65,.075,.13),.07),5.);
      put(h,sdSphere(p-vec3(2.17,2.20,0.),.13),5.);
      put(h,sdEllipsoid(p-vec3(1.43,2.00,0.),vec3(.67,.31,.235)),6.);
      put(h,sdCapsule(p,vec3(.88,2.08,0.),vec3(1.95,2.11,0.),.10),6.);

      vec3 eye=p-vec3(.86,2.39,0.);
      eye.z=abs(p.z)-.405;
      put(h,sdSphere(eye,.092),9.);
      vec3 shine=p-vec3(.885,2.418,0.);
      shine.z=abs(p.z)-.475;
      put(h,sdSphere(shine,.022),7.);

      vec3 nostril=p-vec3(1.48,2.31,0.);
      nostril.z=abs(p.z)-.185;
      put(h,sdSphere(nostril,.032),9.);
    }
    return h;
  }

  vec3 normalAt(vec3 p){
    const float e=.0015;
    vec2 k=vec2(1.,-1.);
    return normalize(
      k.xyy*scene(p+k.xyy*e).x+
      k.yyx*scene(p+k.yyx*e).x+
      k.yxy*scene(p+k.yxy*e).x+
      k.xxx*scene(p+k.xxx*e).x
    );
  }

  float shadowRay(vec3 ro,vec3 rd){
    float s=1.,t=.025;
    for(int i=0;i<13;i++){
      float d=scene(ro+rd*t).x;
      s=min(s,13.*d/t);
      if(d<.001||t>9.)break;
      t+=clamp(d,.025,.32);
    }
    return clamp(s,0.,1.);
  }

  float ambientOcclusion(vec3 p,vec3 n){
    float o=0.,w=.65;
    for(int i=1;i<=3;i++){
      float r=.065*float(i);
      o+=(r-scene(p+n*r).x)*w;
      w*=.55;
    }
    return clamp(1.-o,0.,1.);
  }

  vec3 material(float m){
    if(m<1.5)return vec3(.035,.045,.052);
    if(m<2.5)return vec3(.62,.69,.70);
    if(m<3.5)return vec3(.025,.43,.48);
    if(m<4.5)return vec3(.23,.10,.055);
    if(m<5.5)return vec3(1.00,.57,.10);
    if(m<6.5)return vec3(.96,.41,.29);
    if(m<7.5)return vec3(.91,.91,.80);
    if(m<8.5)return vec3(.31,.48,.57);
    if(m<9.5)return vec3(.012,.015,.013);
    if(m<10.5)return vec3(.91,.48,.12);
    return vec3(.32,.42,.39);
  }

  vec3 sky(vec3 rd){
    float t=clamp(rd.y*.5+.5,0.,1.);
    vec3 c=mix(vec3(.84,.91,.91),vec3(.25,.54,.68),t);
    float sun=max(dot(rd,normalize(vec3(-.45,.68,.58))),0.);
    c+=vec3(1.,.77,.42)*pow(sun,220.)*.9;
    return c;
  }

  void main(){
    vec2 q=(2.*gl_FragCoord.xy-uRes)/uRes.y;
    float yaw=uView.x,pitch=uView.y,dist=uView.z;
    vec3 target=vec3(.18,.45,0.);
    vec3 ro=target+dist*vec3(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch));
    vec3 fw=normalize(target-ro);
    vec3 rt=normalize(cross(fw,vec3(0.,1.,0.)));
    vec3 up=cross(rt,fw);
    vec3 rd=normalize(fw+q.x*rt*.39+q.y*up*.39);

    float t=0.,id=-1.;
    for(int i=0;i<104;i++){
      vec2 h=scene(ro+rd*t);
      float eps=.0008*(1.+t*.055);
      if(h.x<eps){id=h.y;break;}
      t+=max(h.x*.78,.0035);
      if(t>30.)break;
    }

    vec3 col=sky(rd);
    if(id>0.){
      vec3 p=ro+rd*t;
      vec3 n=normalAt(p);
      vec3 base=material(id);
      vec3 sunDir=normalize(vec3(-.45,.78,.56));
      float sh=shadowRay(p+n*.008,sunDir);
      float dif=max(dot(n,sunDir),0.)*sh;
      vec3 fillDir=normalize(vec3(.65,.35,-.72));
      float fill=max(dot(n,fillDir),0.);
      float ao=ambientOcclusion(p,n);
      float hemi=n.y*.5+.5;
      vec3 light=vec3(.16,.19,.20)+vec3(1.05,.91,.72)*dif+
                 vec3(.18,.30,.39)*fill+vec3(.12,.15,.13)*hemi;
      col=base*light*ao;
      vec3 hv=normalize(sunDir-rd);
      float spec=pow(max(dot(n,hv),0.),id>1.5&&id<2.5?75.:32.);
      col+=vec3(1.,.88,.70)*spec*sh*(id<2.5?.65:.22);
      float rim=pow(1.-max(dot(n,-rd),0.),3.);
      col+=vec3(.18,.31,.36)*rim*.35;
      float fog=1.-exp(-.007*t*t);
      col=mix(col,sky(rd),fog*.45);
    }
    col=col/(col+vec3(.72));
    col=pow(max(col,0.),vec3(1./2.2));
    fragColor=vec4(col,1.);
  }`;

  let program = null;
  let vao = null;
  let uRes = null;
  let uView = null;
  let uTime = null;
  let lost = false;
  let disposed = false;
  let rendered = false;
  let lastTime = 0;
  let yaw = .55;
  let pitch = .16;
  let distance = 6.35;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "unknown shader error";
      gl.deleteShader(shader);
      throw new Error("createPelicanSdf: shader compilation failed: " + message);
    }
    return shader;
  }

  function build() {
    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const next = gl.createProgram();
    gl.attachShader(next, vs);
    gl.attachShader(next, fs);
    gl.linkProgram(next);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(next) || "unknown link error";
      gl.deleteProgram(next);
      throw new Error("createPelicanSdf: shader linking failed: " + message);
    }
    program = next;
    vao = gl.createVertexArray();
    uRes = gl.getUniformLocation(program, "uRes");
    uView = gl.getUniformLocation(program, "uView");
    uTime = gl.getUniformLocation(program, "uTime");
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  build();

  const oldTabIndex = canvas.getAttribute("tabindex");
  const oldTouchAction = canvas.style.touchAction;
  canvas.tabIndex = 0;
  canvas.style.touchAction = "none";

  const pointers = new Map();
  let pinchDistance = 0;

  function clampView() {
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
    distance = Math.max(2.25, Math.min(14, distance));
  }

  function drawAgain() {
    if (rendered && !lost && !disposed) render(lastTime);
  }

  function pointerDown(e) {
    if (disposed) return;
    canvas.focus();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (pointers.size === 2) {
      const a = Array.from(pointers.values());
      pinchDistance = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    }
    e.preventDefault();
  }

  function pointerMove(e) {
    const old = pointers.get(e.pointerId);
    if (!old) return;
    if (pointers.size === 1) {
      yaw -= (e.clientX - old.x) * .008;
      pitch += (e.clientY - old.y) * .008;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    } else {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const a = Array.from(pointers.values());
      if (a.length >= 2) {
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinchDistance > 1 && d > 1) distance *= pinchDistance / d;
        pinchDistance = d;
      }
    }
    clampView();
    drawAgain();
    e.preventDefault();
  }

  function pointerUp(e) {
    pointers.delete(e.pointerId);
    pinchDistance = 0;
    if (pointers.size === 2) {
      const a = Array.from(pointers.values());
      pinchDistance = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    }
    e.preventDefault();
  }

  function wheel(e) {
    distance *= Math.exp(e.deltaY * .00125);
    clampView();
    drawAgain();
    e.preventDefault();
  }

  function keyDown(e) {
    let used = true;
    if (e.key === "ArrowLeft") yaw -= .09;
    else if (e.key === "ArrowRight") yaw += .09;
    else if (e.key === "ArrowUp") pitch += .075;
    else if (e.key === "ArrowDown") pitch -= .075;
    else if (e.key === "+" || e.key === "=") distance *= .88;
    else if (e.key === "-" || e.key === "_") distance *= 1.14;
    else used = false;
    if (used) {
      clampView();
      drawAgain();
      e.preventDefault();
    }
  }

  function contextMenu(e) { e.preventDefault(); }

  function contextLost(e) {
    e.preventDefault();
    lost = true;
    program = null;
    vao = null;
  }

  function contextRestored() {
    if (disposed) return;
    try {
      build();
      lost = false;
      drawAgain();
    } catch (_) {
      lost = true;
    }
  }

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", keyDown);
  canvas.addEventListener("contextmenu", contextMenu);
  canvas.addEventListener("webglcontextlost", contextLost, false);
  canvas.addEventListener("webglcontextrestored", contextRestored, false);

  function render(timeSeconds) {
    if (disposed || lost || !program || gl.isContextLost()) return;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    if (w < 1 || h < 1) return;
    lastTime = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    rendered = true;
    gl.viewport(0, 0, w, h);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(uRes, w, h);
    gl.uniform3f(uView, yaw, pitch, distance);
    gl.uniform1f(uTime, lastTime);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setView(nextYaw, nextPitch, nextDistance) {
    if (Number.isFinite(nextYaw)) yaw = nextYaw;
    if (Number.isFinite(nextPitch)) pitch = nextPitch;
    if (Number.isFinite(nextDistance)) distance = nextDistance;
    clampView();
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    pointers.clear();
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.removeEventListener("pointermove", pointerMove);
    canvas.removeEventListener("pointerup", pointerUp);
    canvas.removeEventListener("pointercancel", pointerUp);
    canvas.removeEventListener("wheel", wheel);
    canvas.removeEventListener("keydown", keyDown);
    canvas.removeEventListener("contextmenu", contextMenu);
    canvas.removeEventListener("webglcontextlost", contextLost, false);
    canvas.removeEventListener("webglcontextrestored", contextRestored, false);
    if (oldTabIndex === null) canvas.removeAttribute("tabindex");
    else canvas.setAttribute("tabindex", oldTabIndex);
    canvas.style.touchAction = oldTouchAction;
    if (!gl.isContextLost()) {
      if (vao) gl.deleteVertexArray(vao);
      if (program) gl.deleteProgram(program);
    }
    vao = null;
    program = null;
  }

  return { render, setView, getView, dispose };
}
