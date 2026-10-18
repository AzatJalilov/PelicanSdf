export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true
  });
  if (!gl) throw new Error("Pelican SDF requires WebGL2.");

  const vertexSource = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0,
                gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

  const fragmentSource = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec3 uView;
uniform float uTime;
out vec4 outColor;

const float PI = 3.14159265359;

float capsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 v = b - a;
  float h = clamp(dot(p - a, v) / dot(v, v), 0.0, 1.0);
  return length(p - a - h * v) - r;
}

float tapered(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 v = b - a;
  float h = clamp(dot(p - a, v) / dot(v, v), 0.0, 1.0);
  return length(p - a - h * v) - mix(ra, rb, h);
}

float ellipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 < 0.0001 ? -min(r.x, min(r.y, r.z)) : k0 * (k0 - 1.0) / k1;
}

float roundedBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float torusZ(vec3 p, float majorRadius, float minorRadius) {
  return length(vec2(length(p.xy) - majorRadius, p.z)) - minorRadius;
}

float cylinderZ(vec3 p, float radius, float halfLength) {
  return max(length(p.xy) - radius, abs(p.z) - halfLength);
}

void addHit(inout vec2 hit, float d, float material) {
  if (d < hit.x) hit = vec2(d, material);
}

void wheel(inout vec2 hit, vec3 p, vec2 center, float spin) {
  vec3 w = p - vec3(center, 0.0);
  if (length(w) - 0.75 >= hit.x) return;

  float radius = length(w.xy);
  addHit(hit, length(vec2(radius - 0.645, w.z)) - 0.069, 1.0);
  addHit(hit, length(vec2(radius - 0.537, w.z)) - 0.028, 2.0);
  addHit(hit, length(vec2(radius - 0.606, abs(w.z) - 0.054)) - 0.012, 13.0);
  addHit(hit, cylinderZ(w, 0.103, 0.14), 2.0);

  float spokeBound = max(
    max(0.105 - radius, radius - 0.525),
    abs(abs(w.z) - 0.052) - 0.012
  );
  if (spokeBound < hit.x) {
    float angle = atan(w.y, w.x) - spin;
    float nearest = atan(sin(12.0 * angle), cos(12.0 * angle)) / 12.0;
    float spoke = max(spokeBound, abs(sin(nearest)) * radius - 0.011);
    addHit(hit, spoke, 3.0);
  }
}

vec2 scene(vec3 p) {
  vec2 hit = vec2(100.0, 0.0);
  float bob = 0.012 * sin(uTime * 3.2);
  vec3 bird = p - vec3(0.0, bob, 0.0);

  addHit(hit, ellipsoid(bird - vec3(-0.53, 2.31, 0.0),
                        vec3(0.78, 0.49, 0.42)), 7.0);
  addHit(hit, tapered(bird, vec3(-0.17, 2.49, 0.0),
                      vec3(-0.25, 2.75, 0.0), 0.22, 0.14), 7.0);
  addHit(hit, tapered(bird, vec3(-0.25, 2.75, 0.0),
                      vec3(0.04, 3.08, 0.0), 0.14, 0.12), 7.0);
  addHit(hit, tapered(bird, vec3(0.04, 3.08, 0.0),
                      vec3(0.24, 3.24, 0.0), 0.13, 0.22), 7.0);
  addHit(hit, ellipsoid(bird - vec3(0.23, 3.26, 0.0),
                        vec3(0.29, 0.26, 0.245)), 7.0);

  if (length(bird - vec3(1.25, 3.0, 0.0)) - 1.10 < hit.x) {
    addHit(hit, ellipsoid(bird - vec3(1.16, 2.90, 0.0),
                          vec3(0.86, 0.27, 0.19)), 10.0);
    addHit(hit, tapered(bird, vec3(0.43, 3.24, 0.0),
                        vec3(1.29, 3.21, 0.0), 0.125, 0.092), 9.0);
    addHit(hit, tapered(bird, vec3(1.29, 3.21, 0.0),
                        vec3(2.17, 3.11, 0.0), 0.092, 0.036), 9.0);
    addHit(hit, tapered(bird, vec3(2.16, 3.12, 0.0),
                        vec3(2.13, 3.025, 0.0), 0.047, 0.014), 9.0);
    addHit(hit, tapered(bird, vec3(0.54, 3.075, 0.0),
                        vec3(2.10, 3.035, 0.0), 0.028, 0.019), 9.0);
    for (int i = 0; i < 2; i++) {
      float side = i == 0 ? -1.0 : 1.0;
      addHit(hit, length(bird - vec3(0.62, 3.32, side * 0.09)) - 0.023, 11.0);
    }
  }

  if (length(bird - vec3(0.23, 3.26, 0.0)) - 0.45 < hit.x) {
    for (int i = 0; i < 2; i++) {
      float side = i == 0 ? -1.0 : 1.0;
      addHit(hit, length(bird - vec3(0.35, 3.365, side * 0.235)) - 0.080, 13.0);
      addHit(hit, length(bird - vec3(0.382, 3.371, side * 0.294)) - 0.050, 11.0);
      addHit(hit, length(bird - vec3(0.393, 3.391, side * 0.331)) - 0.013, 13.0);
    }
  }

  if (length(bird - vec3(-0.55, 2.31, 0.0)) - 1.24 < hit.x) {
    for (int i = 0; i < 2; i++) {
      float side = i == 0 ? -1.0 : 1.0;
      vec3 shoulder = vec3(-0.54, 2.47, side * 0.37);
      vec3 elbow = vec3(-0.18, 2.46, side * 0.53);
      vec3 tip = vec3(0.36, 2.08, side * 0.55);
      addHit(hit, tapered(bird, shoulder, elbow, 0.155, 0.12), 8.0);
      addHit(hit, tapered(bird, elbow, tip, 0.125, 0.064), 8.0);
      addHit(hit, ellipsoid(bird - tip, vec3(0.11, 0.075, 0.080)), 8.0);
      addHit(hit, tapered(bird, vec3(-0.40, 2.43, side * 0.48),
                          vec3(-1.07, 2.49, side * 0.49), 0.105, 0.027), 16.0);
      addHit(hit, tapered(bird, vec3(-0.42, 2.35, side * 0.49),
                          vec3(-1.05, 2.27, side * 0.48), 0.095, 0.024), 16.0);
      addHit(hit, tapered(bird, vec3(-0.38, 2.27, side * 0.48),
                          vec3(-0.91, 2.12, side * 0.46), 0.077, 0.021), 16.0);
    }
    for (int i = -1; i <= 1; i++) {
      float z = float(i) * 0.12;
      addHit(hit, tapered(bird, vec3(-1.01, 2.29, z),
                          vec3(-1.47, 2.39 + 0.05 * float(i), z * 1.25),
                          0.085, 0.016), 16.0);
    }
  }

  float spin = uTime * 1.6;
  wheel(hit, p, vec2(-1.15, 0.72), spin);
  wheel(hit, p, vec2(1.25, 0.72), spin);

  vec3 rear = vec3(-1.15, 0.72, 0.0);
  vec3 front = vec3(1.25, 0.72, 0.0);
  vec3 crank = vec3(-0.25, 0.82, 0.0);
  vec3 seatJoint = vec3(-0.48, 1.68, 0.0);
  vec3 headLow = vec3(0.61, 1.54, 0.0);
  vec3 headHigh = vec3(0.72, 1.78, 0.0);

  if (length(p - vec3(-0.23, 1.25, 0.0)) - 1.20 < hit.x) {
    addHit(hit, capsule(p, seatJoint, crank, 0.044), 4.0);
    addHit(hit, capsule(p, seatJoint, headHigh, 0.041), 4.0);
    addHit(hit, capsule(p, crank, headLow, 0.047), 4.0);
    addHit(hit, capsule(p, headLow, headHigh, 0.061), 4.0);
    addHit(hit, capsule(p, rear, crank, 0.036), 4.0);
    addHit(hit, capsule(p, rear, seatJoint, 0.033), 4.0);
  }

  if (length(p - vec3(0.97, 1.22, 0.0)) - 0.69 < hit.x) {
    for (int i = 0; i < 2; i++) {
      float side = i == 0 ? -1.0 : 1.0;
      addHit(hit, capsule(p, vec3(0.70, 1.70, side * 0.105),
                          front + vec3(0.0, 0.0, side * 0.105), 0.038), 6.0);
    }
  }

  if (length(p - vec3(-0.57, 1.76, 0.0)) - 0.50 < hit.x) {
    addHit(hit, capsule(p, vec3(-0.49, 1.63, 0.0),
                        vec3(-0.55, 1.81, 0.0), 0.035), 6.0);
    addHit(hit, roundedBox(p - vec3(-0.59, 1.84, 0.0),
                           vec3(0.32, 0.025, 0.15), 0.043), 5.0);
  }

  if (length(p - vec3(0.57, 2.00, 0.0)) - 0.70 < hit.x) {
    addHit(hit, capsule(p, vec3(0.72, 1.77, 0.0),
                        vec3(0.70, 2.035, 0.0), 0.040), 6.0);
    addHit(hit, capsule(p, vec3(0.70, 2.035, -0.55),
                        vec3(0.70, 2.035, 0.55), 0.034), 6.0);
    for (int i = 0; i < 2; i++) {
      float side = i == 0 ? -1.0 : 1.0;
      addHit(hit, capsule(p, vec3(0.70, 2.035, side * 0.55),
                          vec3(0.36, 2.035, side * 0.55), 0.052), 14.0);
    }
    addHit(hit, length(p - vec3(0.72, 2.11, 0.18)) - 0.064, 2.0);
  }

  if (length(p - vec3(-0.70, 0.77, 0.16)) - 0.70 < hit.x) {
    addHit(hit, torusZ(p - vec3(-0.25, 0.82, 0.16), 0.183, 0.022), 2.0);
    addHit(hit, torusZ(p - vec3(-1.15, 0.72, 0.16), 0.105, 0.017), 2.0);
    addHit(hit, capsule(p, vec3(-1.15, 0.83, 0.16),
                        vec3(-0.25, 1.005, 0.16), 0.012), 15.0);
    addHit(hit, capsule(p, vec3(-1.15, 0.61, 0.16),
                        vec3(-0.25, 0.635, 0.16), 0.012), 15.0);
    addHit(hit, cylinderZ(p - crank, 0.070, 0.19), 2.0);
  }

  if (length(p - vec3(-0.19, 1.34, 0.0)) - 1.08 < hit.x) {
    for (int i = 0; i < 2; i++) {
      float side = i == 0 ? 1.0 : -1.0;
      float phase = spin + 0.80 + float(i) * PI;
      vec3 pedal = vec3(-0.25 + 0.22 * cos(phase),
                         0.82 + 0.22 * sin(phase), side * 0.29);
      vec3 hip = vec3(-0.37, 1.99 + bob, side * 0.24);
      vec3 knee = vec3(0.035 + 0.095 * cos(phase),
                       1.39 + 0.115 * sin(phase), side * 0.31);
      addHit(hit, tapered(p, hip, knee, 0.068, 0.052), 12.0);
      addHit(hit, tapered(p, knee, pedal, 0.052, 0.045), 12.0);
      addHit(hit, ellipsoid(p - pedal - vec3(0.105, 0.047, side * 0.018),
                            vec3(0.18, 0.066, 0.105)), 12.0);
      addHit(hit, capsule(p, crank + vec3(0.0, 0.0, side * 0.17),
                          pedal, 0.032), 6.0);
      addHit(hit, roundedBox(p - pedal - vec3(0.025, -0.048, side * 0.06),
                             vec3(0.145, 0.022, 0.075), 0.018), 14.0);
    }
  }

  return hit;
}

vec3 normalAt(vec3 p) {
  const float e = 0.0023;
  return normalize(
    vec3( e, -e, -e) * scene(p + vec3( e, -e, -e)).x +
    vec3(-e, -e,  e) * scene(p + vec3(-e, -e,  e)).x +
    vec3(-e,  e, -e) * scene(p + vec3(-e,  e, -e)).x +
    vec3( e,  e,  e) * scene(p + vec3( e,  e,  e)).x
  );
}

vec3 materialColor(float id) {
  if (id < 1.5) return vec3(0.075, 0.105, 0.135);
  if (id < 2.5) return vec3(0.84, 0.57, 0.27);
  if (id < 3.5) return vec3(0.72, 0.82, 0.82);
  if (id < 4.5) return vec3(0.13, 0.59, 0.65);
  if (id < 5.5) return vec3(0.32, 0.19, 0.15);
  if (id < 6.5) return vec3(0.60, 0.72, 0.72);
  if (id < 7.5) return vec3(0.97, 0.91, 0.77);
  if (id < 8.5) return vec3(0.80, 0.82, 0.76);
  if (id < 9.5) return vec3(1.00, 0.57, 0.19);
  if (id < 10.5) return vec3(0.96, 0.43, 0.39);
  if (id < 11.5) return vec3(0.055, 0.075, 0.085);
  if (id < 12.5) return vec3(0.94, 0.43, 0.17);
  if (id < 13.5) return vec3(0.98, 0.97, 0.87);
  if (id < 14.5) return vec3(0.14, 0.23, 0.26);
  if (id < 15.5) return vec3(0.38, 0.36, 0.30);
  return vec3(0.68, 0.74, 0.71);
}

vec3 skyColor(vec3 rd) {
  float t = smoothstep(-0.50, 0.68, rd.y);
  vec3 color = mix(vec3(0.98, 0.86, 0.76), vec3(0.69, 0.84, 0.94), t);
  float haze = exp(-rd.y * rd.y * 32.0);
  color = mix(color, vec3(0.96, 0.91, 0.83), 0.30 * haze);
  float glow = pow(max(dot(rd, normalize(vec3(-0.6, 0.35, -0.7))), 0.0), 36.0);
  return color + vec3(0.12, 0.075, 0.035) * glow;
}

float shadowBlob(vec2 p, vec2 center, vec2 radii) {
  vec2 q = (p - center) / radii;
  return exp(-dot(q, q));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) * (2.0 / uResolution.y);
  vec3 target = vec3(0.10, 1.69, 0.0);
  float cy = cos(uView.x), sy = sin(uView.x);
  float cp = cos(uView.y), sp = sin(uView.y);
  vec3 ro = target + uView.z * vec3(sy * cp, sp, cy * cp);
  vec3 forward = normalize(target - ro);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 rd = normalize(forward * 2.8 + right * uv.x + up * uv.y);

  vec3 sky = skyColor(rd);
  float floorT = 10000.0;
  if (ro.y > -0.004 && rd.y < -0.00001)
    floorT = (-0.004 - ro.y) / rd.y;

  float hitT = -1.0;
  float material = 0.0;
  vec3 boundCenter = vec3(0.10, 1.60, 0.0);
  vec3 offset = ro - boundCenter;
  float b = dot(offset, rd);
  float discriminant = b * b - dot(offset, offset) + 2.8 * 2.8;

  if (discriminant > 0.0) {
    float root = sqrt(discriminant);
    float t = max(0.0, -b - root);
    float endT = min(-b + root, floorT);
    for (int step = 0; step < 88; step++) {
      if (t > endT) break;
      vec2 sampleHit = scene(ro + rd * t);
      if (sampleHit.x < 0.0016 + 0.0004 * t) {
        hitT = t;
        material = sampleHit.y;
        break;
      }
      t += max(0.004, sampleHit.x * 0.84);
    }
  }

  vec3 color = sky;
  if (hitT >= 0.0) {
    vec3 p = ro + rd * hitT;
    vec3 n = normalAt(p);
    vec3 light = normalize(vec3(-0.56, 0.79, 0.43));
    vec3 fill = normalize(vec3(0.63, 0.30, -0.70));
    float diffuse = max(dot(n, light), 0.0);
    float bounce = max(dot(n, fill), 0.0);
    vec3 base = materialColor(material);
    color = base * (0.62 + 0.10 * n.y + 0.51 * diffuse + 0.14 * bounce);
    float metallic = ((material > 1.5 && material < 4.5) ||
                      (material > 5.5 && material < 6.5)) ? 1.0 : 0.0;
    float specular = pow(max(dot(reflect(-light, n), -rd), 0.0),
                         mix(34.0, 24.0, metallic));
    color += vec3(1.0, 0.93, 0.80) * specular * mix(0.12, 0.29, metallic);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    color += base * 0.10 * rim;
    color *= mix(0.88, 1.0, smoothstep(0.0, 0.55, p.y));
    color = mix(color, sky, 1.0 - exp(-0.0007 * hitT * hitT));
  } else if (floorT < 10000.0) {
    vec3 p = ro + rd * floorT;
    float shadow = 0.15 * shadowBlob(p.xz, vec2(-0.05, 0.0), vec2(1.55, 0.54));
    shadow += 0.25 * shadowBlob(p.xz, vec2(-1.15, 0.0), vec2(0.53, 0.25));
    shadow += 0.25 * shadowBlob(p.xz, vec2(1.25, 0.0), vec2(0.53, 0.25));
    color = vec3(0.88, 0.81, 0.71) * (1.0 - min(shadow, 0.48));
    color += 0.007 * sin(p.x * 2.0) * sin(p.z * 2.0);
    color = mix(color, sky, 1.0 - exp(-0.0008 * floorT * floorT));
  }

  outColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(0.90)), 1.0);
}`;

  let program = null;
  let vao = null;
  let locations = null;
  let lost = false;
  let disposed = false;
  let yaw = 0.48;
  let pitch = 0.18;
  let distance = 7.1;

  function compile(type, source, label) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error(`Unable to create ${label} shader.`);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "unknown compiler error";
      gl.deleteShader(shader);
      throw new Error(`Pelican SDF ${label} shader compilation failed: ${log}`);
    }
    return shader;
  }

  function build() {
    let vertex = null;
    let fragment = null;
    let nextProgram = null;
    let nextVao = null;
    try {
      vertex = compile(gl.VERTEX_SHADER, vertexSource, "vertex");
      fragment = compile(gl.FRAGMENT_SHADER, fragmentSource, "fragment");
      nextProgram = gl.createProgram();
      if (!nextProgram) throw new Error("Unable to create Pelican SDF program.");
      gl.attachShader(nextProgram, vertex);
      gl.attachShader(nextProgram, fragment);
      gl.linkProgram(nextProgram);
      if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
        throw new Error(
          `Pelican SDF shader linking failed: ${gl.getProgramInfoLog(nextProgram) || "unknown linker error"}`
        );
      }
      nextVao = gl.createVertexArray();
      if (!nextVao) throw new Error("Unable to create Pelican SDF vertex array.");
      program = nextProgram;
      vao = nextVao;
      locations = {
        resolution: gl.getUniformLocation(program, "uResolution"),
        view: gl.getUniformLocation(program, "uView"),
        time: gl.getUniformLocation(program, "uTime")
      };
    } catch (error) {
      if (nextVao) gl.deleteVertexArray(nextVao);
      if (nextProgram) gl.deleteProgram(nextProgram);
      throw error;
    } finally {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    }
  }

  build();

  const oldTabIndex = canvas.getAttribute("tabindex");
  const oldTouchAction = canvas.style.touchAction;
  if (canvas.tabIndex < 0) canvas.tabIndex = 0;
  canvas.style.touchAction = "none";

  const pointers = new Map();
  let previousPinch = 0;

  function size() {
    const rect = canvas.getBoundingClientRect();
    return {
      width: rect.width || canvas.width || 1,
      height: rect.height || canvas.height || 1
    };
  }

  function pairDistance() {
    if (pointers.size < 2) return 0;
    const iterator = pointers.values();
    const a = iterator.next().value;
    const b = iterator.next().value;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function zoom(factor) {
    distance = Math.max(2.1, Math.min(18, distance * factor));
  }

  function pointerDown(event) {
    if (disposed) return;
    event.preventDefault();
    try {
      canvas.focus({ preventScroll: true });
    } catch (_) {
      canvas.focus();
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) previousPinch = pairDistance();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  function pointerMove(event) {
    const old = pointers.get(event.pointerId);
    if (!old || disposed) return;
    event.preventDefault();
    const dx = event.clientX - old.x;
    const dy = event.clientY - old.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      const bounds = size();
      yaw += dx * (2 * Math.PI / bounds.width);
      pitch = Math.max(-1.45, Math.min(1.45, pitch - dy * (2.8 / bounds.height)));
    } else {
      const pinch = pairDistance();
      if (pinch > 0 && previousPinch > 0) zoom(previousPinch / pinch);
      previousPinch = pinch;
    }
  }

  function pointerEnd(event) {
    pointers.delete(event.pointerId);
    previousPinch = pairDistance();
  }

  function wheelZoom(event) {
    if (disposed) return;
    event.preventDefault();
    const bounds = size();
    const scale = event.deltaMode === 1 ? 16 :
                  event.deltaMode === 2 ? bounds.height : 1;
    zoom(Math.exp(event.deltaY * scale * 0.0015));
  }

  function keyDown(event) {
    if (disposed) return;
    let handled = true;
    switch (event.key) {
      case "ArrowLeft": yaw -= 0.10; break;
      case "ArrowRight": yaw += 0.10; break;
      case "ArrowUp": pitch = Math.min(1.45, pitch + 0.10); break;
      case "ArrowDown": pitch = Math.max(-1.45, pitch - 0.10); break;
      case "+":
      case "=":
      case "NumpadAdd": zoom(0.86); break;
      case "-":
      case "_":
      case "NumpadSubtract": zoom(1 / 0.86); break;
      default: handled = false;
    }
    if (handled) event.preventDefault();
  }

  function preventMenu(event) {
    event.preventDefault();
  }

  function contextLost(event) {
    event.preventDefault();
    lost = true;
  }

  function contextRestored() {
    if (disposed) return;
    program = null;
    vao = null;
    locations = null;
    try {
      build();
      lost = false;
    } catch (_) {
      lost = true;
    }
  }

  canvas.addEventListener("pointerdown", pointerDown, { passive: false });
  canvas.addEventListener("pointermove", pointerMove, { passive: false });
  canvas.addEventListener("pointerup", pointerEnd);
  canvas.addEventListener("pointercancel", pointerEnd);
  canvas.addEventListener("wheel", wheelZoom, { passive: false });
  canvas.addEventListener("keydown", keyDown);
  canvas.addEventListener("contextmenu", preventMenu);
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", contextRestored);

  return {
    render(timeSeconds) {
      if (disposed || lost || gl.isContextLost() || !program) return;
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      if (width < 1 || height < 1) return;
      gl.viewport(0, 0, width, height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(locations.resolution, width, height);
      gl.uniform3f(
        locations.view,
        ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
        pitch,
        distance
      );
      gl.uniform1f(locations.time, Number.isFinite(timeSeconds) ? timeSeconds : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    setView(nextYaw, nextPitch, nextDistance) {
      if (Number.isFinite(nextYaw)) yaw = nextYaw;
      if (Number.isFinite(nextPitch))
        pitch = Math.max(-1.45, Math.min(1.45, nextPitch));
      if (Number.isFinite(nextDistance))
        distance = Math.max(2.1, Math.min(18, nextDistance));
    },

    getView() {
      return { yaw, pitch, distance };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      pointers.clear();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerEnd);
      canvas.removeEventListener("pointercancel", pointerEnd);
      canvas.removeEventListener("wheel", wheelZoom);
      canvas.removeEventListener("keydown", keyDown);
      canvas.removeEventListener("contextmenu", preventMenu);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      canvas.style.touchAction = oldTouchAction;
      if (oldTabIndex === null) canvas.removeAttribute("tabindex");
      else canvas.setAttribute("tabindex", oldTabIndex);
      if (!gl.isContextLost()) {
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
      }
      vao = null;
      program = null;
      locations = null;
    }
  };
}
