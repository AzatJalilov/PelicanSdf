export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false
  });
  if (!gl) throw new Error("WebGL2 is required to render the pelican artwork.");

  const vertexSource = `#version 300 es
  void main() {
    vec2 p = gl_VertexID == 0 ? vec2(-1.0, -1.0) :
             gl_VertexID == 1 ? vec2( 3.0, -1.0) :
                                vec2(-1.0,  3.0);
    gl_Position = vec4(p, 0.0, 1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  precision highp int;

  uniform vec2 uResolution;
  uniform vec3 uCamera;
  uniform vec3 uRight;
  uniform vec3 uUp;
  uniform vec3 uForward;
  uniform float uScale;
  uniform float uTime;
  out vec4 outColor;

  vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

  float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }

  float sdEllipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / max(k1, 0.00001);
  }

  float sdEllipsoidAt(vec3 p, vec3 c, vec3 r) {
    return sdEllipsoid(p - c, r);
  }

  float sdRotEllipsoid(vec3 p, vec3 c, vec3 r, float a) {
    vec2 q = p.xy - c.xy;
    float cs = cos(a), sn = sin(a);
    vec3 v = vec3(cs * q.x + sn * q.y, -sn * q.x + cs * q.y, p.z - c.z);
    return sdEllipsoid(v, r);
  }

  float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float sdCylinderZ(vec3 p, float r, float h) {
    vec2 d = abs(vec2(length(p.xy) - r, p.z)) - vec2(0.0, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }

  float sdTorusXY(vec3 p, vec2 c, float radius, float tube) {
    vec2 q = vec2(length(p.xy - c) - radius, p.z);
    return length(q) - tube;
  }

  float sdSpokes(vec3 p, vec2 c) {
    vec2 q = p.xy - c;
    float r = length(q);
    float da = mod(atan(q.y, q.x) - uTime * 0.72 + 0.261799, 0.523599) - 0.261799;
    float along = r * cos(da);
    float across = abs(r * sin(da));
    float endcap = max(max(0.105 - along, along - 0.55), 0.0);
    return length(vec3(endcap, across, p.z - 0.012)) - 0.009;
  }

  vec2 wheel(vec3 p, vec2 c) {
    vec2 d = vec2(sdTorusXY(p, c, 0.63, 0.067), 2.0);
    d = opU(d, vec2(sdTorusXY(p, c, 0.55, 0.018), 3.0));
    d = opU(d, vec2(sdSpokes(p, c), 4.0));
    d = opU(d, vec2(sdCylinderZ(vec3(p.xy - c, p.z), 0.095, 0.105), 3.0));
    return d;
  }

  vec2 bicycleFrame(vec3 p) {
    vec2 d = vec2(100.0, 0.0);
    vec3 rear = vec3(-1.15, 0.68, 0.0);
    vec3 front = vec3( 1.15, 0.68, 0.0);
    vec3 crank = vec3(-0.15, 0.72, 0.0);
    vec3 seatTop = vec3(-0.47, 1.48, 0.0);
    vec3 headLow = vec3(0.76, 0.87, 0.0);
    vec3 headTop = vec3(0.69, 1.48, 0.0);

    d = opU(d, vec2(sdCapsule(p, rear, crank, 0.035), 5.0));
    d = opU(d, vec2(sdCapsule(p, rear, seatTop, 0.028), 5.0));
    d = opU(d, vec2(sdCapsule(p, crank, seatTop, 0.041), 5.0));
    d = opU(d, vec2(sdCapsule(p, seatTop, headTop, 0.037), 5.0));
    d = opU(d, vec2(sdCapsule(p, crank, headLow, 0.044), 5.0));
    d = opU(d, vec2(sdCapsule(p, front, headLow, 0.040), 5.0));
    d = opU(d, vec2(sdCapsule(p, headLow, headTop, 0.048), 5.0));
    d = opU(d, vec2(sdCapsule(p, headTop, vec3(0.72, 1.77, 0.0), 0.0), 5.0));
    d = opU(d, vec2(sdCapsule(p, vec3(0.72, 1.77, -0.50), vec3(0.72, 1.77, 0.50), 0.0), 5.0));
    d = opU(d, vec2(sdCapsule(p, vec3(0.72, 1.77, -0.51), vec3(0.72, 1.77, -0.31), 0.045), 13.0));
    d = opU(d, vec2(sdCapsule(p, vec3(0.72, 1.77,  0.31), vec3(0.72, 1.77,  0.51), 0.045), 13.0));
    d = opU(d, vec2(sdCapsule(p, seatTop, vec3(-0.52, 1.68, 0.0), 0.035), 5.0));
    d = opU(d, vec2(sdRotEllipsoid(p, vec3(-0.55, 1.73, 0.0), vec3(0.27, 0.07, 0.15), -0.06), 6.0));

    vec3 crankA = vec3(0.10, 0.42, 0.18);
    vec3 crankB = vec3(-0.40, 1.02, -0.18);
    d = opU(d, vec2(sdTorusXY(p, crank.xy, 0.15, 0.025), 14.0));
    d = opU(d, vec2(sdCapsule(p, crank, crankA, 0.027), 14.0));
    d = opU(d, vec2(sdCapsule(p, crank, crankB, 0.027), 14.0));
    d = opU(d, vec2(sdBox(p - vec3(0.10, 0.42, 0.27), vec3(0.13, 0.035, 0.10)), 15.0));
    d = opU(d, vec2(sdBox(p - vec3(-0.40, 1.02, -0.27), vec3(0.13, 0.035, 0.10)), 15.0));
    d = opU(d, vec2(sdTorusXY(p, vec2(-1.00, 0.68), 0.105, 0.014), 14.0));
    d = opU(d, vec2(sdCapsule(p, vec3(-1.00, 0.785, 0.0), vec3(-0.15, 0.825, 0.0), 0.012), 14.0));
    d = opU(d, vec2(sdCapsule(p, vec3(-1.00, 0.575, 0.0), vec3(-0.15, 0.615, 0.0), 0.012), 14.0));
    return d;
  }

  vec2 pelicanCore(vec3 p) {
    vec2 d = vec2(100.0, 0.0);
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(-0.20, 2.04, 0.0), vec3(0.67, 0.45, 0.40)), 1.0));
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.02, 2.11, 0.0), vec3(0.42, 0.36, 0.36)), 1.0));
    d = opU(d, vec2(sdCapsule(p, vec3(0.12, 2.23, 0.0), vec3(0.35, 2.62, 0.0), 0.19), 1.0));
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.48, 2.72, 0.0), vec3(0.33, 0.29, 0.28)), 1.0));

    d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.54, 2.82, 0.245), vec3(0.083, 0.083, 0.055)), 1.0));
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.585, 2.82, 0.289), vec3(0.041, 0.047, 0.035)), 10.0));
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.54, 2.82, -0.245), vec3(0.083, 0.083, 0.055)), 1.0));
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.585, 2.82, -0.289), vec3(0.041, 0.047, 0.035)), 10.0));

    d = opU(d, vec2(sdRotEllipsoid(p, vec3(1.18, 2.64, 0.0), vec3(0.57, 0.073, 0.135), -0.105), 7.0));
    d = opU(d, vec2(sdRotEllipsoid(p, vec3(1.17, 2.555, 0.0), vec3(0.49, 0.031, 0.12), -0.09), 11.0));
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.98, 2.31, 0.0), vec3(0.28, 0.34, 0.205)), 8.0));
    d = opU(d, vec2(sdCapsule(p, vec3(0.73, 2.62, 0.0), vec3(0.82, 2.42, 0.0), 0.075), 8.0));

    d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.92, 2.68, 0.115), vec3(0.027, 0.018, 0.016)), 10.0));
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.92, 2.68, -0.115), vec3(0.027, 0.018, 0.016)), 10.0));
    return d;
  }

  vec2 pelicanWings(vec3 p) {
    vec2 d = vec2(100.0, 0.0);
    for (int side = 0; side < 2; ++side) {
      float s = side == 0 ? 1.0 : -1.0;
      float z = 0.36 * s;
      d = opU(d, vec2(sdRotEllipsoid(p, vec3(-0.20, 2.08, z), vec3(0.49, 0.245, 0.13), -0.22), 9.0));
      d = opU(d, vec2(sdCapsule(p, vec3(-0.02, 2.17, z), vec3(0.27, 1.98, 0.42 * s), 0.11), 9.0));
      d = opU(d, vec2(sdCapsule(p, vec3(0.27, 1.98, 0.42 * s), vec3(0.67, 1.76, 0.47 * s), 0.085), 9.0));
      d = opU(d, vec2(sdEllipsoidAt(p, vec3(0.68, 1.76, 0.47 * s), vec3(0.12, 0.085, 0.105)), 16.0));
      d = opU(d, vec2(sdCapsule(p, vec3(-0.46, 1.98, 0.40 * s), vec3(-0.77, 1.84, 0.40 * s), 0.067), 16.0));
      d = opU(d, vec2(sdCapsule(p, vec3(-0.37, 2.00, 0.43 * s), vec3(-0.66, 1.90, 0.43 * s), 0.052), 16.0));
    }
    return d;
  }

  vec2 pelicanLegs(vec3 p) {
    vec2 d = vec2(100.0, 0.0);
    d = opU(d, vec2(sdCapsule(p, vec3(-0.37, 1.78, 0.25), vec3(-0.49, 1.26, 0.31), 0.061), 12.0));
    d = opU(d, vec2(sdCapsule(p, vec3(-0.49, 1.26, 0.31), vec3(0.02, 0.51, 0.31), 0.048), 12.0));
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(-0.49, 1.26, 0.31), vec3(0.075, 0.075, 0.075)), 12.0));
    d = opU(d, vec2(sdRotEllipsoid(p, vec3(0.08, 0.49, 0.32), vec3(0.18, 0.068, 0.095), -0.08), 12.0));

    d = opU(d, vec2(sdCapsule(p, vec3(-0.37, 1.78, -0.25), vec3(-0.10, 1.22, -0.31), 0.061), 12.0));
    d = opU(d, vec2(sdCapsule(p, vec3(-0.10, 1.22, -0.31), vec3(-0.39, 1.09, -0.31), 0.048), 12.0));
    d = opU(d, vec2(sdEllipsoidAt(p, vec3(-0.10, 1.22, -0.31), vec3(0.075, 0.075, 0.075)), 12.0));
    d = opU(d, vec2(sdRotEllipsoid(p, vec3(-0.40, 1.06, -0.32), vec3(0.17, 0.066, 0.095), 0.08), 12.0));
    return d;
  }

  vec2 scene(vec3 p) {
    vec2 d = vec2(100.0, 0.0);
    float b;

    b = length(p - vec3(-1.15, 0.68, 0.0)) - 0.78;
    if (b < d.x) d = wheel(p, vec2(-1.15, 0.68));
    b = length(p - vec3(1.15, 0.68, 0.0)) - 0.78;
    if (b < d.x) d = opU(d, wheel(p, vec2(1.15, 0.68)));

    b = length(p - vec3(0.0, 0.94, 0.0)) - 1.80;
    if (b < d.x) d = opU(d, bicycleFrame(p));
    b = length(p - vec3(0.45, 2.39, 0.0)) - 1.72;
    if (b < d.x) d = opU(d, pelicanCore(p));
    b = length(p - vec3(-0.05, 2.0, 0.0)) - 1.26;
    if (b < d.x) d = opU(d, pelicanWings(p));
    b = length(p - vec3(-0.18, 1.28, 0.0)) - 0.97;
    if (b < d.x) d = opU(d, pelicanLegs(p));
    return d;
  }

  vec3 calcNormal(vec3 p) {
    float e = 0.0025;
    vec2 k = vec2(1.0, -1.0);
    return normalize(
      k.xyy * scene(p + k.xyy * e).x +
      k.yyx * scene(p + k.yyx * e).x +
      k.yxy * scene(p + k.yxy * e).x +
      k.xxx * scene(p + k.xxx * e).x
    );
  }

  vec3 materialColor(float id) {
    if (id < 1.5) return vec3(0.94, 0.88, 0.72);
    if (id < 2.5) return vec3(0.035, 0.052, 0.061);
    if (id < 3.5) return vec3(0.52, 0.70, 0.71);
    if (id < 4.5) return vec3(0.72, 0.82, 0.78);
    if (id < 5.5) return vec3(0.035, 0.40, 0.46);
    if (id < 6.5) return vec3(0.30, 0.13, 0.065);
    if (id < 7.5) return vec3(0.98, 0.49, 0.10);
    if (id < 8.5) return vec3(0.91, 0.22, 0.12);
    if (id < 9.5) return vec3(0.12, 0.61, 0.67);
    if (id < 10.5) return vec3(0.018, 0.025, 0.032);
    if (id < 11.5) return vec3(1.0, 0.68, 0.17);
    if (id < 12.5) return vec3(0.92, 0.29, 0.12);
    if (id < 13.5) return vec3(0.12, 0.075, 0.04);
    if (id < 14.5) return vec3(0.83, 0.54, 0.18);
    if (id < 15.5) return vec3(0.08, 0.12, 0.14);
    return vec3(0.75, 0.88, 0.84);
  }

  vec3 shadeObject(vec3 ro, vec3 rd, vec3 p, float id) {
    vec3 n = calcNormal(p);
    vec3 lightDir = normalize(vec3(-0.46, 0.83, 0.55));
    float diff = max(dot(n, lightDir), 0.0);
    float sky = 0.5 + 0.5 * n.y;
    vec3 base = materialColor(id);
    float ao = 1.0;
    float h1 = 0.075;
    float h2 = 0.19;
    ao -= max(0.0, h1 - scene(p + n * h1).x) * 1.8;
    ao -= max(0.0, h2 - scene(p + n * h2).x) * 0.65;
    vec3 halfV = normalize(lightDir - rd);
    float spec = pow(max(dot(n, halfV), 0.0), id == 3.0 || id == 4.0 ? 48.0 : 30.0);
    float gloss = (id == 3.0 || id == 4.0 || id == 10.0) ? 0.38 : 0.12;
    vec3 color = base * (0.43 + 0.30 * sky + 0.68 * diff) * clamp(ao, 0.55, 1.0);
    color += vec3(0.83, 0.91, 0.89) * spec * gloss;
    color += base * pow(max(0.0, 1.0 - max(dot(n, normalize(ro - p)), 0.0)), 3.0) * 0.10;
    return color;
  }

  vec3 shadeGround(vec3 p, vec3 rd) {
    vec3 lightDir = normalize(vec3(-0.46, 0.83, 0.55));
    float diff = max(dot(vec3(0.0, 1.0, 0.0), lightDir), 0.0);
    float shadow1 = exp(-7.0 * ((p.x + 1.15) * (p.x + 1.15) + 0.65 * p.z * p.z));
    float shadow2 = exp(-7.0 * ((p.x - 1.15) * (p.x - 1.15) + 0.65 * p.z * p.z));
    float shadow3 = exp(-1.9 * (p.x * p.x + 1.2 * p.z * p.z));
    float shadow = max(max(shadow1, shadow2), shadow3 * 0.50);
    vec3 base = mix(vec3(0.70, 0.67, 0.53), vec3(0.84, 0.78, 0.63), 0.5 + 0.5 * sin(p.x * 0.55));
    return base * (0.55 + 0.48 * diff) * (1.0 - 0.38 * shadow);
  }

  vec3 skyColor(vec3 rd) {
    float t = smoothstep(-0.18, 0.72, rd.y);
    vec3 low = vec3(0.14, 0.27, 0.32);
    vec3 high = vec3(0.56, 0.73, 0.75);
    vec3 c = mix(low, high, t);
    float glow = pow(max(dot(rd, normalize(vec3(-0.35, 0.58, 0.72))), 0.0), 12.0);
    return c + vec3(0.12, 0.10, 0.06) * glow;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    float aspect = uResolution.x / uResolution.y;
    vec3 rd = normalize(uForward + uRight * (uv.x * aspect * uScale) + uUp * (uv.y * uScale));
    vec3 color = skyColor(rd);

    float tGround = 1.0e6;
    if (rd.y < -0.0001) {
      float tg = -uCamera.y / rd.y;
      if (tg > 0.0) tGround = tg;
    }

    vec3 center = vec3(0.0, 1.55, 0.0);
    vec3 oc = uCamera - center;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - 9.0;
    float h = b * b - c;
    bool objectHit = false;
    float objectT = 1.0e6;
    vec2 hit = vec2(0.0);

    if (h >= 0.0) {
      float root = sqrt(h);
      float t0 = max(0.0, -b - root);
      float t1 = -b + root;
      float tEnd = min(t1, tGround);
      if (t0 < tGround && tEnd > t0) {
        float t = t0;
        for (int i = 0; i < 76; ++i) {
          vec2 q = scene(uCamera + rd * t);
          if (q.x < 0.0018) {
            objectHit = true;
            objectT = t;
            hit = q;
            break;
          }
          t += max(q.x * 0.86, 0.003);
          if (t > tEnd) break;
        }
      }
    }

    if (objectHit && objectT < tGround) {
      vec3 p = uCamera + rd * objectT;
      color = shadeObject(uCamera, rd, p, hit.y);
    } else if (tGround < 1.0e5) {
      vec3 p = uCamera + rd * tGround;
      color = shadeGround(p, rd);
    }

    color = pow(max(color, vec3(0.0)), vec3(0.454545));
    outColor = vec4(color, 1.0);
  }`;

  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to create a WebGL2 shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "Unknown shader compilation error.";
      gl.deleteShader(shader);
      throw new Error("Pelican renderer shader compilation failed: " + message);
    }
    return shader;
  }

  function createResources() {
    const vs = compile(gl.VERTEX_SHADER, vertexSource);
    let fs;
    let program;
    try {
      fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      if (!program) throw new Error("Unable to create a WebGL2 program.");
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error("Pelican renderer program linking failed: " + (gl.getProgramInfoLog(program) || "Unknown link error."));
      }
    } catch (error) {
      if (program) gl.deleteProgram(program);
      if (fs) gl.deleteShader(fs);
      gl.deleteShader(vs);
      throw error;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(program);
      throw new Error("Unable to create a WebGL2 vertex array.");
    }
    gl.bindVertexArray(vao);
    return {
      program,
      vao,
      resolution: gl.getUniformLocation(program, "uResolution"),
      camera: gl.getUniformLocation(program, "uCamera"),
      right: gl.getUniformLocation(program, "uRight"),
      up: gl.getUniformLocation(program, "uUp"),
      forward: gl.getUniformLocation(program, "uForward"),
      scale: gl.getUniformLocation(program, "uScale"),
      time: gl.getUniformLocation(program, "uTime")
    };
  }

  let resources = createResources();
  let disposed = false;
  let contextLost = false;
  let yaw = 0.48;
  let pitch = 0.10;
  let distance = 7.0;

  const oldTabIndex = canvas.getAttribute("tabindex");
  const oldTouchAction = canvas.style.touchAction;
  if (canvas.tabIndex < 0) canvas.tabIndex = 0;
  canvas.style.touchAction = "none";

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function wrapAngle(a) {
    a = (a + Math.PI) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a - Math.PI;
  }

  function render(timeSeconds) {
    if (disposed || contextLost || gl.isContextLost()) return;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (!width || !height) return;

    const cp = Math.cos(pitch);
    const eyeOffset = [
      Math.sin(yaw) * cp * distance,
      Math.sin(pitch) * distance,
      Math.cos(yaw) * cp * distance
    ];
    const target = [0.0, 1.55, 0.0];
    const camera = [
      target[0] + eyeOffset[0],
      target[1] + eyeOffset[1],
      target[2] + eyeOffset[2]
    ];
    let fx = target[0] - camera[0];
    let fy = target[1] - camera[1];
    let fz = target[2] - camera[2];
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, ry = 0.0, rz = fx;
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl; ry /= rl; rz /= rl;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;

    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(resources.program);
    gl.bindVertexArray(resources.vao);
    gl.uniform2f(resources.resolution, width, height);
    gl.uniform3f(resources.camera, camera[0], camera[1], camera[2]);
    gl.uniform3f(resources.right, rx, ry, rz);
    gl.uniform3f(resources.up, ux, uy, uz);
    gl.uniform3f(resources.forward, fx, fy, fz);
    gl.uniform1f(resources.scale, 0.72);
    gl.uniform1f(resources.time, Number.isFinite(timeSeconds) ? timeSeconds : 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setView(nextYaw, nextPitch, nextDistance) {
    if (Number.isFinite(nextYaw)) yaw = wrapAngle(nextYaw);
    if (Number.isFinite(nextPitch)) pitch = clamp(nextPitch, -1.25, 1.25);
    if (Number.isFinite(nextDistance)) distance = clamp(nextDistance, 3.15, 12.0);
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  const pointers = new Map();
  let pinchDistance = 0;

  function pointerDown(event) {
    event.preventDefault();
    try { canvas.focus({ preventScroll: true }); } catch (_) { canvas.focus(); }
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const a = Array.from(pointers.values());
      pinchDistance = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    }
  }

  function pointerMove(event) {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      const pts = Array.from(pointers.values());
      const now = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDistance > 0 && now > 0) distance = clamp(distance * pinchDistance / now, 3.15, 12.0);
      pinchDistance = now;
    } else {
      yaw = wrapAngle(yaw - dx * 0.008);
      pitch = clamp(pitch + dy * 0.007, -1.25, 1.25);
    }
  }

  function pointerUp(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
    try {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    } catch (_) {}
  }

  function wheel(event) {
    event.preventDefault();
    distance = clamp(distance * Math.exp(event.deltaY * 0.001), 3.15, 12.0);
  }

  function keyDown(event) {
    let handled = true;
    switch (event.key) {
      case "ArrowLeft": yaw = wrapAngle(yaw - 0.075); break;
      case "ArrowRight": yaw = wrapAngle(yaw + 0.075); break;
      case "ArrowUp": pitch = clamp(pitch + 0.065, -1.25, 1.25); break;
      case "ArrowDown": pitch = clamp(pitch - 0.065, -1.25, 1.25); break;
      case "+":
      case "=": distance = clamp(distance * 0.90, 3.15, 12.0); break;
      case "-":
      case "_": distance = clamp(distance * 1.11, 3.15, 12.0); break;
      default: handled = false;
    }
    if (handled) event.preventDefault();
  }

  function contextLost(event) {
    event.preventDefault();
    contextLost = true;
  }

  function contextRestored() {
    try {
      resources = createResources();
      contextLost = false;
    } catch (_) {
      contextLost = true;
    }
  }

  canvas.addEventListener("pointerdown", pointerDown, { passive: false });
  canvas.addEventListener("pointermove", pointerMove, { passive: false });
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", keyDown);
  canvas.addEventListener("webglcontextlost", contextLost, false);
  canvas.addEventListener("webglcontextrestored", contextRestored, false);

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.removeEventListener("pointermove", pointerMove);
    canvas.removeEventListener("pointerup", pointerUp);
    canvas.removeEventListener("pointercancel", pointerUp);
    canvas.removeEventListener("wheel", wheel);
    canvas.removeEventListener("keydown", keyDown);
    canvas.removeEventListener("webglcontextlost", contextLost);
    canvas.removeEventListener("webglcontextrestored", contextRestored);
    if (resources && !gl.isContextLost()) {
      gl.deleteVertexArray(resources.vao);
      gl.deleteProgram(resources.program);
    }
    if (oldTabIndex === null) canvas.removeAttribute("tabindex");
    else canvas.setAttribute("tabindex", oldTabIndex);
    canvas.style.touchAction = oldTouchAction;
  }

  return { render, setView, getView, dispose };
}
