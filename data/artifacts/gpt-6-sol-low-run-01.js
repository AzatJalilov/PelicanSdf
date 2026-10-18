export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl) throw new Error("WebGL2 is required for createPelicanSdf");

  const vertexSource = `#version 300 es
  precision highp float;
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  out vec4 outColor;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uEye;
  uniform vec3 uRight;
  uniform vec3 uUp;
  uniform vec3 uForward;

  const float PI = 3.14159265359;

  vec2 add(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

  float capsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 q = b - a;
    return length(p - a - q * clamp(dot(p-a,q)/dot(q,q),0.0,1.0)) - r;
  }

  float ellipsoid(vec3 p, vec3 r) {
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0*(k0-1.0)/k1;
  }

  float wheel(vec3 p, float x) {
    vec3 q = p - vec3(x,0.79,0.0);
    float radial = length(q.xy);
    float d = length(vec2(radial-0.66,q.z))-0.073;
    d = min(d, length(vec2(radial-0.57,q.z))-0.023);
    d = min(d, length(q/vec3(0.105,0.105,0.14))-1.0 > 0.0
      ? ellipsoid(q,vec3(0.105,0.105,0.14)) : -0.01);
    if (radial < 0.68 && abs(q.z) < 0.12) {
      float a = atan(q.y,q.x) - uTime*1.7;
      float sector = 2.0*PI/14.0;
      a = mod(a + sector*0.5,sector)-sector*0.5;
      float spoke = length(vec2(radial*sin(a),
        max(abs(radial*cos(a)-0.35)-0.26,0.0)));
      d = min(d,length(vec2(spoke,q.z))-0.012);
    }
    return d;
  }

  vec2 scene(vec3 p) {
    vec2 h = vec2(p.y+0.075,1.0);
    if (p.y < 3.55 && abs(p.x) < 3.2 && abs(p.z) < 1.1) {
      float tires = min(wheel(p,-1.24),wheel(p,1.24));
      h = add(h,vec2(tires,2.0));

      float frame = 1e5;
      vec3 rear = vec3(-1.24,0.79,0.0);
      vec3 crank = vec3(-0.14,0.80,0.0);
      vec3 seatTube = vec3(-0.43,1.54,0.0);
      vec3 head = vec3(0.75,1.54,0.0);
      vec3 front = vec3(1.24,0.79,0.0);
      frame = min(frame,capsule(p,rear,crank,0.047));
      frame = min(frame,capsule(p,rear,seatTube,0.047));
      frame = min(frame,capsule(p,crank,seatTube,0.049));
      frame = min(frame,capsule(p,seatTube,head,0.046));
      frame = min(frame,capsule(p,crank,head,0.049));
      frame = min(frame,capsule(p,head,front,0.053));
      frame = min(frame,capsule(p,head,vec3(0.66,1.81,0),0.052));
      frame = min(frame,capsule(p,vec3(0.66,1.81,0),vec3(1.02,1.91,0),0.045));
      frame = min(frame,capsule(p,vec3(1.02,1.91,-0.27),
                                   vec3(1.02,1.91,0.27),0.043));
      h = add(h,vec2(frame,3.0));

      float metal = capsule(p,vec3(-0.14,0.80,-0.20),
                             vec3(-0.14,0.80,0.20),0.105);
      metal = min(metal,capsule(p,vec3(-0.43,1.54,0),
                                 vec3(-0.49,1.68,0),0.036));
      h = add(h,vec2(metal,4.0));

      float saddle = ellipsoid(p-vec3(-0.53,1.70,0),
                              vec3(0.31,0.065,0.18));
      h = add(h,vec2(saddle,5.0));

      float a = uTime*1.7;
      for (int i=0; i<2; i++) {
        float side = i==0 ? -1.0 : 1.0;
        vec3 foot = vec3(-0.14+0.23*cos(a+float(i)*PI),
                          0.80+0.23*sin(a+float(i)*PI),
                          side*0.27);
        float arm = capsule(p,vec3(-0.14,0.80,side*0.13),
                             foot,0.034);
        float pedal = capsule(p,foot+vec3(0,0,-0.10),
                               foot+vec3(0,0,0.10),0.052);
        h = add(h,vec2(min(arm,pedal),4.0));

        vec3 hip = vec3(-0.38,1.88,side*0.22);
        vec3 knee = vec3(-0.16+0.12*cos(a+float(i)*PI),
                         1.38+0.07*sin(a+float(i)*PI),
                         side*0.32);
        float leg = min(capsule(p,hip,knee,0.105),
                        capsule(p,knee,foot+vec3(0,0,side*0.025),0.074));
        h = add(h,vec2(leg,6.0));
        h = add(h,vec2(ellipsoid(p-(foot+vec3(0.105,0.035,side*0.02)),
                                  vec3(0.19,0.055,0.105)),7.0));
      }

      float body = ellipsoid(p-vec3(-0.37,2.16,0),
                             vec3(0.70,0.43,0.39));
      body = min(body,capsule(p,vec3(0.00,2.19,0),
                               vec3(0.33,2.44,0),0.22));
      body = min(body,capsule(p,vec3(0.33,2.44,0),
                               vec3(0.48,2.86,0),0.17));
      body = min(body,ellipsoid(p-vec3(0.59,2.94,0),
                                vec3(0.29,0.30,0.27)));
      h = add(h,vec2(body,8.0));

      for (int i=0; i<2; i++) {
        float side = i==0 ? -1.0 : 1.0;
        float wing = ellipsoid(p-vec3(-0.51,2.19,side*0.325),
                               vec3(0.48,0.21,0.105));
        h = add(h,vec2(wing,9.0));
        for (int j=0; j<3; j++) {
          float f = float(j);
          float feather = capsule(p,
            vec3(-0.68-f*0.11,2.18-f*0.035,side*0.38),
            vec3(-1.03-f*0.10,2.06-f*0.047,side*0.40),
            0.055);
          h = add(h,vec2(feather,9.0));
        }
        float eye = ellipsoid(p-vec3(0.69,3.015,side*0.235),
                              vec3(0.065,0.075,0.034));
        h = add(h,vec2(eye,10.0));
        float pupil = ellipsoid(p-vec3(0.714,3.014,side*0.264),
                                vec3(0.026,0.039,0.019));
        h = add(h,vec2(pupil,11.0));
      }

      float bill = capsule(p,vec3(0.79,2.86,0),
                            vec3(1.93,2.72,0),0.076);
      bill = min(bill,capsule(p,vec3(0.81,2.80,0),
                               vec3(1.88,2.68,0),0.048));
      h = add(h,vec2(bill,12.0));
      float pouch = ellipsoid(p-vec3(1.35,2.59,0),
                               vec3(0.56,0.19,0.17));
      pouch = max(pouch,-capsule(p,vec3(0.88,2.79,0),
                                  vec3(1.89,2.67,0),0.025));
      h = add(h,vec2(pouch,13.0));
      float nostril = ellipsoid(p-vec3(0.94,2.925,0.075),
                                 vec3(0.035,0.019,0.014));
      h = add(h,vec2(nostril,11.0));
    }
    return h;
  }

  vec3 normalAt(vec3 p) {
    vec2 e = vec2(0.0015,0);
    return normalize(vec3(
      scene(p+e.xyy).x-scene(p-e.xyy).x,
      scene(p+e.yxy).x-scene(p-e.yxy).x,
      scene(p+e.yyx).x-scene(p-e.yyx).x));
  }

  vec3 material(float id, vec3 p) {
    if (id < 1.5) {
      float lines = smoothstep(0.92,0.98,
        abs(sin(p.x*1.6)*sin(p.z*1.6)));
      return mix(vec3(0.78,0.83,0.72),vec3(0.69,0.77,0.66),lines);
    }
    if (id < 2.5) return vec3(0.12,0.17,0.19);
    if (id < 3.5) return vec3(0.16,0.63,0.66);
    if (id < 4.5) return vec3(0.88,0.77,0.48);
    if (id < 5.5) return vec3(0.34,0.18,0.14);
    if (id < 6.5) return vec3(0.96,0.73,0.29);
    if (id < 7.5) return vec3(0.94,0.52,0.20);
    if (id < 8.5) return vec3(0.97,0.94,0.81);
    if (id < 9.5) return vec3(0.85,0.86,0.74);
    if (id < 10.5) return vec3(1.0,0.99,0.91);
    if (id < 11.5) return vec3(0.11,0.17,0.18);
    if (id < 12.5) return vec3(0.98,0.69,0.20);
    return vec3(0.96,0.55,0.29);
  }

  float shadow(vec3 p, vec3 lightDir) {
    float shade = 1.0;
    float t = 0.025;
    for (int i=0; i<16; i++) {
      float d = scene(p+lightDir*t).x;
      shade = min(shade,12.0*d/t);
      t += clamp(d,0.035,0.28);
      if (t>4.0) break;
    }
    return clamp(shade,0.35,1.0);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy-0.5*uResolution)/uResolution.y;
    vec3 rd = normalize(uForward*1.75 + uRight*uv.x + uUp*uv.y);
    vec3 sky = mix(vec3(0.96,0.88,0.73),vec3(0.56,0.78,0.86),
                   smoothstep(-0.25,0.65,rd.y));
    float sun = pow(max(dot(rd,normalize(vec3(-0.50,0.65,-0.55))),0.0),70.0);
    sky += vec3(1.0,0.70,0.32)*sun*0.27;

    float t = 0.0;
    vec2 hit = vec2(1e5,0.0);
    for (int i=0; i<105; i++) {
      vec3 p = uEye+rd*t;
      hit = scene(p);
      if (hit.x < 0.0015 || t > 35.0) break;
      t += max(hit.x*0.88,0.012);
    }

    vec3 color = sky;
    if (hit.x < 0.003 && t < 35.0) {
      vec3 p = uEye+rd*t;
      vec3 n = normalAt(p);
      vec3 lightDir = normalize(vec3(-0.55,0.85,0.65));
      float diffuse = max(dot(n,lightDir),0.0);
      float sh = shadow(p+n*0.012,lightDir);
      float ambient = 0.56+0.18*n.y;
      vec3 base = material(hit.y,p);
      color = base*(ambient+0.55*diffuse*sh);
      float rim = pow(1.0-max(dot(n,-rd),0.0),3.0);
      color += vec3(1.0,0.81,0.54)*rim*0.12;
      if (hit.y>1.5 && hit.y<5.0) {
        vec3 reflected = reflect(rd,n);
        color += vec3(0.48,0.74,0.79)*
          pow(max(dot(reflected,lightDir),0.0),25.0)*0.18*sh;
      }
      float fog = 1.0-exp(-0.003*t*t);
      color = mix(color,sky,fog);
    }
    color = pow(color,vec3(0.88));
    outColor = vec4(color,1.0);
  }`;

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

  let program, vertexShader, fragmentShader, vao;
  try {
    vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
    fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Pelican SDF program linking failed: " +
        (gl.getProgramInfoLog(program) || "unknown linker error"));
    vao = gl.createVertexArray();
  } catch (error) {
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    throw error;
  }

  const uniforms = {
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    eye: gl.getUniformLocation(program, "uEye"),
    right: gl.getUniformLocation(program, "uRight"),
    up: gl.getUniformLocation(program, "uUp"),
    forward: gl.getUniformLocation(program, "uForward")
  };

  let yaw = 0.48;
  let pitch = 0.21;
  let distance = 6.4;
  let lost = false;
  let disposed = false;
  const pointers = new Map();
  let previousPinch = 0;

  canvas.tabIndex = canvas.tabIndex < 0 ? 0 : canvas.tabIndex;
  canvas.style.touchAction = "none";

  function clampView() {
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
    distance = Math.max(1.45, Math.min(17, distance));
  }

  function setView(nextYaw, nextPitch, nextDistance) {
    if (Number.isFinite(nextYaw)) yaw = nextYaw;
    if (Number.isFinite(nextPitch)) pitch = nextPitch;
    if (Number.isFinite(nextDistance)) distance = nextDistance;
    clampView();
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  function onPointerDown(event) {
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    previousPinch = 0;
    event.preventDefault();
  }

  function onPointerMove(event) {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      yaw += (event.clientX - previous.x) * 0.008;
      pitch += (event.clientY - previous.y) * 0.008;
      clampView();
    } else if (pointers.size >= 2) {
      const pair = Array.from(pointers.values()).slice(0, 2);
      const pinch = Math.hypot(pair[0].x-pair[1].x, pair[0].y-pair[1].y);
      if (previousPinch > 0) {
        distance *= previousPinch / Math.max(1, pinch);
        clampView();
      }
      previousPinch = pinch;
    }
    event.preventDefault();
  }

  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    previousPinch = 0;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onWheel(event) {
    distance *= Math.exp(event.deltaY * 0.0012);
    clampView();
    event.preventDefault();
  }

  function onKeyDown(event) {
    let handled = true;
    if (event.key === "ArrowLeft") yaw -= 0.09;
    else if (event.key === "ArrowRight") yaw += 0.09;
    else if (event.key === "ArrowUp") pitch -= 0.09;
    else if (event.key === "ArrowDown") pitch += 0.09;
    else if (event.key === "+" || event.key === "=") distance *= 0.89;
    else if (event.key === "-" || event.key === "_") distance *= 1.12;
    else handled = false;
    if (handled) {
      clampView();
      event.preventDefault();
    }
  }

  function onContextLost(event) {
    event.preventDefault();
    lost = true;
  }

  function onContextRestored() {
    lost = true;
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  function render(timeSeconds) {
    if (disposed || lost || gl.isContextLost()) return;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const target = [0.20, 1.48, 0];
    const eye = [
      target[0] + distance*sy*cp,
      target[1] + distance*sp,
      target[2] + distance*cy*cp
    ];
    const forward = [-sy*cp, -sp, -cy*cp];
    const right = [cy, 0, -sy];
    const up = [-sy*sp, cp, -cy*sp];

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, Number.isFinite(timeSeconds) ? timeSeconds : 0);
    gl.uniform3fv(uniforms.eye, eye);
    gl.uniform3fv(uniforms.forward, forward);
    gl.uniform3fv(uniforms.right, right);
    gl.uniform3fv(uniforms.up, up);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    pointers.clear();
    if (!gl.isContextLost()) {
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    }
  }

  return { render, setView, getView, dispose };
}
