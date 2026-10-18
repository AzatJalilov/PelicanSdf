export function createPelicanSdf(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('createPelicanSdf: a canvas element is required');
  }
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'
  });
  if (!gl) throw new Error('createPelicanSdf: WebGL2 is unavailable in this environment');

  const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uEye;
uniform vec3 uTgt;
out vec4 outColor;
const float PI = 3.14159265;
const float L1 = 0.42;
const float L2 = 0.40;
const vec3 BB = vec3(-0.05, 0.42, 0.0);
const vec3 ST = vec3(-0.36, 1.0, 0.0);
const vec3 HB = vec3(0.5, 0.82, 0.0);
const vec3 HT = vec3(0.56, 1.1, 0.0);
const vec3 RH = vec3(-0.72, 0.5, 0.0);
const vec3 FH = vec3(0.72, 0.5, 0.0);
const vec3 HIP = vec3(-0.22, 1.18, 0.0);

vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
float cap(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float rcone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float ell(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}
float box(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
float tor(vec3 p, float R, float r) {
  return length(vec2(length(p.xy) - R, p.z)) - r;
}
vec2 mn(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

vec2 wheel(vec3 p, vec3 c, float spin) {
  vec3 q = p - c;
  vec2 tire = vec2(tor(q, 0.43, 0.065), 7.0);
  float rim = tor(q, 0.36, 0.016);
  float r = length(q.xy);
  float a = atan(q.y, q.x) + spin;
  float n = PI / 3.0;
  float ang = mod(a + n * 0.5, n) - n * 0.5;
  vec3 s = vec3(r * cos(ang), r * sin(ang), q.z);
  float sp = length(s - vec3(clamp(s.x, 0.0, 0.36), 0.0, 0.0)) - 0.007;
  float hub = max(r - 0.05, abs(q.z) - 0.085);
  return mn(tire, vec2(min(rim, min(sp, hub)), 8.0));
}

vec3 knee(vec3 H, vec3 A) {
  vec2 d = A.xy - H.xy;
  float Lh = clamp(length(d), 0.05, L1 + L2 - 0.01);
  vec2 dir = d / max(length(d), 1e-4);
  float a = (L1 * L1 - L2 * L2 + Lh * Lh) / (2.0 * Lh);
  float h = sqrt(max(L1 * L1 - a * a, 0.0));
  vec2 n = vec2(-dir.y, dir.x);
  if (n.x < 0.0) n = -n;
  return vec3(H.xy + dir * a + n * h, H.z);
}

vec2 map(vec3 p) {
  float spin = uTime * 2.2;
  vec2 res = mn(wheel(p, RH, spin), wheel(p, FH, spin));
  vec3 pz = vec3(p.x, p.y, abs(p.z));

  float fr = cap(p, BB, ST, 0.03);
  fr = min(fr, cap(p, ST, HT, 0.03));
  fr = min(fr, cap(p, BB, HB, 0.035));
  fr = min(fr, cap(p, HB, HT, 0.04));
  fr = min(fr, cap(pz, BB + vec3(0.0, 0.0, 0.04), RH + vec3(0.0, 0.0, 0.07), 0.022));
  fr = min(fr, cap(pz, ST + vec3(0.0, 0.0, 0.03), RH + vec3(0.0, 0.0, 0.07), 0.02));
  fr = min(fr, cap(pz, HB, FH + vec3(0.0, 0.0, 0.07), 0.026));
  res = mn(res, vec2(fr, 6.0));

  float bar = cap(p, HT, vec3(0.62, 1.24, 0.0), 0.026);
  bar = min(bar, cap(p, vec3(0.62, 1.24, -0.2), vec3(0.62, 1.24, 0.2), 0.022));
  bar = min(bar, cap(pz, vec3(0.62, 1.24, 0.2), vec3(0.72, 1.1, 0.22), 0.024));
  res = mn(res, vec2(bar, 6.0));

  res = mn(res, vec2(box(p - (ST + vec3(-0.05, 0.08, 0.0)), vec3(0.15, 0.015, 0.05), 0.022), 9.0));
  res = mn(res, vec2(cap(p, ST, ST + vec3(-0.03, 0.06, 0.0), 0.018), 8.0));

  float ring = max(length(p.xy - BB.xy) - 0.1, abs(p.z - 0.11) - 0.008);
  float cog = max(length(p.xy - RH.xy) - 0.065, abs(p.z - 0.05) - 0.008);
  float chain = min(cap(p, BB + vec3(0.0, 0.1, 0.08), RH + vec3(0.0, 0.065, 0.05), 0.009),
                    cap(p, BB + vec3(0.0, -0.1, 0.08), RH + vec3(0.0, -0.065, 0.05), 0.009));

  float th = uTime * 1.6;
  vec2 cu = vec2(cos(th), sin(th)) * 0.17;
  vec3 P1 = vec3(BB.xy + cu, 0.16);
  vec3 P2 = vec3(BB.xy - cu, -0.16);
  float crank = min(cap(p, vec3(BB.xy, 0.11), P1, 0.016), cap(p, vec3(BB.xy, -0.11), P2, 0.016));
  res = mn(res, vec2(min(min(ring, cog), min(chain, crank)), 8.0));
  float pedal = min(box(p - P1, vec3(0.05, 0.007, 0.03), 0.006), box(p - P2, vec3(0.05, 0.007, 0.03), 0.006));
  res = mn(res, vec2(pedal, 11.0));

  vec3 hp1 = HIP + vec3(0.0, 0.0, 0.13);
  vec3 hp2 = HIP - vec3(0.0, 0.0, 0.13);
  vec3 an1 = P1 + vec3(0.0, 0.04, 0.0);
  vec3 an2 = P2 + vec3(0.0, 0.04, 0.0);
  vec3 kn1 = knee(hp1, an1);
  vec3 kn2 = knee(hp2, an2);
  float legs = min(cap(p, hp1, kn1, 0.065), cap(p, kn1, an1, 0.045));
  legs = min(legs, min(cap(p, hp2, kn2, 0.065), cap(p, kn2, an2, 0.045)));
  res = mn(res, vec2(legs, 5.0));
  float feet = min(ell(p - (an1 + vec3(0.03, -0.01, 0.0)), vec3(0.075, 0.022, 0.045)),
                   ell(p - (an2 + vec3(0.03, -0.01, 0.0)), vec3(0.075, 0.022, 0.045)));
  res = mn(res, vec2(feet, 5.0));

  vec3 q = p - vec3(-0.12, 1.42, 0.0);
  q.xy = rot(q.xy, -0.3);
  res = mn(res, vec2(ell(q, vec3(0.42, 0.3, 0.32)), 1.0));

  float neck = rcone(p, vec3(0.2, 1.5, 0.0), vec3(0.42, 1.9, 0.0), 0.12, 0.08);
  float head = ell(p - vec3(0.47, 1.98, 0.0), vec3(0.16, 0.14, 0.13));
  res = mn(res, vec2(min(neck, head), 1.0));

  float up = rcone(p, vec3(0.56, 2.0, 0.0), vec3(0.98, 1.8, 0.0), 0.07, 0.018);
  float lo = rcone(p, vec3(0.52, 1.93, 0.0), vec3(0.92, 1.78, 0.0), 0.055, 0.014);
  res = mn(res, vec2(min(up, lo), 2.0));
  res = mn(res, vec2(ell(p - vec3(0.7, 1.7, 0.0), vec3(0.19, 0.12, 0.1)), 3.0));
  res = mn(res, vec2(length(vec3(p.x - 0.53, p.y - 2.04, abs(p.z) - 0.11)) - 0.035, 4.0));

  vec3 wq = p - vec3(-0.2, 1.5, 0.0);
  wq.xy = rot(wq.xy, 0.28 + 0.04 * sin(uTime * 1.7));
  wq.z = abs(wq.z) - 0.33;
  res = mn(res, vec2(ell(wq, vec3(0.52, 0.16, 0.05)), 10.0));

  vec3 tq = p - vec3(-0.62, 1.2, 0.0);
  tq.xy = rot(tq.xy, 0.25);
  res = mn(res, vec2(ell(tq, vec3(0.2, 0.05, 0.13)), 10.0));
  return res;
}

vec3 calcN(vec3 p) {
  const vec2 e = vec2(0.0005, -0.0005);
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x +
                   e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}
float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 4; i++) {
    float h = 0.015 + 0.1 * float(i);
    occ += (h - map(p + n * h).x) * sca;
    sca *= 0.8;
  }
  return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}
float softSh(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.03;
  for (int i = 0; i < 36; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.02, 0.25);
    if (res < 0.01 || t > 5.0) break;
  }
  return clamp(res, 0.0, 1.0);
}
vec2 boxHit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 r = rd + vec3(equal(rd, vec3(0.0))) * 1e-6;
  vec3 ia = (bmin - ro) / r;
  vec3 ib = (bmax - ro) / r;
  vec3 n = min(ia, ib);
  vec3 f = max(ia, ib);
  return vec2(max(max(n.x, n.y), n.z), min(min(f.x, f.y), f.z));
}
vec3 albedo(float id, vec3 p) {
  if (id < 1.5) return vec3(0.95, 0.94, 0.9);
  if (id < 2.5) return vec3(0.98, 0.66, 0.14);
  if (id < 3.5) return vec3(0.96, 0.52, 0.36);
  if (id < 4.5) return vec3(0.02);
  if (id < 5.5) return vec3(0.98, 0.45, 0.14);
  if (id < 6.5) return vec3(0.8, 0.12, 0.08);
  if (id < 7.5) return vec3(0.06, 0.06, 0.07);
  if (id < 8.5) return vec3(0.74, 0.76, 0.8);
  if (id < 9.5) return vec3(0.36, 0.2, 0.1);
  if (id < 10.5) {
    float d = 1.0 - smoothstep(-0.5, -0.3, p.x);
    return mix(vec3(0.9, 0.89, 0.86), vec3(0.4, 0.4, 0.42), d) * (0.94 + 0.06 * sin(p.x * 60.0 + p.z * 25.0));
  }
  return vec3(0.1);
}
vec3 lit(vec3 pos, vec3 n, vec3 rd, vec3 alb) {
  vec3 L = normalize(vec3(0.55, 0.85, 0.45));
  float dif = clamp(dot(n, L), 0.0, 1.0);
  float sh = dif > 0.0 ? softSh(pos + n * 0.01, L) : 0.0;
  float ao = calcAO(pos, n);
  float sky = 0.5 + 0.5 * n.y;
  float fill = clamp(dot(n, normalize(vec3(-0.6, 0.3, -0.5))), 0.0, 1.0);
  vec3 H = normalize(L - rd);
  float spe = pow(clamp(dot(n, H), 0.0, 1.0), 40.0) * dif * sh * 0.35;
  vec3 c = alb * (vec3(1.0, 0.95, 0.85) * dif * sh +
                  vec3(0.4, 0.45, 0.55) * sky * ao * 0.5 +
                  vec3(0.5) * fill * 0.15 * ao + 0.05 * ao);
  return c + spe * vec3(1.0, 0.97, 0.9);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ww = normalize(uTgt - uEye);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 ro = uEye;
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.4 * ww);
  vec3 col = mix(vec3(0.98, 0.93, 0.83), vec3(0.6, 0.78, 0.95), clamp(rd.y * 1.5 + 0.15, 0.0, 1.0));

  vec2 bt = boxHit(ro, rd, vec3(-1.3, -0.05, -0.5), vec3(1.3, 2.35, 0.5));
  float tObj = 1e5, id = 0.0;
  if (bt.y > max(bt.x, 0.0)) {
    float t = max(bt.x, 0.0);
    for (int i = 0; i < 160; i++) {
      vec2 h = map(ro + rd * t);
      if (h.x < 0.0006 * t) { tObj = t; id = h.y; break; }
      t += h.x * 0.85;
      if (t > bt.y) break;
    }
  }
  float tG = rd.y < -1e-4 ? -ro.y / rd.y : 1e5;
  if (tObj < tG) {
    vec3 pos = ro + rd * tObj;
    col = lit(pos, calcN(pos), rd, albedo(id, pos));
  } else if (tG < 1e5) {
    vec3 pos = ro + rd * tG;
    vec3 shaded = lit(pos, vec3(0.0, 1.0, 0.0), rd, vec3(0.64, 0.69, 0.6));
    col = mix(col, shaded, exp(-tG * 0.1));
  }
  col *= 1.0 - 0.12 * dot(uv, uv);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  const cam = { yaw: 0.7, pitch: 0.25, distance: 4.6 };
  const DIST_MIN = 0.9, DIST_MAX = 10, PITCH_LIM = 1.45;
  const state = {
    lost: false, disposed: false, lastTime: 0, lastPinch: 0,
    program: null, vao: null, uRes: null, uTime: null, uEye: null, uTgt: null
  };
  const pointers = new Map();

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wrap = (a) => {
    let x = (a + Math.PI) % (2 * Math.PI);
    if (x < 0) x += 2 * Math.PI;
    return x - Math.PI;
  };
  const targetOf = (d) => {
    const t = clamp((3.5 - d) / (3.5 - 0.9), 0, 1);
    const s = t * t * (3 - 2 * t);
    return [0.55 * s, 1.0 + 0.7 * s, 0];
  };

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) || 'unknown error';
      gl.deleteShader(sh);
      throw new Error('createPelicanSdf: shader compilation failed: ' + log);
    }
    return sh;
  }

  function build() {
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) || 'unknown error';
      gl.deleteProgram(prog);
      throw new Error('createPelicanSdf: program link failed: ' + log);
    }
    state.program = prog;
    state.vao = gl.createVertexArray();
    state.uRes = gl.getUniformLocation(prog, 'uRes');
    state.uTime = gl.getUniformLocation(prog, 'uTime');
    state.uEye = gl.getUniformLocation(prog, 'uEye');
    state.uTgt = gl.getUniformLocation(prog, 'uTgt');
  }

  function eyeOf() {
    const tg = targetOf(cam.distance);
    const cp = Math.cos(cam.pitch);
    const d = cam.distance;
    return {
      eye: [tg[0] + d * cp * Math.sin(cam.yaw), tg[1] + d * Math.sin(cam.pitch), tg[2] + d * cp * Math.cos(cam.yaw)],
      tg
    };
  }

  function draw(t) {
    if (state.disposed || state.lost || !state.program || gl.isContextLost()) return;
    const w = canvas.width, h = canvas.height;
    if (w < 1 || h < 1) return;
    const v = eyeOf();
    gl.viewport(0, 0, w, h);
    gl.useProgram(state.program);
    gl.uniform2f(state.uRes, w, h);
    gl.uniform1f(state.uTime, t);
    gl.uniform3f(state.uEye, v.eye[0], v.eye[1], v.eye[2]);
    gl.uniform3f(state.uTgt, v.tg[0], v.tg[1], v.tg[2]);
    gl.bindVertexArray(state.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const redraw = () => draw(state.lastTime);
  const orbit = (dyaw, dpitch) => {
    cam.yaw = wrap(cam.yaw + dyaw);
    cam.pitch = clamp(cam.pitch + dpitch, -PITCH_LIM, PITCH_LIM);
  };
  const zoom = (f) => { cam.distance = clamp(cam.distance * f, DIST_MIN, DIST_MAX); };
  const spanOf = () => {
    const it = pointers.values();
    const a = it.next().value, b = it.next().value;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onDown = (e) => {
    if (state.disposed) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    state.lastPinch = pointers.size >= 2 ? spanOf() : 0;
  };
  const onMove = (e) => {
    if (state.disposed) return;
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      orbit(dx * 0.008, dy * 0.008);
    } else if (pointers.size >= 2) {
      const s = spanOf();
      if (state.lastPinch > 0 && s > 0) zoom(state.lastPinch / s);
      state.lastPinch = s;
    }
    redraw();
  };
  const onUp = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    state.lastPinch = pointers.size >= 2 ? spanOf() : 0;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  };
  const onWheel = (e) => {
    if (state.disposed) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    zoom(Math.exp(e.deltaY * k * 0.0012));
    redraw();
  };
  const onKey = (e) => {
    if (state.disposed) return;
    const step = 0.08;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': orbit(-step, 0); break;
      case 'ArrowRight': orbit(step, 0); break;
      case 'ArrowUp': orbit(0, step); break;
      case 'ArrowDown': orbit(0, -step); break;
      case '+': case '=': zoom(0.9); break;
      case '-': case '_': zoom(1 / 0.9); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); redraw(); }
  };
  const noScroll = (e) => { if (!state.disposed) e.preventDefault(); };
  const onLost = (e) => { e.preventDefault(); state.lost = true; };
  const onRestored = () => {
    state.lost = false;
    try {
      build();
      draw(state.lastTime);
    } catch (_) {
      state.program = null;
    }
  };

  const listeners = [
    ['pointerdown', onDown, false],
    ['pointermove', onMove, false],
    ['pointerup', onUp, false],
    ['pointercancel', onUp, false],
    ['keydown', onKey, false],
    ['wheel', onWheel, { passive: false }],
    ['touchstart', noScroll, { passive: false }],
    ['touchmove', noScroll, { passive: false }],
    ['webglcontextlost', onLost, false],
    ['webglcontextrestored', onRestored, false]
  ];

  build();

  canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  for (const [type, fn, opts] of listeners) canvas.addEventListener(type, fn, opts);

  return {
    render(timeSeconds) {
      if (state.disposed) return;
      const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
      state.lastTime = t;
      draw(t);
    },
    setView(yaw, pitch, distance) {
      if (state.disposed) return;
      if (Number.isFinite(yaw)) cam.yaw = wrap(yaw);
      if (Number.isFinite(pitch)) cam.pitch = clamp(pitch, -PITCH_LIM, PITCH_LIM);
      if (Number.isFinite(distance)) cam.distance = clamp(distance, DIST_MIN, DIST_MAX);
      redraw();
    },
    getView() {
      return { yaw: cam.yaw, pitch: cam.pitch, distance: cam.distance };
    },
    dispose() {
      if (state.disposed) return;
      state.disposed = true;
      for (const [type, fn, opts] of listeners) canvas.removeEventListener(type, fn, opts);
      pointers.clear();
      try {
        if (!gl.isContextLost()) {
          if (state.program) gl.deleteProgram(state.program);
          if (state.vao) gl.deleteVertexArray(state.vao);
        }
      } catch (_) { /* ignore */ }
      state.program = null;
      state.vao = null;
    }
  };
}
