export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  });
  if (!gl) throw new Error("Pelican SDF requires WebGL2, but this canvas could not create a WebGL2 context.");

  const vertexSource = `#version 300 es
void main(){
  vec2 p=vec2(gl_VertexID==1?2.0:0.0,gl_VertexID==2?2.0:0.0);
  gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;

  const fragmentSource = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uEye,uForward,uRight,uUp;

float sphereS(vec3 p,float r){return length(p)-r;}
float boxS(vec3 p,vec3 b){
  vec3 q=abs(p)-b;
  return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
}
float capsuleS(vec3 p,vec3 a,vec3 b,float r){
  vec3 pa=p-a,ba=b-a;
  float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h)-r;
}
float torusS(vec3 p,float R,float r){
  return length(vec2(length(p.xy)-R,p.z))-r;
}
float ellipsoidS(vec3 p,vec3 c,vec3 r,float angle){
  vec3 q=p-c;
  float co=cos(angle),si=sin(angle);
  q.xy=mat2(co,-si,si,co)*q.xy;
  float k0=length(q/r);
  if(k0<0.0001)return -min(r.x,min(r.y,r.z));
  float k1=length(q/(r*r));
  return k0*(k0-1.0)/k1;
}
float smoothMin(float a,float b,float k){
  float h=max(k-abs(a-b),0.0)/k;
  return min(a,b)-h*h*k*0.25;
}
void put(inout vec2 h,float d,float material){
  if(d<h.x)h=vec2(d,material);
}
void addWheel(inout vec2 h,vec3 p,float x,float phase){
  vec3 q=p-vec3(x,0.0,0.0);
  put(h,torusS(q,0.98,0.085),1.0);
  put(h,torusS(q,0.86,0.026),2.0);
  put(h,capsuleS(p,vec3(x,0.0,-0.19),vec3(x,0.0,0.19),0.075),4.0);
  for(int i=0;i<8;i++){
    float a=phase+float(i)*0.7853981634;
    vec3 e=vec3(x+cos(a)*0.84,sin(a)*0.84,0.0);
    put(h,capsuleS(p,vec3(x,0.0,0.0),e,0.013),2.0);
  }
}

vec2 scene(vec3 p){
  vec2 h=vec2(p.y+1.10,12.0);
  float outer=boxS(p-vec3(0.0,1.35,0.0),vec3(2.75,2.75,1.25));
  if(outer>0.32){
    if(outer<h.x)return vec2(outer,0.0);
    return h;
  }

  float phase=mod(uTime,1000.0)*1.7+0.35;
  vec2 crank=vec2(-0.28,0.18);
  vec2 turn=0.34*vec2(cos(phase),sin(phase));
  vec3 pedalR=vec3(crank+turn,0.28);
  vec3 pedalL=vec3(crank-turn,-0.28);

  float bodyBound=boxS(p-vec3(-0.34,2.66,0.0),vec3(1.30,1.38,0.82));
  if(bodyBound<h.x){
    float bird=ellipsoidS(p,vec3(-0.48,2.28,0.0),vec3(0.64,0.86,0.53),-0.10);
    bird=smoothMin(bird,capsuleS(p,vec3(-0.42,2.58,0.0),vec3(-0.04,3.24,0.0),0.32),0.20);
    bird=smoothMin(bird,ellipsoidS(p,vec3(-0.01,3.31,0.0),vec3(0.40,0.44,0.38),0.0),0.16);
    bird=smoothMin(bird,ellipsoidS(p,vec3(-1.03,2.10,0.0),vec3(0.76,0.18,0.28),0.16),0.08);
    bird=smoothMin(bird,capsuleS(p,vec3(-0.18,3.57,0.03),vec3(-0.47,3.79,0.07),0.055),0.04);
    bird=smoothMin(bird,capsuleS(p,vec3(-0.11,3.60,-0.04),vec3(-0.34,3.85,-0.08),0.045),0.035);
    put(h,bird,6.0);

    for(int j=0;j<2;j++){
      float s=float(j)*2.0-1.0;
      put(h,ellipsoidS(p,vec3(-0.55,2.31,0.47*s),vec3(0.45,0.67,0.16),-0.20),7.0);
      put(h,capsuleS(p,vec3(-0.48,2.58,0.625*s),vec3(-0.78,2.05,0.625*s),0.038),14.0);
      put(h,capsuleS(p,vec3(-0.62,2.50,0.635*s),vec3(-0.91,2.12,0.635*s),0.032),14.0);
      put(h,sphereS(p-vec3(0.10,3.43,0.335*s),0.098),8.0);
      put(h,sphereS(p-vec3(0.12,3.445,0.392*s),0.062),10.0);
      put(h,sphereS(p-vec3(0.14,3.468,0.442*s),0.017),6.0);
    }
  }

  float beakBound=boxS(p-vec3(1.05,3.18,0.0),vec3(1.08,0.61,0.34));
  if(beakBound<h.x){
    put(h,ellipsoidS(p,vec3(1.07,3.33,0.0),vec3(0.93,0.145,0.18),-0.055),8.0);
    float pouch=ellipsoidS(p,vec3(0.98,3.10,0.0),vec3(0.84,0.28,0.205),-0.075);
    pouch=smoothMin(pouch,ellipsoidS(p,vec3(0.43,2.99,0.0),vec3(0.39,0.37,0.23),-0.18),0.15);
    put(h,pouch,9.0);
    for(int j=0;j<2;j++){
      float s=float(j)*2.0-1.0;
      put(h,capsuleS(p,vec3(0.38,3.34,0.17*s),vec3(1.78,3.27,0.08*s),0.018),10.0);
      put(h,sphereS(p-vec3(0.53,3.39,0.15*s),0.031),10.0);
    }
  }

  float armBound=boxS(p-vec3(0.30,2.10,0.0),vec3(0.70,0.60,0.72));
  if(armBound<h.x){
    for(int j=0;j<2;j++){
      float s=float(j)*2.0-1.0;
      put(h,capsuleS(p,vec3(-0.10,2.44,0.41*s),vec3(0.34,2.08,0.52*s),0.105),7.0);
      put(h,capsuleS(p,vec3(0.34,2.08,0.52*s),vec3(0.68,1.77,0.58*s),0.074),7.0);
    }
  }

  float legBound=boxS(p-vec3(-0.15,0.82,0.0),vec3(0.78,1.12,0.46));
  if(legBound<h.x){
    vec3 hipR=vec3(-0.48,1.68,0.28);
    vec3 hipL=vec3(-0.48,1.68,-0.28);
    vec3 kneeR=mix(hipR,pedalR,0.50)+vec3(0.29,0.13,0.0);
    vec3 kneeL=mix(hipL,pedalL,0.50)+vec3(0.29,0.13,0.0);
    put(h,capsuleS(p,hipR,kneeR,0.076),11.0);
    put(h,capsuleS(p,kneeR,pedalR,0.068),11.0);
    put(h,capsuleS(p,hipL,kneeL,0.076),11.0);
    put(h,capsuleS(p,kneeL,pedalL,0.068),11.0);
    put(h,capsuleS(p,pedalR+vec3(-0.14,0.035,0.0),pedalR+vec3(0.17,0.035,0.0),0.066),11.0);
    put(h,capsuleS(p,pedalL+vec3(-0.14,0.035,0.0),pedalL+vec3(0.17,0.035,0.0),0.066),11.0);
  }

  float frameBound=boxS(p-vec3(0.0,0.82,0.0),vec3(1.73,1.06,0.76));
  if(frameBound<h.x){
    vec3 rear=vec3(-1.43,0.0,0.0);
    vec3 front=vec3(1.43,0.0,0.0);
    vec3 bottom=vec3(-0.28,0.18,0.0);
    vec3 saddle=vec3(-0.62,1.42,0.0);
    vec3 headLow=vec3(0.74,0.62,0.0);
    vec3 headHigh=vec3(0.64,1.36,0.0);

    put(h,capsuleS(p,rear,saddle,0.058),3.0);
    put(h,capsuleS(p,rear,bottom,0.058),3.0);
    put(h,capsuleS(p,bottom,saddle,0.061),3.0);
    put(h,capsuleS(p,saddle,headHigh,0.058),3.0);
    put(h,capsuleS(p,bottom,headLow,0.063),3.0);
    put(h,capsuleS(p,headLow,headHigh,0.068),3.0);

    put(h,capsuleS(p,vec3(0.71,0.70,-0.105),front+vec3(0.0,0.0,-0.12),0.044),4.0);
    put(h,capsuleS(p,vec3(0.71,0.70,0.105),front+vec3(0.0,0.0,0.12),0.044),4.0);
    put(h,capsuleS(p,headHigh,vec3(0.76,1.72,0.0),0.043),4.0);
    put(h,capsuleS(p,vec3(0.76,1.72,-0.49),vec3(0.76,1.72,0.49),0.038),4.0);

    for(int j=0;j<2;j++){
      float s=float(j)*2.0-1.0;
      put(h,capsuleS(p,vec3(0.76,1.72,0.46*s),vec3(0.67,1.62,0.63*s),0.038),4.0);
      put(h,capsuleS(p,vec3(0.67,1.62,0.57*s),vec3(0.61,1.59,0.69*s),0.055),5.0);
    }

    put(h,ellipsoidS(p,vec3(-0.69,1.55,0.0),vec3(0.34,0.095,0.245),0.035),5.0);
    put(h,capsuleS(p,vec3(-0.62,1.10,0.0),vec3(-0.64,1.48,0.0),0.045),4.0);

    put(h,torusS(p-vec3(-0.28,0.18,0.17),0.25,0.027),13.0);
    put(h,torusS(p-vec3(-1.43,0.0,0.17),0.13,0.020),13.0);
    put(h,capsuleS(p,vec3(-1.40,0.11,0.17),vec3(-0.29,0.43,0.17),0.017),13.0);
    put(h,capsuleS(p,vec3(-1.40,-0.10,0.17),vec3(-0.29,-0.07,0.17),0.017),13.0);

    put(h,capsuleS(p,vec3(-0.28,0.18,0.17),pedalR,0.034),4.0);
    put(h,capsuleS(p,vec3(-0.28,0.18,-0.17),pedalL,0.034),4.0);
    put(h,capsuleS(p,pedalR+vec3(-0.14,0.0,-0.03),pedalR+vec3(0.14,0.0,0.03),0.045),5.0);
    put(h,capsuleS(p,pedalL+vec3(-0.14,0.0,-0.03),pedalL+vec3(0.14,0.0,0.03),0.045),5.0);
  }

  float rearBound=length(p-vec3(-1.43,0.0,0.0))-1.10;
  if(rearBound<h.x)addWheel(h,p,-1.43,-phase*0.55);
  float frontBound=length(p-vec3(1.43,0.0,0.0))-1.10;
  if(frontBound<h.x)addWheel(h,p,1.43,-phase*0.55+0.22);

  return h;
}

vec3 normalAt(vec3 p){
  const float e=0.0015;
  return normalize(
    vec3(1.0,-1.0,-1.0)*scene(p+vec3(e,-e,-e)).x+
    vec3(-1.0,-1.0,1.0)*scene(p+vec3(-e,-e,e)).x+
    vec3(-1.0,1.0,-1.0)*scene(p+vec3(-e,e,-e)).x+
    vec3(1.0,1.0,1.0)*scene(p+vec3(e,e,e)).x
  );
}
float shadowAt(vec3 p,vec3 light){
  float shade=1.0,t=0.025;
  for(int i=0;i<15;i++){
    float d=scene(p+light*t).x;
    if(d<0.001)return 0.12;
    shade=min(shade,12.0*d/t);
    t+=clamp(d,0.025,0.36);
    if(t>7.0)break;
  }
  return clamp(shade,0.12,1.0);
}
float ambientAt(vec3 p,vec3 n){
  float occ=0.0,weight=1.0;
  for(int i=1;i<=3;i++){
    float d=0.055*float(i);
    occ+=(d-scene(p+n*d).x)*weight;
    weight*=0.52;
  }
  return 1.0-clamp(occ*1.8,0.0,0.55);
}
vec3 baseColor(float m,vec3 p){
  if(m<1.5)return vec3(0.025,0.032,0.040);
  if(m<2.5)return vec3(0.62,0.72,0.76);
  if(m<3.5)return vec3(0.035,0.48,0.54);
  if(m<4.5)return vec3(0.52,0.61,0.65);
  if(m<5.5)return vec3(0.20,0.095,0.055);
  if(m<6.5)return vec3(0.94,0.91,0.82);
  if(m<7.5)return vec3(0.58,0.68,0.70);
  if(m<8.5)return vec3(1.00,0.65,0.12);
  if(m<9.5)return vec3(0.94,0.37,0.11);
  if(m<10.5)return vec3(0.018,0.014,0.012);
  if(m<11.5)return vec3(0.94,0.44,0.08);
  if(m<12.5){
    float c=mod(floor(p.x*0.72)+floor(p.z*0.72),2.0);
    return mix(vec3(0.69,0.73,0.65),vec3(0.76,0.78,0.69),c);
  }
  if(m<13.5)return vec3(0.78,0.57,0.16);
  return vec3(0.39,0.51,0.54);
}
vec3 skyColor(vec3 d){
  float v=clamp(d.y*0.58+0.48,0.0,1.0);
  vec3 sky=mix(vec3(0.79,0.89,0.91),vec3(0.24,0.51,0.70),v);
  vec3 sunDir=normalize(vec3(-0.45,0.72,0.50));
  sky+=vec3(1.0,0.72,0.37)*pow(max(dot(d,sunDir),0.0),96.0)*0.42;
  return sky;
}

void main(){
  vec2 q=(2.0*gl_FragCoord.xy-uResolution)/uResolution.y;
  vec3 rd=normalize(uForward+0.43*q.x*uRight+0.43*q.y*uUp);
  vec3 ro=uEye;
  float t=0.015;
  vec2 hit=vec2(0.0);
  bool found=false;

  for(int i=0;i<104;i++){
    vec3 p=ro+rd*t;
    hit=scene(p);
    float eps=0.0008+0.00032*t;
    if(hit.x<eps){found=true;break;}
    t+=max(hit.x*0.76,0.00035);
    if(t>25.0)break;
  }

  vec3 col=skyColor(rd);
  if(found&&t<=25.0){
    vec3 p=ro+rd*t;
    vec3 n=normalAt(p);
    vec3 light=normalize(vec3(-0.45,0.72,0.50));
    float diff=max(dot(n,light),0.0);
    float hemi=0.5+0.5*n.y;
    float sh=shadowAt(p+n*0.012,light);
    float ao=ambientAt(p,n);
    vec3 base=baseColor(hit.y,p);
    col=base*(0.20+0.20*hemi+0.76*diff*sh)*ao;
    float metal=(hit.y>1.5&&hit.y<4.5)||(hit.y>12.5&&hit.y<13.5)?0.48:0.13;
    float spec=pow(max(dot(reflect(-light,n),-rd),0.0),30.0)*metal*sh;
    col+=vec3(1.0,0.91,0.72)*spec;
    float rim=pow(1.0-max(dot(n,-rd),0.0),3.0);
    col+=base*rim*0.11;
    float fog=smoothstep(12.0,25.0,t)*0.48;
    col=mix(col,skyColor(rd),fog);
  }

  col=pow(1.0-exp(-max(col,0.0)*1.15),vec3(0.454545));
  outColor=vec4(col,1.0);
}`;

  let program = null;
  let vao = null;
  let uniforms = null;
  let lost = false;
  let disposed = false;
  let yaw = 0.52;
  let pitch = 0.18;
  let distance = 7.8;
  let lastTime = 0;

  function compile(type, source, label) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Pelican SDF could not allocate its " + label + " shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "unknown compiler error";
      gl.deleteShader(shader);
      throw new Error("Pelican SDF " + label + " shader compilation failed: " + log);
    }
    return shader;
  }

  function build() {
    const vs = compile(gl.VERTEX_SHADER, vertexSource, "vertex");
    let fs;
    try {
      fs = compile(gl.FRAGMENT_SHADER, fragmentSource, "fragment");
    } catch (error) {
      gl.deleteShader(vs);
      throw error;
    }
    const nextProgram = gl.createProgram();
    if (!nextProgram) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error("Pelican SDF could not allocate a WebGL program.");
    }
    gl.attachShader(nextProgram, vs);
    gl.attachShader(nextProgram, fs);
    gl.linkProgram(nextProgram);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(nextProgram) || "unknown linker error";
      gl.deleteProgram(nextProgram);
      throw new Error("Pelican SDF shader link failed: " + log);
    }
    const nextVao = gl.createVertexArray();
    if (!nextVao) {
      gl.deleteProgram(nextProgram);
      throw new Error("Pelican SDF could not allocate a vertex array.");
    }
    program = nextProgram;
    vao = nextVao;
    uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      time: gl.getUniformLocation(program, "uTime"),
      eye: gl.getUniformLocation(program, "uEye"),
      forward: gl.getUniformLocation(program, "uForward"),
      right: gl.getUniformLocation(program, "uRight"),
      up: gl.getUniformLocation(program, "uUp")
    };
  }

  build();

  const hadTabIndex = canvas.hasAttribute("tabindex");
  const oldTabIndex = canvas.getAttribute("tabindex");
  const oldTouchAction = canvas.style.touchAction;
  const oldUserSelect = canvas.style.userSelect;
  const oldCursor = canvas.style.cursor;
  canvas.tabIndex = 0;
  canvas.style.touchAction = "none";
  canvas.style.userSelect = "none";
  canvas.style.cursor = "grab";

  const points = new Map();
  let pinchSpan = 0;
  let pinchMid = null;
  const passiveFalse = { passive: false };

  function clampPitch(v) {
    return Math.max(-1.45, Math.min(1.45, v));
  }
  function clampDistance(v) {
    return Math.max(2.8, Math.min(18.0, v));
  }
  function redraw() {
    if (!disposed) render(lastTime);
  }
  function updatePinchReference() {
    if (points.size >= 2) {
      const a = Array.from(points.values());
      pinchSpan = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      pinchMid = [(a[0].x + a[1].x) * 0.5, (a[0].y + a[1].y) * 0.5];
    } else {
      pinchSpan = 0;
      pinchMid = null;
    }
  }
  function focusCanvas() {
    try {
      canvas.focus({ preventScroll: true });
    } catch (_) {
      canvas.focus();
    }
  }
  function pointerDown(e) {
    if (e.cancelable) e.preventDefault();
    focusCanvas();
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    canvas.style.cursor = "grabbing";
    updatePinchReference();
  }
  function pointerMove(e) {
    const old = points.get(e.pointerId);
    if (!old) return;
    if (e.cancelable) e.preventDefault();
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.size === 1) {
      yaw += (e.clientX - old.x) * 0.008;
      pitch = clampPitch(pitch - (e.clientY - old.y) * 0.008);
    } else {
      const a = Array.from(points.values());
      const span = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      const mx = (a[0].x + a[1].x) * 0.5;
      const my = (a[0].y + a[1].y) * 0.5;
      if (pinchSpan > 0.5 && span > 0.5) distance = clampDistance(distance * pinchSpan / span);
      if (pinchMid) {
        yaw += (mx - pinchMid[0]) * 0.0045;
        pitch = clampPitch(pitch - (my - pinchMid[1]) * 0.0045);
      }
      pinchSpan = span;
      pinchMid = [mx, my];
    }
    redraw();
  }
  function pointerEnd(e) {
    if (e.cancelable) e.preventDefault();
    points.delete(e.pointerId);
    try {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    canvas.style.cursor = points.size ? "grabbing" : "grab";
    updatePinchReference();
  }
  function wheel(e) {
    if (e.cancelable) e.preventDefault();
    focusCanvas();
    const scale = e.deltaMode === 1 ? 0.035 : e.deltaMode === 2 ? 0.28 : 0.0012;
    distance = clampDistance(distance * Math.exp(e.deltaY * scale));
    redraw();
  }
  function keyDown(e) {
    let handled = true;
    if (e.key === "ArrowLeft") yaw -= 0.11;
    else if (e.key === "ArrowRight") yaw += 0.11;
    else if (e.key === "ArrowUp") pitch = clampPitch(pitch + 0.085);
    else if (e.key === "ArrowDown") pitch = clampPitch(pitch - 0.085);
    else if (e.key === "+" || e.key === "=" || e.key === "Add") distance = clampDistance(distance * 0.88);
    else if (e.key === "-" || e.key === "_" || e.key === "Subtract") distance = clampDistance(distance / 0.88);
    else handled = false;
    if (handled) {
      e.preventDefault();
      redraw();
    }
  }
  function contextMenu(e) {
    e.preventDefault();
  }
  function contextLost(e) {
    e.preventDefault();
    lost = true;
    program = null;
    vao = null;
    uniforms = null;
  }
  function contextRestored() {
    if (disposed) return;
    lost = false;
    try {
      build();
      render(lastTime);
    } catch (_) {
      lost = true;
    }
  }

  canvas.addEventListener("pointerdown", pointerDown, passiveFalse);
  canvas.addEventListener("pointermove", pointerMove, passiveFalse);
  canvas.addEventListener("pointerup", pointerEnd, passiveFalse);
  canvas.addEventListener("pointercancel", pointerEnd, passiveFalse);
  canvas.addEventListener("lostpointercapture", pointerEnd, passiveFalse);
  canvas.addEventListener("wheel", wheel, passiveFalse);
  canvas.addEventListener("keydown", keyDown);
  canvas.addEventListener("contextmenu", contextMenu);
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", contextRestored);

  function render(timeSeconds) {
    if (disposed || lost || !program || gl.isContextLost()) return;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (width < 1 || height < 1) return;
    if (Number.isFinite(timeSeconds)) lastTime = timeSeconds;

    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const targetX = 0.0, targetY = 1.35, targetZ = 0.0;
    const eyeX = targetX + distance * sy * cp;
    const eyeY = targetY + distance * sp;
    const eyeZ = targetZ + distance * cy * cp;
    const forwardX = -sy * cp;
    const forwardY = -sp;
    const forwardZ = -cy * cp;
    const rightX = cy;
    const rightZ = -sy;
    const upX = -sy * sp;
    const upY = cp;
    const upZ = -cy * sp;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform1f(uniforms.time, lastTime);
    gl.uniform3f(uniforms.eye, eyeX, eyeY, eyeZ);
    gl.uniform3f(uniforms.forward, forwardX, forwardY, forwardZ);
    gl.uniform3f(uniforms.right, rightX, 0.0, rightZ);
    gl.uniform3f(uniforms.up, upX, upY, upZ);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setView(nextYaw, nextPitch, nextDistance) {
    if (Number.isFinite(nextYaw)) yaw = nextYaw;
    if (Number.isFinite(nextPitch)) pitch = clampPitch(nextPitch);
    if (Number.isFinite(nextDistance)) distance = clampDistance(nextDistance);
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    points.clear();
    canvas.removeEventListener("pointerdown", pointerDown, passiveFalse);
    canvas.removeEventListener("pointermove", pointerMove, passiveFalse);
    canvas.removeEventListener("pointerup", pointerEnd, passiveFalse);
    canvas.removeEventListener("pointercancel", pointerEnd, passiveFalse);
    canvas.removeEventListener("lostpointercapture", pointerEnd, passiveFalse);
    canvas.removeEventListener("wheel", wheel, passiveFalse);
    canvas.removeEventListener("keydown", keyDown);
    canvas.removeEventListener("contextmenu", contextMenu);
    canvas.removeEventListener("webglcontextlost", contextLost);
    canvas.removeEventListener("webglcontextrestored", contextRestored);
    canvas.style.touchAction = oldTouchAction;
    canvas.style.userSelect = oldUserSelect;
    canvas.style.cursor = oldCursor;
    if (hadTabIndex) canvas.setAttribute("tabindex", oldTabIndex);
    else canvas.removeAttribute("tabindex");
    if (!gl.isContextLost()) {
      gl.bindVertexArray(null);
      gl.useProgram(null);
      if (vao) gl.deleteVertexArray(vao);
      if (program) gl.deleteProgram(program);
    }
    vao = null;
    program = null;
    uniforms = null;
  }

  return { render, setView, getView, dispose };
}
