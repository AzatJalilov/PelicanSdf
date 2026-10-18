export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance"
  });
  if (!gl) throw new Error("This artwork requires WebGL2.");

  const vertexSource = `#version 300 es
  precision highp float;
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  out vec4 outColor;
  uniform vec2 uResolution;
  uniform vec3 uEye;
  uniform vec3 uTarget;
  uniform vec2 uCrank;
  uniform float uSpin;

  const float PI = 3.14159265359;
  const vec3 LIGHT = vec3(-0.436436, 0.872872, 0.218218);

  vec2 rotate2(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, s, -s, c) * p;
  }

  float box(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float roundedBox(vec3 p, vec3 b, float r) {
    return box(p, b) - r;
  }

  float capsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 ab = b - a;
    return length(p - a - ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0)) - r;
  }

  float ellipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / max(k1, 0.00001);
  }

  float roundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
    vec3 ab = b - a;
    float h = length(ab);
    vec3 v = p - a;
    float y = dot(v, ab) / h;
    vec2 q = vec2(length(v - ab * (y / h)), y);
    float slope = (r1 - r2) / h;
    float side = sqrt(max(1.0 - slope * slope, 0.0001));
    float k = dot(q, vec2(-slope, side));
    if (k < 0.0) return length(q) - r1;
    if (k > side * h) return length(q - vec2(0.0, h)) - r2;
    return dot(q, vec2(side, slope)) - r1;
  }

  float torusZ(vec3 p, float radius, float thickness) {
    return length(vec2(length(p.xy) - radius, p.z)) - thickness;
  }

  float smoothMin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }

  void add(inout vec2 result, float d, float material) {
    if (d < result.x) result = vec2(d, material);
  }

  float spokes(vec3 p, float count, float phase, float innerR, float outerR, float width) {
    float r = length(p.xy);
    float stepAngle = 2.0 * PI / count;
    float a = mod(atan(p.y, p.x) + phase + stepAngle * 0.5, stepAngle) - stepAngle * 0.5;
    vec2 q = vec2(cos(a), sin(a)) * r;
    return length(vec3(q.x - clamp(q.x, innerR, outerR), q.y, p.z)) - width;
  }

  vec2 scene(vec3 p) {
    vec2 result = vec2(100.0, 0.0);

    // The two wheels share one reflected coordinate system.
    vec3 w = vec3(abs(p.x) - 1.30, p.y - 0.73, p.z);
    if (box(w, vec3(0.74, 0.74, 0.18)) < result.x) {
      add(result, torusZ(w, 0.676, 0.054), 3.0);
      vec3 sidewall = vec3(w.xy, abs(w.z) - 0.037);
      add(result, torusZ(sidewall, 0.653, 0.014), 12.0);
      add(result, torusZ(w, 0.603, 0.021), 5.0);
      if (abs(w.z) < result.x + 0.012 && length(w.xy) < 0.625) {
        add(result, spokes(w, 20.0, uSpin, 0.065, 0.600, 0.0065), 5.0);
      }
      add(result, capsule(w, vec3(0, 0, -0.145), vec3(0, 0, 0.145), 0.052), 5.0);
      add(result, length(vec3(w.xy, abs(w.z) - 0.15)) - 0.039, 6.0);
    }

    // A complete diamond frame, paired stays, and paired fork blades.
    if (box(p - vec3(0.0, 1.36, 0.0), vec3(1.42, 0.92, 0.56)) < result.x) {
      float f = capsule(p, vec3(-0.60, 1.73, 0), vec3(0.69, 1.79, 0), 0.043);
      f = min(f, capsule(p, vec3(-0.60, 1.73, 0), vec3(-0.08, 0.80, 0), 0.048));
      f = min(f, capsule(p, vec3(0.82, 1.38, 0), vec3(-0.08, 0.80, 0), 0.050));
      f = min(f, capsule(p, vec3(0.69, 1.79, 0), vec3(0.82, 1.38, 0), 0.062));
      vec3 paired = vec3(p.xy, abs(p.z));
      f = min(f, capsule(paired, vec3(-1.30, 0.73, 0.12), vec3(-0.08, 0.80, 0.10), 0.031));
      f = min(f, capsule(paired, vec3(-1.30, 0.73, 0.12), vec3(-0.60, 1.70, 0.055), 0.030));
      f = min(f, capsule(paired, vec3(0.75, 1.64, 0.095), vec3(1.30, 0.73, 0.12), 0.035));
      add(result, f, 4.0);

      float silver = capsule(p, vec3(-0.60, 1.73, 0), vec3(-0.66, 1.94, 0), 0.030);
      silver = min(silver, capsule(p, vec3(0.70, 1.78, 0), vec3(0.65, 2.05, 0), 0.029));
      silver = min(silver, capsule(p, vec3(0.65, 2.05, 0), vec3(0.87, 2.16, 0), 0.029));
      silver = min(silver, capsule(p, vec3(0.87, 2.16, -0.47), vec3(0.87, 2.16, 0.47), 0.027));
      add(result, silver, 5.0);

      vec3 saddle = p - vec3(-0.69, 1.965, 0.0);
      saddle.xy = rotate2(saddle.xy, 0.06);
      add(result, roundedBox(saddle, vec3(0.205, 0.024, 0.105), 0.038), 9.0);
      add(result, capsule(paired, vec3(0.87, 2.16, 0.32), vec3(0.87, 2.16, 0.49), 0.040), 9.0);
      add(result, length(p - vec3(0.78, 2.215, 0.20)) - 0.055, 6.0);

      // Chainring, rear cog, and both runs of the chain.
      vec3 ring = p - vec3(-0.08, 0.80, 0.205);
      add(result, torusZ(ring, 0.203, 0.022), 6.0);
      if (length(ring.xy) < 0.22) {
        add(result, spokes(ring, 5.0, -atan(uCrank.y, uCrank.x), 0.02, 0.20, 0.015), 6.0);
      }
      add(result, torusZ(p - vec3(-1.30, 0.73, 0.205), 0.105, 0.018), 5.0);
      float chain = capsule(p, vec3(-1.30, 0.835, 0.216), vec3(-0.08, 1.003, 0.216), 0.012);
      chain = min(chain, capsule(p, vec3(-1.30, 0.625, 0.216), vec3(-0.08, 0.597, 0.216), 0.012));
      add(result, chain, 8.0);
      add(result, capsule(p, vec3(-0.08, 0.80, -0.285), vec3(-0.08, 0.80, 0.285), 0.048), 5.0);
    }

    // Opposed cranks, independent pedals, bent legs, and webbed feet.
    if (box(p - vec3(-0.18, 1.38, 0), vec3(0.79, 0.91, 0.65)) < result.x) {
      for (int i = 0; i < 2; i++) {
        float side = i == 0 ? 1.0 : -1.0;
        vec2 pedal = vec2(-0.08, 0.80) + side * uCrank;
        vec3 axle = vec3(pedal, side * 0.29);
        add(result, capsule(p, vec3(-0.08, 0.80, side * 0.27), axle, 0.026), 5.0);
        add(result, capsule(p, axle, vec3(pedal, side * 0.49), 0.023), 5.0);
        add(result, roundedBox(p - vec3(pedal, side * 0.405), vec3(0.105, 0.019, 0.095), 0.015), 8.0);
        vec3 hip = vec3(-0.43, 2.12, side * 0.235);
        vec3 knee = vec3(0.12 + 0.10 * side + 0.13 * side * uCrank.x, 1.55, side * 0.40);
        vec3 ankle = vec3(pedal + vec2(-0.035, 0.13), side * 0.405);
        float leg = roundCone(p, hip, knee, 0.072, 0.047);
        leg = min(leg, capsule(p, knee, ankle, 0.038));
        leg = min(leg, length(p - knee) - 0.058);
        add(result, leg, 7.0);
        vec3 foot = p - vec3(pedal + vec2(0.047, 0.079), side * 0.405);
        add(result, ellipsoid(foot, vec3(0.181, 0.055, 0.106)), 7.0);
        for (int j = 0; j < 3; j++) {
          float toe = float(j) - 1.0;
          add(result, capsule(p,
            vec3(pedal + vec2(0.055, 0.085), side * 0.405),
            vec3(pedal + vec2(0.205 - abs(toe) * 0.027, 0.065), side * 0.405 + toe * 0.073),
            0.019), 7.0);
        }
      }
    }

    // Smooth white body, ascending neck, round head, and swept crown.
    if (box(p - vec3(-0.40, 3.00, 0), vec3(1.24, 1.13, 0.53)) < result.x) {
      vec3 b = p - vec3(-0.59, 2.55, 0);
      b.xy = rotate2(b.xy, -0.23);
      float white = ellipsoid(b, vec3(0.66, 0.60, 0.405));
      white = smoothMin(white, roundCone(p, vec3(-0.37, 2.82, 0), vec3(-0.15, 3.19, 0), 0.26, 0.175), 0.15);
      white = smoothMin(white, roundCone(p, vec3(-0.15, 3.16, 0), vec3(0.035, 3.52, 0), 0.175, 0.135), 0.12);
      white = smoothMin(white, capsule(p, vec3(0.035, 3.49, 0), vec3(0.29, 3.70, 0), 0.15), 0.10);
      white = smoothMin(white, ellipsoid(p - vec3(0.385, 3.735, 0), vec3(0.29, 0.255, 0.255)), 0.095);
      vec3 tail = p - vec3(-1.13, 2.52, 0);
      tail.xy = rotate2(tail.xy, -0.18);
      white = smoothMin(white, ellipsoid(tail, vec3(0.41, 0.16, 0.20)), 0.09);
      white = min(white, capsule(p, vec3(0.28, 3.94, 0), vec3(0.09, 4.075, 0.015), 0.025));
      white = min(white, capsule(p, vec3(0.35, 3.96, 0), vec3(0.20, 4.065, -0.055), 0.023));
      white = min(white, capsule(p, vec3(0.18, 3.92, 0), vec3(0.015, 4.01, 0.035), 0.023));
      add(result, white, 1.0);

      // Both eyes are modeled, with an amber orbital ring and tiny catchlight.
      vec3 eyeP = vec3(p.xy, abs(p.z));
      add(result, length(eyeP - vec3(0.49, 3.799, 0.231)) - 0.066, 6.0);
      add(result, length(eyeP - vec3(0.503, 3.805, 0.264)) - 0.046, 10.0);
      add(result, length(eyeP - vec3(0.514, 3.823, 0.302)) - 0.012, 11.0);
    }

    // Layered wings extend naturally onto the two handlebar grips.
    if (box(p - vec3(-0.22, 2.58, 0), vec3(1.22, 0.63, 0.68)) < result.x) {
      vec3 wp = vec3(p.xy, abs(p.z));
      vec3 wing = wp - vec3(-0.62, 2.56, 0.365);
      wing.xy = rotate2(wing.xy, -0.44);
      add(result, ellipsoid(wing, vec3(0.50, 0.355, 0.135)), 13.0);
      float arm = roundCone(wp, vec3(-0.29, 2.78, 0.35), vec3(0.17, 2.45, 0.47), 0.14, 0.105);
      arm = smoothMin(arm, roundCone(wp, vec3(0.17, 2.45, 0.47), vec3(0.85, 2.22, 0.43), 0.105, 0.052), 0.08);
      add(result, arm, 1.0);
      for (int i = 0; i < 3; i++) {
        float k = float(i);
        add(result, roundCone(wp,
          vec3(-0.68 - 0.105 * k, 2.55 - 0.060 * k, 0.466 - 0.020 * k),
          vec3(-1.05 - 0.105 * k, 2.25 + 0.030 * k, 0.374 - 0.025 * k),
          0.073, 0.027), 2.0);
      }
      add(result, capsule(wp, vec3(0.64, 2.30, 0.49), vec3(0.88, 2.205, 0.45), 0.031), 2.0);
    }

    // A wide, flat upper bill above the characteristic hanging throat pouch.
    if (box(p - vec3(1.22, 3.54, 0), vec3(0.81, 0.29, 0.24)) < result.x) {
      vec3 pouch = p - vec3(1.055, 3.485, 0);
      pouch.xy = rotate2(pouch.xy, -0.14);
      add(result, ellipsoid(pouch, vec3(0.585, 0.183, 0.143)), 14.0);
      vec3 bill = p - vec3(0.615, 3.676, 0);
      bill.y *= 2.65;
      add(result, roundCone(bill, vec3(0), vec3(1.335, -0.175, 0), 0.145, 0.013) / 2.65, 6.0);
      vec3 bp = vec3(p.xy, abs(p.z));
      add(result, capsule(bp, vec3(0.70, 3.632, 0.129), vec3(1.86, 3.600, 0.023), 0.007), 15.0);
      add(result, ellipsoid(bp - vec3(0.79, 3.685, 0.119), vec3(0.031, 0.009, 0.008)), 15.0);
    }
    return result;
  }

  vec3 normalAt(vec3 p, float epsilon) {
    vec2 e = vec2(epsilon, -epsilon);
    return normalize(
      e.xyy * scene(p + e.xyy).x +
      e.yyx * scene(p + e.yyx).x +
      e.yxy * scene(p + e.yxy).x +
      e.xxx * scene(p + e.xxx).x
    );
  }

  vec2 intersectBounds(vec3 ro, vec3 rd) {
    vec3 inv = sign(rd + vec3(1e-9)) / max(abs(rd), vec3(1e-8));
    vec3 a = (vec3(-1.70, -0.015, -0.73) - ro) * inv;
    vec3 b = (vec3(2.05, 4.15, 0.73) - ro) * inv;
    vec3 lo = min(a, b), hi = max(a, b);
    return vec2(max(lo.x, max(lo.y, lo.z)), min(hi.x, min(hi.y, hi.z)));
  }

  float shadow(vec3 p) {
    vec2 bounds = intersectBounds(p, LIGHT);
    float t = max(0.025, bounds.x);
    float end = min(bounds.y, 6.5);
    if (end <= t) return 1.0;
    float visibility = 1.0;
    for (int i = 0; i < 32; i++) {
      float h = scene(p + LIGHT * t).x;
      if (h < 0.0015) return 0.12;
      visibility = min(visibility, 9.0 * h / t);
      t += clamp(h, 0.027, 0.25);
      if (t > end) break;
    }
    return clamp(visibility, 0.12, 1.0);
  }

  float ambientOcclusion(vec3 p, vec3 n) {
    float sum = 0.0;
    float weight = 1.0;
    for (int i = 0; i < 3; i++) {
      float h = 0.035 + 0.075 * float(i);
      sum += max(h - scene(p + n * h).x, 0.0) * weight;
      weight *= 0.53;
    }
    return clamp(1.0 - 2.5 * sum, 0.3, 1.0);
  }

  vec3 baseColor(float m, vec3 p) {
    if (m < 1.5) return vec3(0.94, 0.925, 0.865);
    if (m < 2.5) return vec3(0.24, 0.285, 0.31);
    if (m < 3.5) {
      vec2 q = vec2(abs(p.x) - 1.30, p.y - 0.73);
      float tread = 0.5 + 0.5 * sin(atan(q.y, q.x) * 100.0 + uSpin * 5.0);
      return vec3(0.035, 0.052, 0.058) + tread * 0.009;
    }
    if (m < 4.5) return vec3(0.025, 0.40, 0.375);
    if (m < 5.5) return vec3(0.64, 0.73, 0.73);
    if (m < 6.5) return vec3(0.98, 0.59, 0.16);
    if (m < 7.5) return vec3(0.91, 0.35, 0.095);
    if (m < 8.5) return vec3(0.065, 0.086, 0.093);
    if (m < 9.5) return vec3(0.23, 0.095, 0.052);
    if (m < 10.5) return vec3(0.012, 0.023, 0.030);
    if (m < 11.5) return vec3(1.0);
    if (m < 12.5) return vec3(0.72, 0.61, 0.41);
    if (m < 13.5) return vec3(0.79, 0.81, 0.77);
    if (m < 14.5) {
      float vein = sin((p.x * 6.0 + p.y * 3.0) * 16.0) * 0.012;
      return vec3(1.0, 0.405 + vein, 0.13);
    }
    return vec3(0.39, 0.19, 0.055);
  }

  vec3 shadeObject(vec3 p, vec3 n, vec3 rd, float material, float epsilon) {
    vec3 base = baseColor(material, p);
    float metallic = (material > 4.5 && material < 5.5) ? 0.78 : 0.0;
    if (material > 3.5 && material < 4.5) metallic = 0.24;
    float glossy = material > 9.5 && material < 11.5 ? 1.0 : 0.0;
    float ao = ambientOcclusion(p, n);
    float visibility = shadow(p + n * max(0.008, epsilon * 3.0));
    float diffuse = max(dot(n, LIGHT), 0.0);
    vec3 sky = mix(vec3(0.29, 0.37, 0.35), vec3(0.74, 0.81, 0.85), n.y * 0.5 + 0.5);
    vec3 color = base * (sky * 0.52 * ao + vec3(1.0, 0.91, 0.73) * diffuse * visibility * 0.95);
    float fill = max(dot(n, normalize(vec3(0.8, 0.3, -0.6))), 0.0);
    color += base * vec3(0.20, 0.28, 0.31) * fill * ao;
    vec3 h = normalize(LIGHT - rd);
    float exponent = mix(32.0, 115.0, max(metallic, glossy));
    float specular = pow(max(dot(n, h), 0.0), exponent);
    vec3 specColor = mix(vec3(0.28), base * 0.8 + 0.2, metallic);
    color += specColor * specular * visibility * (0.40 + 1.2 * metallic + glossy);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
    color += vec3(0.38, 0.53, 0.56) * fresnel * (0.08 + metallic * 0.35) * ao;
    return color;
  }

  void main() {
    vec2 pixel = (2.0 * gl_FragCoord.xy - uResolution) / uResolution.y;
    vec3 forward = normalize(uTarget - uEye);
    vec3 right = normalize(cross(forward, vec3(0, 1, 0)));
    vec3 up = cross(right, forward);
    vec3 rd = normalize(forward + 0.365 * (right * pixel.x + up * pixel.y));

    float gradient = smoothstep(-0.4, 0.8, rd.y);
    vec3 color = mix(vec3(0.74, 0.85, 0.82), vec3(0.94, 0.925, 0.86), gradient);
    float floorT = rd.y < -0.00001 ? (-0.025 - uEye.y) / rd.y : 1e5;
    if (floorT <= 0.0) floorT = 1e5;

    vec2 bounds = intersectBounds(uEye, rd);
    float t = max(0.01, bounds.x);
    float end = min(bounds.y, floorT);
    bool hit = false;
    vec2 surface = vec2(0.0);
    float epsilon = 0.001;
    if (t < end) {
      for (int i = 0; i < 120; i++) {
        surface = scene(uEye + rd * t);
        epsilon = max(0.00055, t * 0.00019);
        if (surface.x < epsilon) {
          hit = true;
          break;
        }
        t += max(surface.x * 0.86, epsilon * 0.45);
        if (t > end) break;
      }
    }

    if (hit) {
      vec3 p = uEye + rd * t;
      vec3 n = normalAt(p, max(0.00045, epsilon * 0.65));
      color = shadeObject(p, n, rd, surface.y, epsilon);
      float fog = 1.0 - exp(-0.002 * t * t);
      color = mix(color, vec3(0.76, 0.85, 0.82), fog * 0.24);
    } else if (floorT < 1e4) {
      vec3 p = uEye + rd * floorT;
      float sh = shadow(p + vec3(0, 0.006, 0));
      float contact = exp(-dot(p.xz / vec2(1.65, 0.62), p.xz / vec2(1.65, 0.62)));
      vec3 ground = vec3(0.57, 0.725, 0.67);
      color = ground * (0.66 + 0.34 * sh) * (1.0 - 0.13 * contact);
      float fog = 1.0 - exp(-0.013 * max(floorT - 7.0, 0.0));
      color = mix(color, vec3(0.76, 0.85, 0.82), fog);
    }

    color = max(color, vec3(0.0));
    color = color / (0.82 + color * 0.33);
    color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
    vec2 screen = gl_FragCoord.xy / uResolution;
    float vignette = 1.0 - 0.105 * dot(screen - 0.5, screen - 0.5);
    outColor = vec4(color * vignette, 1.0);
  }`;

  let program = null;
  let vao = null;
  let uniforms = null;
  let lost = false;
  let disposed = false;
  let yaw = 0.43;
  let pitch = 0.13;
  let distance = 7.8;
  let lastTime = 0;
  const target = [0, 2.05, 0];
  const originalTabIndex = canvas.getAttribute("tabindex");
  const originalTouchAction = canvas.style.touchAction;
  const pointers = new Map();
  let gesture = null;

  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to create the pelican WebGL2 shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "Unknown shader error";
      gl.deleteShader(shader);
      throw new Error("Pelican SDF shader compilation failed: " + message);
    }
    return shader;
  }

  function initialize() {
    let vertex = null;
    let fragment = null;
    let nextProgram = null;
    try {
      vertex = compile(gl.VERTEX_SHADER, vertexSource);
      fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      nextProgram = gl.createProgram();
      if (!nextProgram) throw new Error("Unable to create the pelican WebGL2 program.");
      gl.attachShader(nextProgram, vertex);
      gl.attachShader(nextProgram, fragment);
      gl.linkProgram(nextProgram);
      if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
        throw new Error("Pelican SDF shader linking failed: " + gl.getProgramInfoLog(nextProgram));
      }
      const nextVao = gl.createVertexArray();
      if (!nextVao) throw new Error("Unable to create the pelican WebGL2 vertex array.");
      program = nextProgram;
      vao = nextVao;
      uniforms = {
        resolution: gl.getUniformLocation(program, "uResolution"),
        eye: gl.getUniformLocation(program, "uEye"),
        target: gl.getUniformLocation(program, "uTarget"),
        crank: gl.getUniformLocation(program, "uCrank"),
        spin: gl.getUniformLocation(program, "uSpin")
      };
    } catch (error) {
      if (nextProgram) gl.deleteProgram(nextProgram);
      throw error;
    } finally {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    }
  }

  initialize();

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function normalizeYaw(value) {
    return ((value + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  }

  function cameraBasis() {
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    return {
      eye: [
        target[0] + distance * sy * cp,
        target[1] + distance * sp,
        target[2] + distance * cy * cp
      ],
      right: [cy, 0, -sy],
      up: [-sy * sp, cp, -cy * sp]
    };
  }

  function render(timeSeconds) {
    if (disposed || lost || gl.isContextLost()) return;
    lastTime = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const width = canvas.width;
    const height = canvas.height;
    if (width < 1 || height < 1) return;
    const camera = cameraBasis();
    const angle = (lastTime % (Math.PI * 2 / 0.95)) * 0.95 - 0.48;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.colorMask(true, true, true, true);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform3f(uniforms.eye, camera.eye[0], camera.eye[1], camera.eye[2]);
    gl.uniform3f(uniforms.target, target[0], target[1], target[2]);
    gl.uniform2f(uniforms.crank, 0.28 * Math.cos(angle), 0.28 * Math.sin(angle));
    gl.uniform1f(uniforms.spin, (lastTime % (Math.PI * 2 / 0.49)) * 0.49);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  function setView(nextYaw, nextPitch, nextDistance) {
    if (disposed) return;
    if (Number.isFinite(nextYaw)) yaw = normalizeYaw(nextYaw);
    if (Number.isFinite(nextPitch)) pitch = clamp(nextPitch, -1.46, 1.46);
    if (Number.isFinite(nextDistance)) distance = clamp(nextDistance, 0.7, 24);
    target[0] = 0;
    target[1] = 2.05;
    target[2] = 0;
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  function redraw() {
    render(lastTime);
  }

  function panPixels(dx, dy) {
    const rect = canvas.getBoundingClientRect();
    const scale = distance * 0.73 / Math.max(1, rect.height);
    const basis = cameraBasis();
    for (let i = 0; i < 3; i++) {
      target[i] += (-basis.right[i] * dx + basis.up[i] * dy) * scale;
    }
  }

  function zoom(factor, x, y) {
    const oldDistance = distance;
    distance = clamp(distance * factor, 0.7, 24);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const rect = canvas.getBoundingClientRect();
    const h = Math.max(rect.height, 1);
    const px = (2 * (x - rect.left) - rect.width) / h;
    const py = (rect.height - 2 * (y - rect.top)) / h;
    const basis = cameraBasis();
    const shift = (oldDistance - distance) * 0.365;
    for (let i = 0; i < 3; i++) {
      target[i] += shift * (px * basis.right[i] + py * basis.up[i]);
    }
  }

  function gestureState() {
    const points = Array.from(pointers.values());
    if (points.length === 0) return null;
    if (points.length === 1) {
      return { x: points[0].x, y: points[0].y, spread: 0, count: 1 };
    }
    return {
      x: (points[0].x + points[1].x) * 0.5,
      y: (points[0].y + points[1].y) * 0.5,
      spread: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      count: 2
    };
  }

  function onPointerDown(event) {
    if (disposed) return;
    event.preventDefault();
    try { canvas.focus({ preventScroll: true }); } catch (_) { canvas.focus(); }
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pan: event.shiftKey || event.button === 1 || event.button === 2
    });
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    gesture = gestureState();
  }

  function onPointerMove(event) {
    const point = pointers.get(event.pointerId);
    if (!point || disposed) return;
    event.preventDefault();
    point.x = event.clientX;
    point.y = event.clientY;
    const next = gestureState();
    if (gesture && next && gesture.count === next.count) {
      const dx = next.x - gesture.x;
      const dy = next.y - gesture.y;
      if (next.count === 2) {
        panPixels(dx, dy);
        if (gesture.spread > 1 && next.spread > 1) {
          zoom(gesture.spread / next.spread, next.x, next.y);
        }
      } else if (point.pan || event.shiftKey) {
        panPixels(dx, dy);
      } else {
        yaw = normalizeYaw(yaw - dx * 0.007);
        pitch = clamp(pitch + dy * 0.006, -1.46, 1.46);
      }
    }
    gesture = next;
    redraw();
  }

  function onPointerEnd(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    gesture = gestureState();
  }

  function onWheel(event) {
    if (disposed) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(1, canvas.clientHeight) : 1;
    zoom(Math.exp(clamp(event.deltaY * unit * 0.0013, -0.65, 0.65)), event.clientX, event.clientY);
    redraw();
  }

  function onKeyDown(event) {
    if (disposed) return;
    let handled = true;
    const amount = event.shiftKey ? 0.15 : 0.065;
    switch (event.key) {
      case "ArrowLeft": yaw = normalizeYaw(yaw - amount); break;
      case "ArrowRight": yaw = normalizeYaw(yaw + amount); break;
      case "ArrowUp": pitch = clamp(pitch + amount, -1.46, 1.46); break;
      case "ArrowDown": pitch = clamp(pitch - amount, -1.46, 1.46); break;
      case "+":
      case "=": zoom(0.88); break;
      case "-":
      case "_": zoom(1 / 0.88); break;
      case "Home":
        setView(0.43, 0.13, 7.8);
        break;
      default: handled = false;
    }
    if (handled) {
      event.preventDefault();
      redraw();
    }
  }

  function onContextMenu(event) { event.preventDefault(); }
  function onContextLost(event) {
    event.preventDefault();
    lost = true;
    program = null;
    vao = null;
    uniforms = null;
  }
  function onContextRestored() {
    if (disposed) return;
    try {
      initialize();
      lost = false;
      redraw();
    } catch (_) {
      lost = true;
    }
  }

  canvas.tabIndex = Math.max(0, canvas.tabIndex);
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerEnd);
  canvas.addEventListener("pointercancel", onPointerEnd);
  canvas.addEventListener("lostpointercapture", onPointerEnd);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerEnd);
    canvas.removeEventListener("pointercancel", onPointerEnd);
    canvas.removeEventListener("lostpointercapture", onPointerEnd);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    for (const id of pointers.keys()) {
      try { canvas.releasePointerCapture(id); } catch (_) {}
    }
    pointers.clear();
    gesture = null;
    if (originalTabIndex === null) canvas.removeAttribute("tabindex");
    else canvas.setAttribute("tabindex", originalTabIndex);
    canvas.style.touchAction = originalTouchAction;
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
    vao = null;
    program = null;
    uniforms = null;
  }

  return { render, setView, getView, dispose };
}
