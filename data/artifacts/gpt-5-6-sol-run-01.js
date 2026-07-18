export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false
  });
  if (!gl) throw new Error("WebGL2 is required to render the pelican SDF artwork.");

  const vertexSource = `#version 300 es
  in vec2 a;
  out vec2 v;
  void main(){
    v=a;
    gl_Position=vec4(a,0.0,1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  out vec4 O;
  in vec2 v;
  uniform vec2 R;
  uniform float T;
  uniform vec3 E,C;

  #define PI 3.14159265359

  float sph(vec3 p,float r){return length(p)-r;}
  float ell(vec3 p,vec3 r){return (length(p/r)-1.0)*min(r.x,min(r.y,r.z));}
  float box3(vec3 p,vec3 b,float r){
    vec3 q=abs(p)-b;
    return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r;
  }
  float cap(vec3 p,vec3 a,vec3 b,float r){
    vec3 pa=p-a,ba=b-a;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    return length(pa-ba*h)-r;
  }
  float torZ(vec3 p,float r,float t){
    return length(vec2(length(p.xy)-r,p.z))-t;
  }
  float torY(vec3 p,float r,float t){
    return length(vec2(length(p.xz)-r,p.y))-t;
  }
  vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
  vec2 S(vec2 a,vec2 b,float k){
    float h=clamp(.5+.5*(b.x-a.x)/k,0.0,1.0);
    return vec2(mix(b.x,a.x,h)-k*h*(1.0-h),h>.5?a.y:b.y);
  }
  vec2 ob(float d,float m){return vec2(d,m);}

  vec2 scene(vec3 p){
    vec2 q=vec2(99.0,0.0);
    const float wy=.78, wr=.72;

    q=U(q,ob(torZ(p-vec3(-1.48,wy,0),wr,.105),1.0));
    q=U(q,ob(torZ(p-vec3( 1.48,wy,0),wr,.105),1.0));
    q=U(q,ob(torZ(p-vec3(-1.48,wy,0),wr,.035),10.0));
    q=U(q,ob(torZ(p-vec3( 1.48,wy,0),wr,.035),10.0));

    for(int j=0;j<2;j++){
      float x=j==0?-1.48:1.48;
      for(int i=0;i<8;i++){
        float a=float(i)*PI/8.0;
        vec3 d=vec3(cos(a),sin(a),0.0)*wr;
        q=U(q,ob(cap(p,vec3(x,wy,-.025)-d,vec3(x,wy,-.025)+d,.018),10.0));
      }
      q=U(q,ob(cap(p,vec3(x,wy,-.16),vec3(x,wy,.16),.07),8.0));
    }

    vec3 rear=vec3(-1.48,wy,0), crank=vec3(-.18,.82,0);
    vec3 seat=vec3(-.55,1.72,0), neck=vec3(.86,1.72,0);
    q=U(q,ob(cap(p,rear,crank,.065),2.0));
    q=U(q,ob(cap(p,crank,neck,.065),2.0));
    q=U(q,ob(cap(p,rear,seat,.065),2.0));
    q=U(q,ob(cap(p,seat,crank,.065),2.0));
    q=U(q,ob(cap(p,seat,neck,.065),2.0));
    q=U(q,ob(cap(p,neck,vec3(1.48,wy,0),.06),7.0));
    q=U(q,ob(cap(p,neck,vec3(1.39,1.96,0),.055),7.0));
    q=U(q,ob(cap(p,vec3(1.39,1.96,0),vec3(1.48,wy,0),.055),7.0));

    q=U(q,ob(cap(p,seat-vec3(0,.15,0),seat+vec3(0,.14,0),.055),8.0));
    q=U(q,ob(ell(p-vec3(-.64,1.88,0),vec3(.38,.095,.22)),3.0));

    q=U(q,ob(cap(p,vec3(1.39,1.96,0),vec3(1.47,2.22,0),.045),8.0));
    q=U(q,ob(cap(p,vec3(1.47,2.22,-.42),vec3(1.47,2.22,.42),.045),8.0));
    q=U(q,ob(cap(p,vec3(1.47,2.22,-.42),vec3(1.36,2.16,-.48),.04),8.0));
    q=U(q,ob(cap(p,vec3(1.47,2.22,.42),vec3(1.36,2.16,.48),.04),8.0));

    float ca=sin(T*.8)*.45-.45;
    vec3 cp=crank+vec3(cos(ca),sin(ca),0)*.25;
    vec3 cm=crank-vec3(cos(ca),sin(ca),0)*.25;
    q=U(q,ob(torZ(p-crank,.19,.035),8.0));
    q=U(q,ob(cap(p,crank,cp,.035),8.0));
    q=U(q,ob(cap(p,crank,cm,.035),8.0));
    q=U(q,ob(cap(p,cp+vec3(0,0,-.18),cp+vec3(0,0,.18),.045),3.0));
    q=U(q,ob(cap(p,cm+vec3(0,0,-.18),cm+vec3(0,0,.18),.045),3.0));

    vec2 bird=ob(ell(p-vec3(-.25,2.42,0),vec3(.83,.72,.58)),4.0);
    bird=S(bird,ob(ell(p-vec3(.29,2.88,0),vec3(.42,.62,.39)),4.0),.22);
    bird=S(bird,ob(sph(p-vec3(.48,3.34,0),.43),4.0),.16);
    q=U(q,bird);

    q=U(q,ob(ell(p-vec3(-.39,2.46,.48),vec3(.69,.48,.16)),5.0));
    q=U(q,ob(ell(p-vec3(-.39,2.46,-.48),vec3(.69,.48,.16)),5.0));
    q=U(q,ob(cap(p,vec3(-.78,2.42,.51),vec3(-1.03,2.16,.35),.16),5.0));
    q=U(q,ob(cap(p,vec3(-.78,2.42,-.51),vec3(-1.03,2.16,-.35),.16),5.0));

    q=U(q,ob(ell(p-vec3(1.18,3.38,0),vec3(.95,.16,.25)),6.0));
    q=U(q,ob(ell(p-vec3(1.12,3.18,0),vec3(.76,.27,.28)),12.0));
    q=U(q,ob(cap(p,vec3(.56,3.27,0),vec3(1.82,3.31,0),.075),6.0));
    q=U(q,ob(sph(p-vec3(1.91,3.31,0),.09),6.0));

    q=U(q,ob(sph(p-vec3(.65,3.48,.365),.075),9.0));
    q=U(q,ob(sph(p-vec3(.65,3.48,-.365),.075),9.0));
    q=U(q,ob(sph(p-vec3(.67,3.49,.422),.026),11.0));
    q=U(q,ob(sph(p-vec3(.67,3.49,-.422),.026),11.0));

    vec3 hip1=vec3(-.25,2.03,.25), knee1=vec3(-.08,1.52,.26);
    vec3 hip2=vec3(-.33,2.02,-.25), knee2=vec3(-.52,1.50,-.25);
    vec3 foot1=cp+vec3(0,.08,.18), foot2=cm+vec3(0,.08,-.18);
    q=U(q,ob(cap(p,hip1,knee1,.105),12.0));
    q=U(q,ob(cap(p,knee1,foot1,.085),12.0));
    q=U(q,ob(cap(p,hip2,knee2,.105),12.0));
    q=U(q,ob(cap(p,knee2,foot2,.085),12.0));
    q=U(q,ob(cap(p,foot1-vec3(.17,0,0),foot1+vec3(.19,0,0),.075),6.0));
    q=U(q,ob(cap(p,foot2-vec3(.17,0,0),foot2+vec3(.19,0,0),.075),6.0));

    q=U(q,ob(cap(p,vec3(.18,2.65,.34),vec3(.76,2.25,.43),.105),4.0));
    q=U(q,ob(cap(p,vec3(.76,2.25,.43),vec3(1.34,2.16,.47),.075),12.0));
    q=U(q,ob(cap(p,vec3(.18,2.65,-.34),vec3(.76,2.25,-.43),.105),4.0));
    q=U(q,ob(cap(p,vec3(.76,2.25,-.43),vec3(1.34,2.16,-.47),.075),12.0));

    return q;
  }

  vec3 normalAt(vec3 p){
    const float e=.0015;
    vec2 h=vec2(1,-1)*e;
    return normalize(
      h.xyy*scene(p+h.xyy).x+
      h.yyx*scene(p+h.yyx).x+
      h.yxy*scene(p+h.yxy).x+
      h.xxx*scene(p+h.xxx).x
    );
  }

  vec3 material(float m){
    if(m<1.5)return vec3(.045,.052,.06);
    if(m<2.5)return vec3(.08,.42,.58);
    if(m<3.5)return vec3(.22,.11,.065);
    if(m<4.5)return vec3(.94,.91,.79);
    if(m<5.5)return vec3(.70,.75,.77);
    if(m<6.5)return vec3(.97,.56,.12);
    if(m<7.5)return vec3(.76,.13,.10);
    if(m<8.5)return vec3(.20,.22,.24);
    if(m<9.5)return vec3(.055,.045,.035);
    if(m<10.5)return vec3(.68,.71,.72);
    if(m<11.5)return vec3(.95,.95,.82);
    return vec3(.95,.64,.25);
  }

  float shadow(vec3 p,vec3 l){
    float r=1.0,t=.035;
    for(int i=0;i<18;i++){
      float h=scene(p+l*t).x;
      r=min(r,12.0*h/t);
      t+=clamp(h,.025,.22);
      if(h<.001||t>5.0)break;
    }
    return clamp(r,.18,1.0);
  }

  void main(){
    vec2 uv=v;
    uv.x*=R.x/R.y;
    vec3 f=normalize(C-E);
    vec3 rt=normalize(cross(f,vec3(0,1,0)));
    vec3 up=cross(rt,f);
    vec3 rd=normalize(f+uv.x*rt*.72+uv.y*up*.72);
    vec3 ro=E;

    vec3 bg=mix(vec3(.74,.89,.96),vec3(.94,.97,.94),clamp(rd.y*.65+.45,0.0,1.0));
    float sun=pow(max(dot(rd,normalize(vec3(-.45,.72,-.4))),0.0),180.0);
    bg+=vec3(1.0,.8,.48)*sun*.8;

    float b=dot(ro-vec3(0,1.75,0),rd);
    float c=dot(ro-vec3(0,1.75,0),ro-vec3(0,1.75,0))-11.8;
    float disc=b*b-c;
    float nearT=0.0,farT=20.0;
    if(disc>0.0){
      float s=sqrt(disc);
      nearT=max(0.0,-b-s);
      farT=-b+s;
    }else farT=0.0;

    float t=nearT,id=0.0,d=1.0;
    bool hit=false;
    for(int i=0;i<112;i++){
      if(t>farT)break;
      vec2 h=scene(ro+rd*t);
      d=h.x; id=h.y;
      if(d<.0015){hit=true;break;}
      t+=max(d*.78,.003);
    }

    float tg=1e5;
    if(rd.y<-.0001)tg=(-.015-ro.y)/rd.y;
    bool ground=tg>0.0 && (!hit||tg<t);

    vec3 col=bg;
    if(ground){
      vec3 p=ro+rd*tg;
      float fade=exp(-.045*dot(p.xz,p.xz));
      float grid=abs(fract(p.x*.5)-.5)+abs(fract(p.z*.5)-.5);
      vec3 gc=mix(vec3(.66,.73,.68),vec3(.75,.80,.73),smoothstep(.03,.08,grid));
      float sh=shadow(p+vec3(0,.015,0),normalize(vec3(-.45,.75,-.35)));
      col=mix(bg,gc*(.65+.35*sh),fade);
    }else if(hit){
      vec3 p=ro+rd*t;
      vec3 n=normalAt(p);
      vec3 l=normalize(vec3(-.45,.75,-.35));
      float dif=max(dot(n,l),0.0);
      float sh=shadow(p+n*.008,l);
      float hemi=.45+.28*n.y;
      vec3 base=material(id);
      vec3 h=normalize(l-rd);
      float spec=pow(max(dot(n,h),0.0),id==8.0||id==10.0?70.0:32.0);
      float rim=pow(1.0-max(dot(n,-rd),0.0),3.0);
      col=base*(hemi+dif*.72*sh)+spec*.35*sh+rim*vec3(.18,.25,.28);
      float fog=1.0-exp(-.012*t*t);
      col=mix(col,bg,fog);
    }

    col=col/(col+vec3(.85));
    col=pow(col,vec3(.86));
    float vig=1.0-.16*dot(v,v);
    O=vec4(col*vig,1);
  }`;

  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(s) || "Unknown shader compilation error";
      gl.deleteShader(s);
      throw new Error("Pelican SDF shader compilation failed: " + message);
    }
    return s;
  }

  const vs = shader(gl.VERTEX_SHADER, vertexSource);
  const fs = shader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "a");
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unknown program link error";
    gl.deleteProgram(program);
    throw new Error("Pelican SDF program link failed: " + message);
  }

  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const uR = gl.getUniformLocation(program, "R");
  const uT = gl.getUniformLocation(program, "T");
  const uE = gl.getUniformLocation(program, "E");
  const uC = gl.getUniformLocation(program, "C");

  let yaw = 0.62;
  let pitch = 0.18;
  let distance = 6.15;
  let disposed = false;
  let lost = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pinchDistance = 0;
  const pointers = new Map();
  const target = [0.12, 1.82, 0];

  const oldTabIndex = canvas.getAttribute("tabindex");
  const oldTouchAction = canvas.style.touchAction;
  if (canvas.tabIndex < 0) canvas.tabIndex = 0;
  canvas.style.touchAction = "none";

  function clampView() {
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
    distance = Math.max(1.05, Math.min(12, distance));
  }

  function pointerDown(e) {
    canvas.focus({ preventScroll: true });
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    if (pointers.size === 2) {
      const p = Array.from(pointers.values());
      pinchDistance = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
    }
    e.preventDefault();
  }

  function pointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const previous = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1 && dragging) {
      yaw -= (e.clientX - previous[0]) * 0.008;
      pitch += (e.clientY - previous[1]) * 0.008;
      clampView();
    } else if (pointers.size === 2) {
      const p = Array.from(pointers.values());
      const d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
      if (pinchDistance > 0 && d > 0) distance *= pinchDistance / d;
      pinchDistance = d;
      clampView();
    }
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
  }

  function pointerUp(e) {
    pointers.delete(e.pointerId);
    dragging = pointers.size > 0;
    pinchDistance = 0;
    if (pointers.size === 1) {
      const p = Array.from(pointers.values())[0];
      lastX = p[0];
      lastY = p[1];
    }
    e.preventDefault();
  }

  function wheel(e) {
    distance *= Math.exp(e.deltaY * 0.0012);
    clampView();
    e.preventDefault();
  }

  function keydown(e) {
    let used = true;
    if (e.key === "ArrowLeft") yaw += 0.09;
    else if (e.key === "ArrowRight") yaw -= 0.09;
    else if (e.key === "ArrowUp") pitch -= 0.07;
    else if (e.key === "ArrowDown") pitch += 0.07;
    else if (e.key === "+" || e.key === "=") distance *= 0.88;
    else if (e.key === "-" || e.key === "_") distance *= 1.14;
    else used = false;
    if (used) {
      clampView();
      e.preventDefault();
    }
  }

  function contextLost(e) {
    lost = true;
    e.preventDefault();
  }

  function contextRestored() {
    lost = true;
  }

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", keydown);
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", contextRestored);

  return {
    render(timeSeconds) {
      if (disposed || lost || gl.isContextLost()) return;
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      if (w < 1 || h < 1) return;

      const cp = Math.cos(pitch);
      const eye = [
        target[0] + Math.sin(yaw) * cp * distance,
        target[1] + Math.sin(pitch) * distance,
        target[2] + Math.cos(yaw) * cp * distance
      ];

      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uR, w, h);
      gl.uniform1f(uT, Number.isFinite(timeSeconds) ? timeSeconds : 0);
      gl.uniform3f(uE, eye[0], eye[1], eye[2]);
      gl.uniform3f(uC, target[0], target[1], target[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },

    setView(newYaw, newPitch, newDistance) {
      if (Number.isFinite(newYaw)) yaw = newYaw;
      if (Number.isFinite(newPitch)) pitch = newPitch;
      if (Number.isFinite(newDistance)) distance = newDistance;
      clampView();
    },

    getView() {
      return { yaw, pitch, distance };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keydown);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      canvas.style.touchAction = oldTouchAction;
      if (oldTabIndex === null) canvas.removeAttribute("tabindex");
      else canvas.setAttribute("tabindex", oldTabIndex);
      pointers.clear();
      if (!gl.isContextLost()) {
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        gl.deleteProgram(program);
      }
    }
  };
}

