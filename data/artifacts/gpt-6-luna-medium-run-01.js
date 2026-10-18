export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error("Pelican SDF requires WebGL2.");
  canvas.tabIndex = canvas.tabIndex < 0 ? 0 : canvas.tabIndex;
  canvas.style.touchAction = "none";

  const vs = `#version 300 es
  in vec2 p;
  void main(){gl_Position=vec4(p,0.,1.);}`;

  const fs = `#version 300 es
  precision highp float;
  precision highp int;
  out vec4 outColor;
  uniform vec2 resolution;
  uniform float time;
  uniform vec3 camera;
  uniform float yaw;
  uniform float pitch;
  uniform float distance;

  vec2 uni(vec2 a, vec2 b){return a.x<b.x?a:b;}
  float sdSphere(vec3 p,float r){return length(p)-r;}
  float sdEllipsoid(vec3 p,vec3 r){
    float k0=length(p/r), k1=length(p/(r*r));
    return k0*(k0-1.)/max(k1,1e-5);
  }
  float sdCapsule(vec3 p,vec3 a,vec3 b,float r){
    vec3 pa=p-a, ba=b-a;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
    return length(pa-ba*h)-r;
  }
  float sdCylinder(vec3 p,vec3 a,vec3 b,float r){
    vec3 ba=b-a, pa=p-a;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
    return length(pa-ba*h)-r;
  }
  float sdTorusY(vec3 p,float majorR,float minorR){
    return length(vec2(length(p.xz)-majorR,p.y))-minorR;
  }
  float sdBox(vec3 p,vec3 b){
    vec3 q=abs(p)-b;
    return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);
  }
  vec2 part(float d,float m){return vec2(d,m);}

  vec2 scene(vec3 p){
    vec2 h=vec2(99.,0.);
    // Wheels: the torus axis is the bicycle's width axis.
    for(int w=0;w<2;w++){
      float x=w==0?-1.15:1.15;
      vec3 q=p-vec3(x,.67,0.);
      h=uni(h,part(sdTorusY(q,.61,.075),1.));
      h=uni(h,part(sdCylinder(q,vec3(0.,-.13,0.),vec3(0.,.13,0.),.075),2.));
      // Hub-to-rim spokes in the wheel plane.
      for(int i=0;i<10;i++){
        float a=6.2831853*float(i)/10.;
        vec3 end=vec3(.57*cos(a),0.,.57*sin(a));
        h=uni(h,part(sdCapsule(q,vec3(0.),end,.012),3.));
      }
    }
    // Connected bicycle frame, rear hub, crank, seat post and fork.
    h=uni(h,part(sdCapsule(p,vec3(-1.15,.67,0.),vec3(-.22,.70,0.),.045),4.));
    h=uni(h,part(sdCapsule(p,vec3(-.22,.70,0.),vec3(-.63,1.36,0.),.045),4.));
    h=uni(h,part(sdCapsule(p,vec3(-1.15,.67,0.),vec3(-.63,1.36,0.),.045),4.));
    h=uni(h,part(sdCapsule(p,vec3(-.63,1.36,0.),vec3(.40,1.30,0.),.048),4.));
    h=uni(h,part(sdCapsule(p,vec3(.40,1.30,0.),vec3(-.22,.70,0.),.045),4.));
    h=uni(h,part(sdCapsule(p,vec3(.40,1.30,0.),vec3(1.15,.67,0.),.045),4.));
    h=uni(h,part(sdCapsule(p,vec3(-.72,1.42,0.),vec3(-.53,1.42,0.),.085),5.));
    h=uni(h,part(sdCapsule(p,vec3(-.63,1.35,0.),vec3(-.72,1.44,0.),.045),4.));
    h=uni(h,part(sdCapsule(p,vec3(.40,1.30,0.),vec3(.48,1.58,0.),.045),4.));
    h=uni(h,part(sdCapsule(p,vec3(.48,1.58,0.),vec3(.75,1.59,0.),.045),4.));
    h=uni(h,part(sdCapsule(p,vec3(.48,1.58,0.),vec3(.31,1.67,0.),.045),4.));
    // Crank and pedals.
    h=uni(h,part(sdCylinder(p,vec3(-.22,.58,-.10),vec3(-.22,.58,.10),.07),5.));
    h=uni(h,part(sdCapsule(p,vec3(-.22,.58,0.),vec3(-.02,.45,0.),.035),5.));
    h=uni(h,part(sdCapsule(p,vec3(-.22,.58,0.),vec3(-.42,.71,0.),.035),5.));
    h=uni(h,part(sdBox(p-vec3(-.02,.45,0.),vec3(.13,.035,.10)),5.));
    h=uni(h,part(sdBox(p-vec3(-.42,.71,0.),vec3(.13,.035,.10)),5.));
    // Pelican torso, neck, head, beak and hanging pouch.
    h=uni(h,part(sdEllipsoid(p-vec3(-.05,1.78,0.),vec3(.55,.34,.34)),6.));
    h=uni(h,part(sdEllipsoid(p-vec3(.30,2.08,0.),vec3(.21,.48,.20)),6.));
    h=uni(h,part(sdEllipsoid(p-vec3(.45,2.46,0.),vec3(.31,.29,.28)),6.));
    h=uni(h,part(sdCapsule(p,vec3(.62,2.42,0.),vec3(1.30,2.34,0.),.075),7.));
    h=uni(h,part(sdEllipsoid(p-vec3(.91,2.18,0.),vec3(.36,.23,.19)),8.));
    // Far-side eye plus near-side eye.
    h=uni(h,part(sdSphere(length((p-vec3(.55,2.53,0.))*vec3(1.4,1.2,1.0))-.035,.025),9.));
    h=uni(h,part(sdSphere(length((p-vec3(.55,2.53,.265))*vec3(1.4,1.2,1.0))-.035,.025),9.));
    // Wings, with a few sculpted feather lobes.
    h=uni(h,part(sdEllipsoid(p-vec3(-.10,1.82,.29),vec3(.39,.20,.10)),10.));
    h=uni(h,part(sdEllipsoid(p-vec3(-.29,1.72,.34),vec3(.22,.105,.075)),11.));
    h=uni(h,part(sdEllipsoid(p-vec3(-.05,1.70,.35),vec3(.23,.10,.075)),11.));
    h=uni(h,part(sdEllipsoid(p-vec3(.17,1.75,.33),vec3(.17,.09,.07)),11.));
    h=uni(h,part(sdEllipsoid(p-vec3(-.10,1.82,-.29),vec3(.39,.20,.10)),10.));
    // Two bent legs and feet posed on the pedals.
    h=uni(h,part(sdCapsule(p,vec3(-.17,1.49,.18),vec3(-.22,1.02,.19),.065),12.));
    h=uni(h,part(sdCapsule(p,vec3(-.22,1.02,.19),vec3(-.42,.71,.19),.052),12.));
    h=uni(h,part(sdCapsule(p,vec3(-.17,1.49,-.18),vec3(-.22,1.02,-.19),.065),12.));
    h=uni(h,part(sdCapsule(p,vec3(-.22,1.02,-.19),vec3(-.42,.71,-.19),.052),12.));
    h=uni(h,part(sdCapsule(p,vec3(-.42,.71,.19),vec3(-.28,.70,.19),.065),13.));
    h=uni(h,part(sdCapsule(p,vec3(-.42,.71,-.19),vec3(-.28,.70,-.19),.065),13.));
    return h;
  }

  vec3 normalAt(vec3 p){
    vec2 e=vec2(.0015,0.);
    return normalize(vec3(
      scene(p+e.xyy).x-scene(p-e.xyy).x,
      scene(p+e.yxy).x-scene(p-e.yxy).x,
      scene(p+e.yyx).x-scene(p-e.yyx).x));
  }
  vec3 material(float id){
    if(id<1.5)return vec3(.055,.075,.085);
    if(id<2.5)return vec3(.48,.31,.14);
    if(id<3.5)return vec3(.72,.72,.66);
    if(id<4.5)return vec3(.12,.37,.52);
    if(id<5.5)return vec3(.20,.13,.09);
    if(id<6.5)return vec3(.94,.84,.62);
    if(id<7.5)return vec3(.96,.48,.07);
    if(id<8.5)return vec3(.94,.28,.10);
    if(id<9.5)return vec3(.025,.025,.02);
    if(id<10.5)return vec3(.85,.71,.47);
    if(id<11.5)return vec3(.72,.52,.29);
    if(id<12.5)return vec3(.94,.50,.08);
    return vec3(.97,.42,.045);
  }
  float shadow(vec3 ro,vec3 rd,float mint,float maxt){
    float res=1.,t=mint;
    for(int i=0;i<28;i++){
      float d=scene(ro+rd*t).x;
      res=min(res,12.*d/max(t,.02));
      t+=clamp(d,.025,.22);
      if(d<.003||t>maxt)break;
    }
    return clamp(res,0.,1.);
  }
  float ao(vec3 p,vec3 n){
    float sum=0.,weight=1.;
    for(int i=1;i<=4;i++){
      float d=float(i)*.075;
      sum+=weight*(d-scene(p+n*d).x);
      weight*=.55;
    }
    return clamp(1.-1.8*sum,0.,1.);
  }
  void main(){
    vec2 uv=(2.*gl_FragCoord.xy-resolution)/resolution.y;
    vec3 target=vec3(0.,1.38,0.);
    float cy=cos(yaw),sy=sin(yaw),cp=cos(pitch),sp=sin(pitch);
    vec3 ro=target+distance*vec3(sy*cp,sp,cy*cp);
    vec3 ww=normalize(target-ro), uu=normalize(cross(ww,vec3(0.,1.,0.)));
    vec3 vv=cross(uu,ww);
    vec3 rd=normalize(uu*uv.x+vv*uv.y+ww*1.65);
    vec3 sky=mix(vec3(.62,.78,.86),vec3(.91,.87,.74),clamp(uv.y*.55+.48,0.,1.));
    float t=0.;vec2 hit=vec2(0.);bool found=false;
    for(int i=0;i<104;i++){
      vec3 pos=ro+rd*t;
      hit=scene(pos);
      if(hit.x<.0015){found=true;break;}
      t+=max(hit.x*.82,.002);
      if(t>18.)break;
    }
    vec3 col=sky;
    if(found){
      vec3 pos=ro+rd*t,n=normalAt(pos);
      vec3 light=normalize(vec3(-.55,.82,.50));
      float diff=max(dot(n,light),0.);
      float sh=shadow(pos+n*.006,light,.015,5.);
      float occ=ao(pos,n);
      vec3 base=material(hit.y);
      float spec=pow(max(dot(reflect(-light,n),-rd),0.),30.)*.22;
      col=base*(.24+.76*diff*sh)*occ+spec;
      float fog=1.-exp(-.012*t*t);
      col=mix(col,sky,fog);
    }
    col=pow(max(col,0.),vec3(.94));
    outColor=vec4(col,1.);
  }`;

  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error("Pelican SDF shader compilation failed: " + message);
    }
    return s;
  }

  let program, buffer, vao, lost = false, disposed = false;
  try {
    const v = shader(gl.VERTEX_SHADER, vs), f = shader(gl.FRAGMENT_SHADER, fs);
    program = gl.createProgram();
    gl.attachShader(program, v); gl.attachShader(program, f); gl.linkProgram(program);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Pelican SDF shader link failed: " + gl.getProgramInfoLog(program));
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  } catch (e) {
    if (program) gl.deleteProgram(program);
    throw e;
  }

  const uniforms = {
    resolution: gl.getUniformLocation(program, "resolution"),
    time: gl.getUniformLocation(program, "time"),
    camera: gl.getUniformLocation(program, "camera"),
    yaw: gl.getUniformLocation(program, "yaw"),
    pitch: gl.getUniformLocation(program, "pitch"),
    distance: gl.getUniformLocation(program, "distance")
  };
  let view = { yaw: .48, pitch: .18, distance: 6.2 };
  let dragging = false, lastX = 0, lastY = 0;
  const activePointers = new Map();
  let pinchStart = 0, pinchDistance = 0;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pointerDown = e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    activePointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (activePointers.size === 2) {
      const pts = [...activePointers.values()];
      pinchStart = Math.hypot(pts[0][0]-pts[1][0], pts[0][1]-pts[1][1]);
      pinchDistance = view.distance;
    }
    canvas.focus({ preventScroll: true });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  };
  const pointerMove = e => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (activePointers.size >= 2) {
      const pts = [...activePointers.values()];
      const d = Math.hypot(pts[0][0]-pts[1][0], pts[0][1]-pts[1][1]);
      if (pinchStart > 0) view.distance = clamp(pinchDistance * pinchStart / Math.max(d, 1), 3.0, 11.5);
    } else if (dragging) {
      view.yaw -= (e.clientX-lastX)*.008;
      view.pitch = clamp(view.pitch+(e.clientY-lastY)*.008, -1.15, 1.15);
    }
    lastX=e.clientX; lastY=e.clientY;
    e.preventDefault();
  };
  const pointerUp = e => {
    activePointers.delete(e.pointerId);
    dragging = activePointers.size > 0;
    if (dragging) {
      const p = [...activePointers.values()][0];
      lastX=p[0]; lastY=p[1];
    }
    e.preventDefault();
  };
  const wheel = e => {
    view.distance = clamp(view.distance * Math.exp(e.deltaY*.001), 3.0, 11.5);
    e.preventDefault();
  };
  const key = e => {
    let changed = true;
    if (e.key === "ArrowLeft") view.yaw -= .08;
    else if (e.key === "ArrowRight") view.yaw += .08;
    else if (e.key === "ArrowUp") view.pitch = clamp(view.pitch+.06,-1.15,1.15);
    else if (e.key === "ArrowDown") view.pitch = clamp(view.pitch-.06,-1.15,1.15);
    else if (e.key === "+" || e.key === "=") view.distance=clamp(view.distance*.9,3,11.5);
    else if (e.key === "-" || e.key === "_") view.distance=clamp(view.distance*1.1,3,11.5);
    else changed=false;
    if (changed) e.preventDefault();
  };
  const lostHandler = e => { e.preventDefault(); lost=true; };
  const restoredHandler = () => { lost=true; };
  canvas.addEventListener("pointerdown",pointerDown);
  canvas.addEventListener("pointermove",pointerMove);
  canvas.addEventListener("pointerup",pointerUp);
  canvas.addEventListener("pointercancel",pointerUp);
  canvas.addEventListener("wheel",wheel,{passive:false});
  canvas.addEventListener("keydown",key);
  canvas.addEventListener("webglcontextlost",lostHandler,false);
  canvas.addEventListener("webglcontextrestored",restoredHandler,false);

  return {
    render(timeSeconds) {
      if (disposed || gl.isContextLost()) { lost=true; return; }
      if (lost) return;
      gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
      gl.useProgram(program); gl.bindVertexArray(vao);
      gl.uniform2f(uniforms.resolution,gl.drawingBufferWidth,gl.drawingBufferHeight);
      gl.uniform1f(uniforms.time,Number.isFinite(timeSeconds)?timeSeconds:0);
      gl.uniform3f(uniforms.camera,0,0,0);
      gl.uniform1f(uniforms.yaw,view.yaw);
      gl.uniform1f(uniforms.pitch,view.pitch);
      gl.uniform1f(uniforms.distance,view.distance);
      gl.drawArrays(gl.TRIANGLES,0,6);
    },
    setView(yaw,pitch,distance) {
      view.yaw=Number.isFinite(yaw)?yaw:0;
      view.pitch=clamp(Number.isFinite(pitch)?pitch:0,-1.15,1.15);
      view.distance=clamp(Number.isFinite(distance)?distance:6.2,3,11.5);
    },
    getView() { return {yaw:view.yaw,pitch:view.pitch,distance:view.distance}; },
    dispose() {
      if(disposed)return;
      disposed=true;
      canvas.removeEventListener("pointerdown",pointerDown);
      canvas.removeEventListener("pointermove",pointerMove);
      canvas.removeEventListener("pointerup",pointerUp);
      canvas.removeEventListener("pointercancel",pointerUp);
      canvas.removeEventListener("wheel",wheel);
      canvas.removeEventListener("keydown",key);
      canvas.removeEventListener("webglcontextlost",lostHandler);
      canvas.removeEventListener("webglcontextrestored",restoredHandler);
      if(!gl.isContextLost()){gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.deleteProgram(program);}
    }
  };
}
