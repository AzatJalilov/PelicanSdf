export function createPelicanSdf(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError("createPelicanSdf requires an HTMLCanvasElement");
  }

  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl) throw new Error("WebGL2 is required to render the pelican SDF artwork");

  const vertexSource = `#version 300 es
  precision highp float;
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;

  uniform vec2 uResolution;
  uniform vec3 uCamera;
  uniform float uTime;
  out vec4 fragColor;

  const float PI = 3.14159265359;

  float capsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 ab = b - a;
    return length(p - a - ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0)) - r;
  }

  float tapered(vec3 p, vec3 a, vec3 b, float ra, float rb) {
    vec3 ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - a - ab * t) - mix(ra, rb, t);
  }

  float ellipsoid(vec3 p, vec3 c, vec3 r) {
    return (length((p - c) / r) - 1.0) * min(min(r.x, r.y), r.z);
  }

  float boxSdf(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float wheel(vec3 p, float x, float spin) {
    vec3 q = p - vec3(x, 0.65, 0.0);
    float radial = length(q.xy);
    float tire = length(vec2(radial - 0.61, q.z)) - 0.061;
    float rim = length(vec2(radial - 0.545, q.z)) - 0.017;
    float hub = capsule(q, vec3(0.0, 0.0, -0.125), vec3(0.0, 0.0, 0.125), 0.071);
    float interval = PI / 6.0;
    float angle = mod(atan(q.y, q.x) - spin + interval * 0.5, interval) - interval * 0.5;
    float spoke = boxSdf(vec3(radial * sin(angle), radial - 0.302, q.z),
                         vec3(0.012, 0.248, 0.013));
    return min(min(tire, rim), min(hub, spoke));
  }

  vec2 add(vec2 a, float d, float material) {
    return d < a.x ? vec2(d, material) : a;
  }

  vec2 scene(vec3 p) {
    float floorD = p.y + 0.035;
    float bound = length(p - vec3(0.0, 1.56, 0.0)) - 2.72;
    if (bound > 0.38) return vec2(min(bound, floorD), floorD < bound ? 10.0 : 0.0);

    vec2 s = vec2(100.0, 0.0);
    float spin = uTime * 0.65;

    // Wheels, with actual tire, rim, hub, and twelve radial spokes each.
    s = add(s, wheel(p, -1.35, spin), 1.0);
    s = add(s, wheel(p,  1.35, spin), 1.0);

    // Connected bicycle frame.
    vec3 rear = vec3(-1.35, 0.65, 0.0);
    vec3 front = vec3(1.35, 0.65, 0.0);
    vec3 crank = vec3(-0.25, 0.70, 0.0);
    vec3 seatTube = vec3(-0.53, 1.61, 0.0);
    vec3 headTube = vec3(0.76, 1.57, 0.0);
    float frame = capsule(p, rear, seatTube, 0.042);
    frame = min(frame, capsule(p, rear, crank, 0.043));
    frame = min(frame, capsule(p, seatTube, crank, 0.048));
    frame = min(frame, capsule(p, seatTube, headTube, 0.043));
    frame = min(frame, capsule(p, headTube, crank, 0.049));
    frame = min(frame, capsule(p, headTube, front, 0.046));
    s = add(s, frame, 2.0);

    // Fork blades and handlebar.
    for (int side = -1; side <= 1; side += 2) {
      float z = float(side);
      s = add(s, capsule(p, vec3(0.78, 1.54, 0.055 * z),
                            vec3(1.35, 0.65, 0.095 * z), 0.028), 3.0);
      s = add(s, capsule(p, vec3(0.84, 1.93, 0.0),
                            vec3(0.58, 1.96, 0.36 * z), 0.029), 3.0);
      s = add(s, capsule(p, vec3(0.58, 1.96, 0.36 * z),
                            vec3(0.49, 1.86, 0.36 * z), 0.032), 3.0);
    }
    s = add(s, capsule(p, headTube, vec3(0.84, 1.93, 0.0), 0.033), 3.0);
    s = add(s, ellipsoid(p, vec3(-0.64, 1.74, 0.0),
                            vec3(0.29, 0.064, 0.19)), 4.0);
    s = add(s, capsule(p, seatTube, vec3(-0.60, 1.72, 0.0), 0.028), 3.0);

    // Crank, chainring, opposed crank arms, and broad pedals.
    vec3 cq = p - crank;
    s = add(s, length(vec2(length(cq.xy) - 0.205, cq.z - 0.105)) - 0.018, 3.0);
    s = add(s, capsule(p, vec3(-0.25, 0.70, 0.15),
                            vec3(-0.075, 0.55, 0.21), 0.026), 3.0);
    s = add(s, capsule(p, vec3(-0.25, 0.70, -0.15),
                            vec3(-0.425, 0.85, -0.21), 0.026), 3.0);
    s = add(s, boxSdf(p - vec3(-0.075, 0.55, 0.24),
                      vec3(0.15, 0.025, 0.085)), 4.0);
    s = add(s, boxSdf(p - vec3(-0.425, 0.85, -0.24),
                      vec3(0.15, 0.025, 0.085)), 4.0);

    // Cream body, curved neck, and round head.
    s = add(s, ellipsoid(p, vec3(-0.45, 2.15, 0.0),
                            vec3(0.67, 0.44, 0.39)), 5.0);
    s = add(s, tapered(p, vec3(-0.10, 2.20, 0.0),
                         vec3(0.08, 2.87, 0.0), 0.205, 0.145), 5.0);
    s = add(s, ellipsoid(p, vec3(0.09, 3.00, 0.0),
                            vec3(0.29, 0.285, 0.255)), 5.0);

    // Folded wings and separate feather tips, visible on both sides.
    for (int side = -1; side <= 1; side += 2) {
      float z = float(side);
      s = add(s, ellipsoid(p, vec3(-0.55, 2.19, 0.345 * z),
                              vec3(0.49, 0.215, 0.105)), 6.0);
      for (int i = 0; i < 3; ++i) {
        float fi = float(i);
        s = add(s, tapered(p, vec3(-0.72 + fi * 0.10, 2.17 - fi * 0.06, 0.39 * z),
                             vec3(-1.13 + fi * 0.08, 2.04 - fi * 0.075, 0.39 * z),
                             0.072, 0.012), 6.0);
      }
      s = add(s, ellipsoid(p, vec3(0.155, 3.105, 0.223 * z),
                              vec3(0.093, 0.090, 0.046)), 7.0);
      s = add(s, ellipsoid(p, vec3(0.196, 3.107, 0.262 * z),
                              vec3(0.034, 0.048, 0.021)), 8.0);
    }

    // Long tapered bill and full hanging throat pouch.
    s = add(s, tapered(p, vec3(0.25, 2.99, 0.0),
                         vec3(1.57, 2.91, 0.0), 0.090, 0.036), 9.0);
    s = add(s, ellipsoid(p, vec3(0.86, 2.735, 0.0),
                            vec3(0.63, 0.235, 0.235)), 11.0);
    s = add(s, tapered(p, vec3(0.35, 2.93, 0.0),
                         vec3(1.45, 2.885, 0.0), 0.037, 0.014), 9.0);
    s = add(s, ellipsoid(p, vec3(1.57, 2.91, 0.0),
                            vec3(0.071, 0.041, 0.052)), 12.0);

    // Two orange legs reach opposite pedals.
    s = add(s, tapered(p, vec3(-0.36, 1.86, 0.25),
                         vec3(0.18, 1.37, 0.30), 0.100, 0.073), 12.0);
    s = add(s, tapered(p, vec3(0.18, 1.37, 0.30),
                         vec3(-0.085, 0.70, 0.26), 0.073, 0.043), 12.0);
    s = add(s, tapered(p, vec3(-0.43, 1.85, -0.25),
                         vec3(-0.76, 1.38, -0.30), 0.096, 0.068), 12.0);
    s = add(s, tapered(p, vec3(-0.76, 1.38, -0.30),
                         vec3(-0.43, 0.94, -0.27), 0.068, 0.043), 12.0);
    s = add(s, ellipsoid(p, vec3(-0.005, 0.663, 0.26),
                            vec3(0.20, 0.052, 0.086)), 12.0);
    s = add(s, ellipsoid(p, vec3(-0.34, 0.89, -0.27),
                            vec3(0.18, 0.049, 0.08)), 12.0);

    return add(s, floorD, 10.0);
  }

  vec3 normalAt(vec3 p) {
    vec2 e = vec2(0.0016, 0.0);
    return normalize(vec3(
      scene(p + e.xyy).x - scene(p - e.xyy).x,
      scene(p + e.yxy).x - scene(p - e.yxy).x,
      scene(p + e.yyx).x - scene(p - e.yyx).x
    ));
  }

  vec3 material(float id) {
    if (id < 1.5) return vec3(0.105, 0.135, 0.16);
    if (id < 2.5) return vec3(0.15, 0.55, 0.68);
    if (id < 3.5) return vec3(0.76, 0.85, 0.84);
    if (id < 4.5) return vec3(0.20, 0.29, 0.34);
    if (id < 5.5) return vec3(0.98, 0.91, 0.72);
    if (id < 6.5) return vec3(0.89, 0.77, 0.54);
    if (id < 7.5) return vec3(1.0, 0.98, 0.87);
    if (id < 8.5) return vec3(0.045, 0.075, 0.09);
    if (id < 9.5) return vec3(1.0, 0.67, 0.20);
    if (id < 10.5) return vec3(0.69, 0.79, 0.73);
    if (id < 11.5) return vec3(0.99, 0.64, 0.34);
    return vec3(0.98, 0.46, 0.23);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
    vec3 target = vec3(0.0, 1.62, 0.0);
    vec3 ro = target + uCamera;
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 rd = normalize(forward * 1.80 + right * uv.x + up * uv.y);

    float skyMix = smoothstep(-0.7, 0.8, rd.y);
    vec3 color = mix(vec3(0.90, 0.94, 0.88),
                     vec3(0.45, 0.70, 0.79), skyMix);
    color += vec3(0.11, 0.09, 0.04) *
             pow(max(dot(rd, normalize(vec3(-0.55, 0.62, -0.55))), 0.0), 18.0);

    float t = 0.04;
    vec2 hit = vec2(1.0, 0.0);
    for (int i = 0; i < 105; ++i) {
      vec3 p = ro + rd * t;
      hit = scene(p);
      if (hit.x < 0.0015 + t * 0.00018 || t > 18.0) break;
      t += max(hit.x * 0.82, 0.003);
    }

    if (t <= 18.0 && hit.x < 0.012) {
      vec3 p = ro + rd * t;
      vec3 n = normalAt(p);
      vec3 light = normalize(vec3(-0.46, 0.83, 0.51));
      float diffuse = max(dot(n, light), 0.0);
      float fill = max(dot(n, normalize(vec3(0.58, 0.37, -0.74))), 0.0);
      vec3 base = material(hit.y);

      if (hit.y > 9.5 && hit.y < 10.5) {
        float d1 = length(vec2(p.x * 0.49, p.z * 0.95));
        float d2 = length(vec2((p.x + 0.45) * 0.60, p.z * 0.8));
        float shadow = 0.28 * exp(-2.9 * d1 * d1)
                     + 0.18 * exp(-3.3 * d2 * d2);
        base *= 1.0 - shadow;
        float grid = sin(p.x * 2.0) * sin(p.z * 2.0);
        base *= 1.0 + grid * 0.025;
      }

      color = base * (0.46 + 0.48 * diffuse + 0.12 * fill);
      float specPower = hit.y < 4.5 ? 44.0 : 22.0;
      float spec = pow(max(dot(reflect(-light, n), -rd), 0.0), specPower);
      color += vec3(1.0, 0.96, 0.82) * spec * (hit.y < 4.5 ? 0.24 : 0.12);
      color += base * vec3(0.07, 0.13, 0.14) *
               pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
      color = mix(color, vec3(0.69, 0.81, 0.79),
                  0.045 * smoothstep(5.0, 17.0, t));
    }

    color = pow(max(color, 0.0), vec3(0.91));
    fragColor = vec4(color, 1.0);
  }`;

  let program = null;
  let vao = null;
  let resolutionLocation = null;
  let cameraLocation = null;
  let timeLocation = null;
  let lost = false;
  let disposed = false;
  let lastTime = 0;
  let yaw = 0.48;
  let pitch = 0.16;
  let distance = 6.4;

  function compile(type, source) {
    const shader = gl.createShader(type);
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
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    let fragment;
    try {
      fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error("Pelican SDF shader link failed: " +
                        (gl.getProgramInfoLog(program) || "Unknown link error"));
      }
      vao = gl.createVertexArray();
      resolutionLocation = gl.getUniformLocation(program, "uResolution");
      cameraLocation = gl.getUniformLocation(program, "uCamera");
      timeLocation = gl.getUniformLocation(program, "uTime");
    } catch (error) {
      if (program) gl.deleteProgram(program);
      program = null;
      throw error;
    } finally {
      gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    }
  }

  function release() {
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
    vao = null;
    program = null;
  }

  initialize();

  function render(timeSeconds) {
    if (disposed || lost || gl.isContextLost() || !program) return;
    if (Number.isFinite(timeSeconds)) lastTime = timeSeconds;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (!width || !height) return;
    const cp = Math.cos(pitch);
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(resolutionLocation, width, height);
    gl.uniform3f(
      cameraLocation,
      distance * Math.sin(yaw) * cp,
      distance * Math.sin(pitch),
      distance * Math.cos(yaw) * cp
    );
    gl.uniform1f(timeLocation, lastTime);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setView(newYaw, newPitch, newDistance) {
    if (Number.isFinite(newYaw)) yaw = newYaw;
    if (Number.isFinite(newPitch)) {
      pitch = Math.max(-1.38, Math.min(1.38, newPitch));
    }
    if (Number.isFinite(newDistance)) {
      distance = Math.max(1.0, Math.min(14.0, newDistance));
    }
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  function redraw() {
    render(lastTime);
  }

  const priorTabIndex = canvas.getAttribute("tabindex");
  const priorTouchAction = canvas.style.touchAction;
  canvas.tabIndex = 0;
  canvas.style.touchAction = "none";

  const pointers = new Map();
  let pinchDistance = 0;

  function pointerDown(event) {
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchDistance = 0;
    event.preventDefault();
  }

  function pointerMove(event) {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      const scale = Math.max(120, Math.min(canvas.clientWidth || 400,
                                           canvas.clientHeight || 400));
      setView(yaw + dx * 3.2 / scale, pitch + dy * 3.2 / scale, distance);
    } else if (pointers.size >= 2) {
      const pair = Array.from(pointers.values());
      const current = Math.hypot(pair[0].x - pair[1].x,
                                 pair[0].y - pair[1].y);
      if (pinchDistance > 0 && current > 0) {
        setView(yaw, pitch, distance * pinchDistance / current);
      }
      pinchDistance = current;
    }
    redraw();
    event.preventDefault();
  }

  function pointerUp(event) {
    pointers.delete(event.pointerId);
    pinchDistance = 0;
    event.preventDefault();
  }

  function wheel(event) {
    setView(yaw, pitch, distance * Math.exp(event.deltaY * 0.0012));
    redraw();
    event.preventDefault();
  }

  function keyDown(event) {
    let handled = true;
    switch (event.key) {
      case "ArrowLeft": setView(yaw - 0.085, pitch, distance); break;
      case "ArrowRight": setView(yaw + 0.085, pitch, distance); break;
      case "ArrowUp": setView(yaw, pitch - 0.085, distance); break;
      case "ArrowDown": setView(yaw, pitch + 0.085, distance); break;
      case "+":
      case "=": setView(yaw, pitch, distance / 1.12); break;
      case "-":
      case "_": setView(yaw, pitch, distance * 1.12); break;
      default: handled = false;
    }
    if (handled) {
      event.preventDefault();
      redraw();
    }
  }

  function contextLost(event) {
    event.preventDefault();
    lost = true;
    program = null;
    vao = null;
  }

  function contextRestored() {
    if (disposed) return;
    try {
      initialize();
      lost = false;
      redraw();
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
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", contextRestored);

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
    if (priorTabIndex === null) canvas.removeAttribute("tabindex");
    else canvas.setAttribute("tabindex", priorTabIndex);
    canvas.style.touchAction = priorTouchAction;
    pointers.clear();
    if (!lost && !gl.isContextLost()) release();
  }

  return { render, setView, getView, dispose };
}
