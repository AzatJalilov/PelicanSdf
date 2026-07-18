export function createPelicanSdf(canvas) {
  if (!canvas) throw new Error('Canvas required');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 not supported');

  let lost = false;
  canvas.addEventListener('webglcontextlost', () => { lost = true; }, false);
  canvas.addEventListener('webglcontextrestored', () => { lost = false; }, false);

  const vertSrc = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  const fragSrc = `#version 300 es
precision highp float;
uniform vec3 u_camPos, u_camFwd, u_camRgt, u_camUp;
uniform vec2 u_res;
uniform float u_fov, u_time;
out vec4 outCol;

#define SURF 0.001
#define MAXD 50.0
#define MAXSTEPS 100

// --------- SDF primitives -----------
float sSph(vec3 p,float r){return length(p)-r;}
float sBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sRbx(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))-r;}
float sCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sTrX(vec3 p,float maj,float mir){return length(vec2(length(p.yz)-maj,p.x))-mir;}
float sEll(vec3 p,vec3 r){float k=min(min(r.x,r.y),r.z);return(length(p/r)-1.)*k;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}

// materials
#define MT_GND 10
#define MT_FRM 20
#define MT_WHL 21
#define MT_GRIP 22
#define MT_SEAT 23
#define MT_CRK 24
#define MT_BODY 30
#define MT_BEAK 32
#define MT_EYE 33
#define MT_POUCH 34
#define MT_WING 35
#define MT_LEG 36

// --------- scene map ------------
vec2 map(vec3 p) {
  float d = 1e4, m = 0.0;
  // ground
  float gnd = p.y;
  if (gnd < d) { d = gnd; m = float(MT_GND); }

  // wheel constants
  float wr = 1.0, tr = 0.12;
  float zR = -1.2, zF = 1.2;
  vec3 rc = vec3(0.0, wr, zR);
  vec3 fc = vec3(0.0, wr, zF);
  vec3 bb = vec3(0.0, 0.5, 0.2);

  // rear wheel
  { vec3 q = p - rc;
    float ang = u_time * 4.0;
    float ca = cos(ang), sa = sin(ang);
    q.yz = vec2(q.y*ca - q.z*sa, q.y*sa + q.z*ca);
    float dt = sTrX(q, wr, tr);
    if (dt < d) { d = dt; m = float(MT_WHL); }
    // spokes (5)
    for (int i = 0; i < 5; i++) {
      float a = float(i) * 1.256637;
      vec2 dir = vec2(cos(a), sin(a));
      float ds = sCap(q, vec3(0.0), vec3(0.0, dir.x*wr, dir.y*wr), 0.03);
      if (ds < d) { d = ds; m = float(MT_WHL); }
    }
  }

  // front wheel
  { vec3 q = p - fc;
    float ang = u_time * 4.0;
    float ca = cos(ang), sa = sin(ang);
    q.yz = vec2(q.y*ca - q.z*sa, q.y*sa + q.z*ca);
    float dt = sTrX(q, wr, tr);
    if (dt < d) { d = dt; m = float(MT_WHL); }
    for (int i = 0; i < 5; i++) {
      float a = float(i) * 1.256637;
      vec2 dir = vec2(cos(a), sin(a));
      float ds = sCap(q, vec3(0.0), vec3(0.0, dir.x*wr, dir.y*wr), 0.03);
      if (ds < d) { d = ds; m = float(MT_WHL); }
    }
  }

  // frame tubes
  vec3 seatTop = vec3(0.0, 1.6, -0.8);
  vec3 hdTop = vec3(0.0, 1.7, 1.2);
  float ft = 0.06;

  float dcs = sCap(p, rc, bb, ft);          if (dcs < d) { d = dcs; m = float(MT_FRM); }
  float dst = sCap(p, bb, seatTop, ft);     if (dst < d) { d = dst; m = float(MT_FRM); }
  float dss = sCap(p, seatTop, rc, ft);     if (dss < d) { d = dss; m = float(MT_FRM); }
  float dtt = sCap(p, seatTop, hdTop, ft);  if (dtt < d) { d = dtt; m = float(MT_FRM); }
  float ddt = sCap(p, hdTop, bb, ft);       if (ddt < d) { d = ddt; m = float(MT_FRM); }
  float dhd = sCap(p, hdTop, vec3(0.0, 1.4, 1.2), ft); if (dhd < d) { d = dhd; m = float(MT_FRM); }

  // seat
  vec3 sPos = seatTop + vec3(0.0, 0.12, -0.05);
  vec3 qse = p - sPos;
  float dse = sRbx(qse, vec3(0.18, 0.05, 0.25), 0.02);
  if (dse < d) { d = dse; m = float(MT_SEAT); }

  // handlebar stem + grip
  vec3 stemEnd = hdTop + vec3(0.0, 0.22, 0.1);
  float dste = sCap(p, hdTop, stemEnd, 0.04);   if (dste < d) { d = dste; m = float(MT_FRM); }
  vec3 gripR = stemEnd + vec3(0.3, 0.0, 0.05);
  float dgr = sCap(p, stemEnd, gripR, 0.04);    if (dgr < d) { d = dgr; m = float(MT_GRIP); }

  // crank & pedals
  float crLen = 0.3, crRad = 0.04;
  float an = u_time * 5.0;
  float ca2 = cos(an), sa2 = sin(an);
  vec3 qb = p - bb;
  qb.yz = vec2(qb.y*ca2 - qb.z*sa2, qb.y*sa2 + qb.z*ca2);
  float dcr = sCap(qb, vec3(0.0), vec3(0.0, crLen, 0.0), crRad);            if (dcr < d) { d = dcr; m = float(MT_CRK); }
  float dpd = sCap(qb, vec3(-0.12, crLen, 0.0), vec3(0.12, crLen, 0.0), 0.05); if (dpd < d) { d = dpd; m = float(MT_CRK); }

  // pelican body
  vec3 bodyC = vec3(0.0, 2.35, -0.5);
  vec3 q = p - bodyC;
  float bd = (length(q/vec3(0.4, 0.5, 0.7)) - 1.0) * 0.4;
  float hdR = 0.28;
  vec3 hdPos = vec3(0.0, 0.15, 0.8);
  float hd = length(q - hdPos) - hdR;
  float dbody = smin(bd, hd, 0.15);
  if (dbody < d) { d = dbody; m = float(MT_BODY); }

  // beak
  vec3 bkStart = hdPos + vec3(0.0, -0.02, 0.22);
  vec3 bkEnd = bkStart + vec3(0.0, -0.06, 0.55);
  float dbk = sCap(q, bkStart, bkEnd, 0.08);   if (dbk < d) { d = dbk; m = float(MT_BEAK); }

  // pouch
  vec3 poc = hdPos + vec3(0.0, -0.22, 0.25);
  float dpc = (length((q - poc)/vec3(0.18, 0.3, 0.25)) - 1.0) * 0.18;    if (dpc < d) { d = dpc; m = float(MT_POUCH); }

  // eye
  float de = length(q - (hdPos + vec3(0.18, 0.12, 0.26))) - 0.06;         if (de < d) { d = de; m = float(MT_EYE); }

  // right wing (in world space)
  vec3 shR = bodyC + vec3(0.45, 0.1, 0.15);
  vec3 elR = bodyC + vec3(0.75, 0.05, 0.38);
  float dw1 = sCap(p, shR, elR, 0.08);                                   if (dw1 < d) { d = dw1; m = float(MT_WING); }
  float dw2 = sCap(p, elR, gripR, 0.07);                                  if (dw2 < d) { d = dw2; m = float(MT_WING); }

  // right leg
  vec3 hipR = bodyC + vec3(0.3, -0.42, -0.15);
  vec3 footR = bb + vec3(0.0, crLen*ca2, crLen*sa2);
  float dl = sCap(p, hipR, footR, 0.08);                                  if (dl < d) { d = dl; m = float(MT_LEG); }

  return vec2(d, m);
}

// --------- lighting ----------
vec3 getColor(float mat) {
  if (mat < 15.0)      return vec3(0.35, 0.25, 0.15); // ground
  else if (mat < 21.0) return vec3(0.15, 0.3, 0.65);  // bike frame
  else if (mat < 22.0) return vec3(0.15, 0.15, 0.15); // wheels/spokes
  else if (mat < 23.0) return vec3(0.3, 0.2, 0.1);    // grip
  else if (mat < 24.0) return vec3(0.1, 0.1, 0.1);    // seat
  else if (mat < 25.0) return vec3(0.5, 0.5, 0.5);    // crank/pedals
  else if (mat < 31.0) return vec3(0.92, 0.88, 0.82); // body/head
  else if (mat < 33.0) return vec3(1.0, 0.55, 0.1);   // beak
  else if (mat < 34.0) return vec3(0.05, 0.05, 0.05); // eye
  else if (mat < 35.0) return vec3(0.85, 0.75, 0.2);  // pouch
  else if (mat < 36.0) return vec3(0.6, 0.6, 0.6);    // wing
  return vec3(0.85, 0.5, 0.15);                        // leg
}

float shadow(vec3 ro, vec3 rd) {
  float t = 0.02;
  for (int i = 0; i < 50; i++) {
    vec3 p = ro + rd * t;
    float d = map(p).x;
    if (d < SURF) return 0.0;
    if (t > 5.0) break;
    t += d;
  }
  return 1.0;
}

vec3 normal(vec3 p) {
  vec2 e = vec2(1e-3, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec3 ro = u_camPos;
  vec3 rd = normalize(u_camFwd + u_camRgt * uv.x * u_fov + u_camUp * uv.y * u_fov);

  float t = 0.0;
  vec3 col = vec3(0.75, 0.85, 0.95); // sky
  for (int i = 0; i < MAXSTEPS; i++) {
    vec3 p = ro + rd * t;
    vec2 h = map(p);
    float d = h.x;
    if (d < SURF) {
      vec3 pos = p;
      float mat = h.y;
      vec3 N = normal(pos);
      vec3 base = getColor(mat);
      vec3 L = normalize(vec3(1.0, 1.0, 0.6));
      float amb = 0.25;
      float diff = max(dot(N, L), 0.0);
      float sh = shadow(pos, L);
      float spec = pow(max(dot(N, normalize(L - rd)), 0.0), 32.0);
      col = base * (amb + diff * sh * 0.75) + spec * 0.3;
      // slight fog
      float fog = exp(-t * 0.02);
      col = mix(vec3(0.75, 0.85, 0.95), col, fog);
      break;
    }
    if (t > MAXD) break;
    t += d;
  }
  outCol = vec4(col, 1.0);
}`;

  function createShader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile error: ' + log);
    }
    return s;
  }

  const vs = createShader(gl.VERTEX_SHADER, vertSrc);
  const fs = createShader(gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error('Program link error: ' + log);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const uLoc = {
    camPos: gl.getUniformLocation(program, 'u_camPos'),
    camFwd: gl.getUniformLocation(program, 'u_camFwd'),
    camRgt: gl.getUniformLocation(program, 'u_camRgt'),
    camUp: gl.getUniformLocation(program, 'u_camUp'),
    res: gl.getUniformLocation(program, 'u_res'),
    fov: gl.getUniformLocation(program, 'u_fov'),
    time: gl.getUniformLocation(program, 'u_time'),
  };

  // camera state
  let yaw = 0, pitch = 0, distance = 8.0;
  const state = {
    pos: new Float32Array(3),
    fwd: new Float32Array(3),
    rgt: new Float32Array(3),
    up: new Float32Array(3),
  };

  function updateCam() {
    const hd = distance * Math.cos(pitch);
    state.pos[0] = hd * Math.cos(yaw);
    state.pos[1] = distance * Math.sin(pitch);
    state.pos[2] = hd * Math.sin(yaw);
    const tgt = [0, 0, 0];
    state.fwd[0] = tgt[0] - state.pos[0];
    state.fwd[1] = tgt[1] - state.pos[1];
    state.fwd[2] = tgt[2] - state.pos[2];
    const flen = Math.hypot(state.fwd[0], state.fwd[1], state.fwd[2]);
    state.fwd[0] /= flen; state.fwd[1] /= flen; state.fwd[2] /= flen;

    const wup = [0, 1, 0];
    let right = [
      state.fwd[1] * wup[2] - state.fwd[2] * wup[1],
      state.fwd[2] * wup[0] - state.fwd[0] * wup[2],
      state.fwd[0] * wup[1] - state.fwd[1] * wup[0]
    ];
    let rlen = Math.hypot(right[0], right[1], right[2]);
    if (rlen < 1e-6) {
      const alt = [0, 0, 1];
      right = [
        state.fwd[1] * alt[2] - state.fwd[2] * alt[1],
        state.fwd[2] * alt[0] - state.fwd[0] * alt[2],
        state.fwd[0] * alt[1] - state.fwd[1] * alt[0]
      ];
      rlen = Math.hypot(right[0], right[1], right[2]);
    }
    right[0] /= rlen; right[1] /= rlen; right[2] /= rlen;
    state.rgt[0] = right[0]; state.rgt[1] = right[1]; state.rgt[2] = right[2];

    const up = [
      right[1] * state.fwd[2] - right[2] * state.fwd[1],
      right[2] * state.fwd[0] - right[0] * state.fwd[2],
      right[0] * state.fwd[1] - right[1] * state.fwd[0]
    ];
    state.up[0] = up[0]; state.up[1] = up[1]; state.up[2] = up[2];
  }
  updateCam();

  // interaction
  let pointerDown = false, lastX = 0, lastY = 0;
  const onDown = (e) => {
    pointerDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!pointerDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    yaw -= dx * 0.005;
    pitch += dy * 0.005;
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    updateCam();
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = (e) => {
    pointerDown = false;
    canvas.releasePointerCapture(e.pointerId);
  };
  const onWheel = (e) => {
    e.preventDefault();
    distance *= (1 + e.deltaY * 0.001);
    distance = Math.max(1.0, Math.min(30.0, distance));
    updateCam();
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { yaw += 0.05; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { yaw -= 0.05; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { pitch += 0.05; pitch = Math.min(Math.PI/2-0.01, pitch); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { pitch -= 0.05; pitch = Math.max(-Math.PI/2+0.01, pitch); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') { distance = Math.max(1.0, distance - 0.5); e.preventDefault(); }
    else if (e.key === '-' || e.key === '_') { distance = Math.min(30.0, distance + 0.5); e.preventDefault(); }
    else return;
    updateCam();
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  canvas.setAttribute('tabindex', '0');
  canvas.style.outline = 'none';
  canvas.style.touchAction = 'none';
  canvas.addEventListener('click', () => canvas.focus());

  const fovRad = 45 * Math.PI / 180;
  const fovScale = Math.tan(fovRad / 2);

  function render(time) {
    if (lost || gl.isContextLost()) return;
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;
    gl.viewport(0, 0, w, h);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform3fv(uLoc.camPos, state.pos);
    gl.uniform3fv(uLoc.camFwd, state.fwd);
    gl.uniform3fv(uLoc.camRgt, state.rgt);
    gl.uniform3fv(uLoc.camUp, state.up);
    gl.uniform2f(uLoc.res, w, h);
    gl.uniform1f(uLoc.fov, fovScale);
    gl.uniform1f(uLoc.time, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  function setView(y, p, d) {
    yaw = y; pitch = p; distance = d;
    updateCam();
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  function dispose() {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('keydown', onKey);
    canvas.style.touchAction = '';
    gl.deleteProgram(program);
    gl.deleteVertexArray(vao);
    gl.deleteBuffer(buf);
    const shaders = gl.getAttachedShaders(program);
    if (shaders) shaders.forEach(s => gl.deleteShader(s));
  }

  return { render, setView, getView, dispose };
}
