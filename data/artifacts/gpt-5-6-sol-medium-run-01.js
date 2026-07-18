export function createPelicanSdf(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("createPelicanSdf requires an HTMLCanvasElement");

  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  });
  if (!gl) throw new Error("WebGL2 is required for the pelican SDF artwork");

  const vsSource = `#version 300 es
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const fsSource = `#version 300 es
  precision highp float;
  out vec4 fragColor;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uCamera;
  uniform float uPitch;

  #define PI 3.14159265359

  float sdSphere(vec3 p, float r) { return length(p)-r; }

  float sdBox(vec3 p, vec3 b, float r) {
    vec3 q=abs(p)-b;
    return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r;
  }

  float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa=p-a, ba=b-a;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    return length(pa-ba*h)-r;
  }

  float sdEllipsoid(vec3 p, vec3 r) {
    float k0=length(p/r);
    float k1=max(length(p/(r*r)),0.0001);
    return k0*(k0-1.0)/k1;
  }

  float sdTorusZ(vec3 p, float majorR, float minorR) {
    return length(vec2(length(p.xy)-majorR,p.z))-minorR;
  }

  void put(inout vec2 h, float d, float m) {
    if(d<h.x) h=vec2(d,m);
  }

  vec2 scene(vec3 p) {
    vec2 h=vec2(p.y+0.035,10.0);

    float bikeBound=sdBox(p-vec3(0.0,1.08,0.0),vec3(2.55,1.31,0.88),0.05);
    if(bikeBound<h.x+0.28) {
      vec3 rear=vec3(-1.50,0.78,0.0);
      vec3 front=vec3(1.50,0.78,0.0);

      put(h,sdTorusZ(p-rear,0.76,0.095),1.0);
      put(h,sdTorusZ(p-front,0.76,0.095),1.0);
      put(h,sdTorusZ(p-rear,0.645,0.025),2.0);
      put(h,sdTorusZ(p-front,0.645,0.025),2.0);

      float spin=uTime*1.65;
      for(int i=0;i<3;i++) {
        float a=spin+float(i)*PI/3.0;
        vec3 v=vec3(cos(a),sin(a),0.0)*0.63;
        put(h,sdCapsule(p,rear-v,rear+v,0.014),2.0);
        put(h,sdCapsule(p,front-v,front+v,0.014),2.0);
      }
      put(h,sdCapsule(p,rear-vec3(0,0,.16),rear+vec3(0,0,.16),.075),2.0);
      put(h,sdCapsule(p,front-vec3(0,0,.16),front+vec3(0,0,.16),.075),2.0);

      vec3 crank=vec3(-0.02,0.84,0.0);
      vec3 seatJ=vec3(-0.62,1.55,0.0);
      vec3 headJ=vec3(0.91,1.52,0.0);
      put(h,sdCapsule(p,rear,seatJ,.055),3.0);
      put(h,sdCapsule(p,seatJ,crank,.062),3.0);
      put(h,sdCapsule(p,crank,rear,.060),3.0);
      put(h,sdCapsule(p,seatJ,headJ,.057),3.0);
      put(h,sdCapsule(p,headJ,crank,.060),3.0);
      put(h,sdCapsule(p,headJ+vec3(0,0,.17),front+vec3(0,0,.17),.038),2.0);
      put(h,sdCapsule(p,headJ-vec3(0,0,.17),front-vec3(0,0,.17),.038),2.0);
      put(h,sdCapsule(p,headJ,vec3(1.02,1.92,0),.045),2.0);
      put(h,sdCapsule(p,vec3(1.02,1.92,-.47),vec3(1.02,1.92,.47),.045),2.0);
      put(h,sdCapsule(p,vec3(1.02,1.92,-.59),vec3(1.02,1.92,-.39),.075),1.0);
      put(h,sdCapsule(p,vec3(1.02,1.92,.39),vec3(1.02,1.92,.59),.075),1.0);

      put(h,sdBox(p-vec3(-.64,1.67,0),vec3(.29,.065,.22),.06),1.0);
      put(h,sdCapsule(p,seatJ,vec3(-.64,1.66,0),.045),2.0);

      put(h,sdTorusZ(p-crank,.225,.025),2.0);
      float ca=uTime*1.4+.4;
      vec3 pv=vec3(cos(ca),sin(ca),0.0)*.22;
      vec3 pedalA=crank+pv;
      vec3 pedalB=crank-pv;
      put(h,sdCapsule(p,pedalA,pedalB,.025),2.0);
      put(h,sdCapsule(p,pedalA+vec3(-.13,0,-.30),pedalA+vec3(.13,0,.30),.035),2.0);
      put(h,sdCapsule(p,pedalB+vec3(-.13,0,.30),pedalB+vec3(.13,0,-.30),.035),2.0);
    }

    float birdBound=sdBox(p-vec3(.20,2.75,0),vec3(2.05,1.46,.88),.08);
    if(birdBound<h.x+0.28) {
      put(h,sdEllipsoid(p-vec3(-.31,2.35,0),vec3(.73,.80,.60)),4.0);
      put(h,sdEllipsoid(p-vec3(-.20,2.86,0),vec3(.43,.68,.43)),4.0);
      put(h,sdSphere(p-vec3(.02,3.35,0),.43),4.0);

      put(h,sdEllipsoid(p-vec3(-.34,2.43,.49),vec3(.62,.58,.17)),5.0);
      put(h,sdEllipsoid(p-vec3(-.34,2.43,-.49),vec3(.62,.58,.17)),5.0);
      put(h,sdCapsule(p,vec3(-.68,2.42,.50),vec3(-.15,2.20,.54),.12),5.0);
      put(h,sdCapsule(p,vec3(-.68,2.42,-.50),vec3(-.15,2.20,-.54),.12),5.0);

      put(h,sdCapsule(p,vec3(-.77,2.25,.14),vec3(-1.22,2.13,.12),.105),4.0);
      put(h,sdCapsule(p,vec3(-.77,2.22,-.13),vec3(-1.16,1.98,-.15),.095),5.0);

      put(h,sdEllipsoid(p-vec3(.87,3.35,0),vec3(1.04,.145,.19)),6.0);
      put(h,sdEllipsoid(p-vec3(.74,3.15,0),vec3(.78,.28,.20)),7.0);
      put(h,sdCapsule(p,vec3(.10,3.30,0),vec3(1.77,3.35,0),.075),6.0);

      put(h,sdSphere(p-vec3(.17,3.47,.365),.105),8.0);
      put(h,sdSphere(p-vec3(.17,3.47,-.365),.105),8.0);
      put(h,sdSphere(p-vec3(.195,3.48,.445),.047),9.0);
      put(h,sdSphere(p-vec3(.195,3.48,-.445),.047),9.0);

      float ca=uTime*1.4+.4;
      vec3 crank=vec3(-.02,.84,0);
      vec3 pv=vec3(cos(ca),sin(ca),0)*.22;
      vec3 footR=crank+pv+vec3(0,0,.30);
      vec3 footL=crank-pv+vec3(0,0,-.30);
      vec3 hipR=vec3(-.26,1.91,.25);
      vec3 hipL=vec3(-.46,1.94,-.25);
      vec3 kneeR=mix(hipR,footR,.52)+vec3(.34,.18,0);
      vec3 kneeL=mix(hipL,footL,.52)+vec3(-.30,.17,0);
      put(h,sdCapsule(p,hipR,kneeR,.095),7.0);
      put(h,sdCapsule(p,kneeR,footR,.080),7.0);
      put(h,sdCapsule(p,hipL,kneeL,.095),7.0);
      put(h,sdCapsule(p,kneeL,footL,.080),7.0);
      put(h,sdCapsule(p,footR+vec3(-.12,.02,0),footR+vec3(.20,.02,0),.070),7.0);
      put(h,sdCapsule(p,footL+vec3(-.12,.02,0),footL+vec3(.20,.02,0),.070),7.0);

      vec3 shoulderR=vec3(-.03,2.62,.34);
      vec3 elbowR=vec3(.47,2.35,.42);
      vec3 handR=vec3(1.03,1.94,.38);
      vec3 shoulderL=vec3(-.03,2.62,-.34);
      vec3 elbowL=vec3(.43,2.34,-.42);
      vec3 handL=vec3(1.03,1.94,-.38);
      put(h,sdCapsule(p,shoulderR,elbowR,.10),5.0);
      put(h,sdCapsule(p,elbowR,handR,.075),5.0);
      put(h,sdCapsule(p,shoulderL,elbowL,.10),5.0);
      put(h,sdCapsule(p,elbowL,handL,.075),5.0);
    }
    return h;
  }

  vec3 normalAt(vec3 p) {
    const vec2 e=vec2(.0015,0);
    return normalize(vec3(
      scene(p+e.xyy).x-scene(p-e.xyy).x,
      scene(p+e.yxy).x-scene(p-e.yxy).x,
      scene(p+e.yyx).x-scene(p-e.yyx).x
    ));
  }

  vec3 material(float m, vec3 p) {
    if(m<1.5) return vec3(.055,.065,.075);
    if(m<2.5) return vec3(.72,.76,.77);
    if(m<3.5) return vec3(.07,.43,.55);
    if(m<4.5) return vec3(.93,.94,.89);
    if(m<5.5) return vec3(.72,.76,.73);
    if(m<6.5) return vec3(1.0,.66,.12);
    if(m<7.5) return vec3(.93,.43,.08);
    if(m<8.5) return vec3(.96,.95,.82);
    if(m<9.5) return vec3(.025,.018,.012);
    float c=mod(floor(p.x*.8)+floor(p.z*.8),2.0);
    return mix(vec3(.25,.31,.34),vec3(.30,.37,.39),c);
  }

  void main() {
    vec2 q=(2.0*gl_FragCoord.xy-uResolution)/uResolution.y;
    float yaw=uCamera.x, dist=uCamera.z;
    vec3 target=vec3(0.02,2.06,0.0);
    vec3 ro=target+dist*vec3(sin(yaw)*cos(uPitch),sin(uPitch),cos(yaw)*cos(uPitch));
    vec3 fw=normalize(target-ro);
    vec3 rt=normalize(cross(fw,vec3(0,1,0)));
    vec3 up=cross(rt,fw);
    vec3 rd=normalize(fw+q.x*rt*.68+q.y*up*.68);

    float t=.03, id=-1.0;
    vec3 p=ro;
    for(int i=0;i<112;i++) {
      p=ro+rd*t;
      vec2 h=scene(p);
      if(h.x<.0012*(1.0+t*.08)) { id=h.y; break; }
      t+=max(h.x*.84,.001);
      if(t>24.0) break;
    }

    vec3 sky=mix(vec3(.78,.91,.96),vec3(.35,.67,.84),clamp(rd.y*.65+.35,0.0,1.0));
    float sun=pow(max(dot(rd,normalize(vec3(-.5,.55,-.7))),0.0),80.0);
    sky+=vec3(1.0,.82,.45)*sun*.45;

    if(id<0.0) {
      fragColor=vec4(sky,1);
      return;
    }

    vec3 n=normalAt(p);
    vec3 light=normalize(vec3(-.45,.78,.38));
    float diff=max(dot(n,light),0.0);
    float hemi=.48+.35*n.y;
    float rim=pow(1.0-max(dot(n,-rd),0.0),3.0);
    float ao=1.0;
    ao-=max(.035-scene(p+n*.035).x,0.0)*4.0;
    ao-=max(.095-scene(p+n*.095).x,0.0)*1.35;
    ao=clamp(ao,.58,1.0);

    vec3 base=material(id,p);
    vec3 halfv=normalize(light-rd);
    float spec=pow(max(dot(n,halfv),0.0),32.0);
    float metal=step(1.5,id)*(1.0-step(3.5,id));
    vec3 col=base*(hemi+diff*.67)*ao;
    col+=spec*(.12+metal*.38);
    col+=rim*vec3(.20,.31,.36)*.28;
    float fog=1.0-exp(-.012*t*t);
    col=mix(col,sky,fog);
    col=pow(max(col,0.0),vec3(.4545));
    fragColor=vec4(col,1);
  }`;

  let program = null;
  let vao = null;
  let uniforms = null;
  let lost = false;
  let disposed = false;
  let yaw = -0.62;
  let pitch = 0.16;
  let distance = 7.15;
  let lastTime = 0;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "unknown shader error";
      gl.deleteShader(shader);
      throw new Error("Pelican SDF shader compilation failed: " + message);
    }
    return shader;
  }

  function initialize() {
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
      throw new Error("Pelican SDF shader linking failed: " + message);
    }
    program = next;
    vao = gl.createVertexArray();
    uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      time: gl.getUniformLocation(program, "uTime"),
      camera: gl.getUniformLocation(program, "uCamera"),
      pitch: gl.getUniformLocation(program, "uPitch")
    };
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  initialize();

  function render(timeSeconds) {
    if (disposed || lost || gl.isContextLost()) return;
    lastTime = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(uniforms.resolution, Math.max(canvas.width, 1), Math.max(canvas.height, 1));
    gl.uniform1f(uniforms.time, lastTime);
    gl.uniform3f(uniforms.camera, yaw, 0, distance);
    gl.uniform1f(uniforms.pitch, pitch);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function redraw() {
    render(lastTime);
  }

  function setView(nextYaw, nextPitch, nextDistance) {
    if (Number.isFinite(nextYaw)) yaw = nextYaw;
    if (Number.isFinite(nextPitch)) pitch = Math.max(-1.38, Math.min(1.38, nextPitch));
    if (Number.isFinite(nextDistance)) distance = Math.max(3.15, Math.min(14.0, nextDistance));
  }

  const previousTabIndex = canvas.getAttribute("tabindex");
  const previousTouchAction = canvas.style.touchAction;
  canvas.tabIndex = previousTabIndex === null ? 0 : canvas.tabIndex;
  canvas.style.touchAction = "none";

  const pointers = new Map();
  let pinchDistance = 0;

  function pointerDown(e) {
    if (disposed) return;
    canvas.focus({preventScroll:true});
    pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (pointers.size === 2) {
      const a=[...pointers.values()];
      pinchDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    }
    e.preventDefault();
  }

  function pointerMove(e) {
    const old=pointers.get(e.pointerId);
    if (!old) return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if (pointers.size === 1) {
      yaw -= (e.clientX-old.x)*0.008;
      pitch=Math.max(-1.38,Math.min(1.38,pitch+(e.clientY-old.y)*0.007));
    } else if (pointers.size === 2) {
      const a=[...pointers.values()];
      const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      if (pinchDistance>2 && d>2) distance=Math.max(3.15,Math.min(14,distance*pinchDistance/d));
      pinchDistance=d;
    }
    redraw();
    e.preventDefault();
  }

  function pointerUp(e) {
    pointers.delete(e.pointerId);
    pinchDistance=0;
    if (pointers.size===2) {
      const a=[...pointers.values()];
      pinchDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    }
    e.preventDefault();
  }

  function wheel(e) {
    distance=Math.max(3.15,Math.min(14,distance*Math.exp(e.deltaY*.0011)));
    redraw();
    e.preventDefault();
  }

  function keyDown(e) {
    let used=true;
    if(e.key==="ArrowLeft") yaw-=.10;
    else if(e.key==="ArrowRight") yaw+=.10;
    else if(e.key==="ArrowUp") pitch=Math.max(-1.38,pitch-.08);
    else if(e.key==="ArrowDown") pitch=Math.min(1.38,pitch+.08);
    else if(e.key==="+" || e.key==="=" || e.key==="Add") distance=Math.max(3.15,distance*.90);
    else if(e.key==="-" || e.key==="_" || e.key==="Subtract") distance=Math.min(14,distance*1.11);
    else used=false;
    if(used) {
      redraw();
      e.preventDefault();
    }
  }

  function contextLost(e) {
    e.preventDefault();
    lost=true;
  }

  function contextRestored() {
    if(disposed) return;
    try {
      initialize();
      lost=false;
      redraw();
    } catch (_) {
      lost=true;
    }
  }

  canvas.addEventListener("pointerdown",pointerDown);
  canvas.addEventListener("pointermove",pointerMove);
  canvas.addEventListener("pointerup",pointerUp);
  canvas.addEventListener("pointercancel",pointerUp);
  canvas.addEventListener("wheel",wheel,{passive:false});
  canvas.addEventListener("keydown",keyDown);
  canvas.addEventListener("webglcontextlost",contextLost,false);
  canvas.addEventListener("webglcontextrestored",contextRestored,false);

  return {
    render,
    setView,
    getView() {
      return {yaw,pitch,distance};
    },
    dispose() {
      if(disposed) return;
      disposed=true;
      pointers.clear();
      canvas.removeEventListener("pointerdown",pointerDown);
      canvas.removeEventListener("pointermove",pointerMove);
      canvas.removeEventListener("pointerup",pointerUp);
      canvas.removeEventListener("pointercancel",pointerUp);
      canvas.removeEventListener("wheel",wheel);
      canvas.removeEventListener("keydown",keyDown);
      canvas.removeEventListener("webglcontextlost",contextLost);
      canvas.removeEventListener("webglcontextrestored",contextRestored);
      canvas.style.touchAction=previousTouchAction;
      if(previousTabIndex===null) canvas.removeAttribute("tabindex");
      else canvas.setAttribute("tabindex",previousTabIndex);
      if(!gl.isContextLost()) {
        if(vao) gl.deleteVertexArray(vao);
        if(program) gl.deleteProgram(program);
      }
      vao=null;
      program=null;
      uniforms=null;
    }
  };
}
