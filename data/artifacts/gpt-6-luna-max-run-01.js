const vertexSource = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uYaw;
uniform float uPitch;
uniform float uDistance;

const float PI = 3.14159265359;

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float sdTaper(vec3 p, vec3 a, vec3 b, float ra, float rb) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    return length(pa - ba * h) - mix(ra, rb, h);
}

float sdEllipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

float sdTorus(vec3 p, vec2 t) {
    return length(vec2(length(p.xy) - t.x, p.z)) - t.y;
}

vec2 nearest(vec2 a, vec2 b) {
    return a.x < b.x ? a : b;
}

vec2 scene(vec3 p) {
    vec2 d = vec2(p.y, 12.0);

    float wheelSpin = -uTime * 2.1;
    for (int w = 0; w < 2; w++) {
        float cx = w == 0 ? -1.18 : 1.18;
        vec3 q = p - vec3(cx, 0.90, 0.0);
        d = nearest(d, vec2(sdTorus(q, vec2(0.79, 0.075)), 1.0));
        d = nearest(d, vec2(sdTorus(q - vec3(0.0, 0.0, 0.052), vec2(0.79, 0.018)), 1.0));
        d = nearest(d, vec2(sdTorus(q + vec3(0.0, 0.0, 0.052), vec2(0.79, 0.018)), 1.0));
        d = nearest(d, vec2(sdTorus(q, vec2(0.69, 0.025)), 2.0));
        d = nearest(d, vec2(sdCapsule(q, vec3(0.0, 0.0, -0.12), vec3(0.0, 0.0, 0.12), 0.105), 2.0));
        for (int i = 0; i < 8; i++) {
            float a = float(i) * (PI / 4.0) + wheelSpin;
            vec3 a0 = vec3(0.10 * cos(a), 0.10 * sin(a), 0.0);
            vec3 a1 = vec3(0.68 * cos(a), 0.68 * sin(a), 0.0);
            d = nearest(d, vec2(sdCapsule(q, a0, a1, 0.012), 4.0));
        }
    }

    vec3 rear = vec3(-1.18, 0.90, 0.0);
    vec3 front = vec3(1.18, 0.90, 0.0);
    vec3 crank = vec3(0.0, 0.90, 0.0);
    vec3 seatNode = vec3(-0.50, 1.78, 0.0);
    vec3 headNode = vec3(0.78, 1.80, 0.0);
    d = nearest(d, vec2(sdCapsule(p, rear, seatNode, 0.045), 3.0));
    d = nearest(d, vec2(sdCapsule(p, rear, crank, 0.055), 3.0));
    d = nearest(d, vec2(sdCapsule(p, crank, seatNode, 0.055), 3.0));
    d = nearest(d, vec2(sdCapsule(p, seatNode, headNode, 0.055), 3.0));
    d = nearest(d, vec2(sdCapsule(p, crank, headNode, 0.055), 3.0));
    d = nearest(d, vec2(sdCapsule(p, headNode, front, 0.047), 3.0));
    d = nearest(d, vec2(sdCapsule(p, seatNode, vec3(-0.54, 2.04, 0.0), 0.045), 2.0));
    d = nearest(d, vec2(sdEllipsoid(p - vec3(-0.55, 2.07, 0.0), vec3(0.33, 0.075, 0.18)), 10.0));

    d = nearest(d, vec2(sdCapsule(p, vec3(0.79, 1.81, 0.0), vec3(0.88, 2.11, 0.0), 0.043), 2.0));
    d = nearest(d, vec2(sdCapsule(p, vec3(0.88, 2.11, -0.38), vec3(0.88, 2.11, 0.38), 0.034), 2.0));
    for (int s = 0; s < 2; s++) {
        float sg = s == 0 ? 1.0 : -1.0;
        d = nearest(d, vec2(sdCapsule(p, vec3(0.88, 2.11, sg * 0.34), vec3(1.00, 2.02, sg * 0.27), 0.040), 2.0));
    }

    float crankAngle = uTime * 2.1 + 1.1;
    d = nearest(d, vec2(sdCapsule(p, vec3(0.0, 0.90, -0.24), vec3(0.0, 0.90, 0.24), 0.070), 2.0));
    for (int s = 0; s < 2; s++) {
        float sg = s == 0 ? 1.0 : -1.0;
        float a = crankAngle + (s == 0 ? 0.0 : PI);
        vec3 pedal = vec3(0.36 * cos(a), 0.90 + 0.36 * sin(a), sg * 0.20);
        d = nearest(d, vec2(sdCapsule(p, vec3(0.0, 0.90, sg * 0.15), pedal, 0.035), 3.0));
        d = nearest(d, vec2(sdCapsule(p, pedal + vec3(-0.14, 0.0, 0.0), pedal + vec3(0.14, 0.0, 0.0), 0.045), 2.0));

        vec3 hip = vec3(-0.34, 2.00, sg * 0.255);
        vec3 ankle = pedal + vec3(0.0, 0.055, 0.0);
        vec3 knee = mix(hip, ankle, 0.50) + vec3(-0.08, 0.08, 0.0);
        d = nearest(d, vec2(sdCapsule(p, hip, knee, 0.066), 11.0));
        d = nearest(d, vec2(sdCapsule(p, knee, ankle, 0.050), 11.0));
        d = nearest(d, vec2(sdEllipsoid(p - (ankle + vec3(0.045, 0.075, 0.0)), vec3(0.14, 0.075, 0.085)), 11.0));
        d = nearest(d, vec2(sdTaper(p, ankle + vec3(0.07, 0.07, 0.0), ankle + vec3(0.25, 0.035, 0.0), 0.065, 0.012), 11.0));
    }

    d = nearest(d, vec2(sdEllipsoid(p - vec3(-0.30, 2.36, 0.0), vec3(0.73, 0.43, 0.39)), 5.0));
    d = nearest(d, vec2(sdCapsule(p, vec3(0.25, 2.43, 0.0), vec3(0.45, 2.62, 0.0), 0.155), 5.0));
    d = nearest(d, vec2(sdCapsule(p, vec3(0.45, 2.62, 0.0), vec3(0.63, 2.76, 0.0), 0.145), 5.0));
    d = nearest(d, vec2(sdEllipsoid(p - vec3(0.64, 2.77, 0.0), vec3(0.35, 0.28, 0.29)), 5.0));

    for (int s = 0; s < 2; s++) {
        float sg = s == 0 ? 1.0 : -1.0;
        d = nearest(d, vec2(sdEllipsoid(p - vec3(-0.34, 2.37, sg * 0.355), vec3(0.53, 0.235, 0.115)), 6.0));
        for (int f = 0; f < 3; f++) {
            float ff = float(f);
            d = nearest(d, vec2(sdTaper(p,
                vec3(-0.16 - ff * 0.12, 2.43 - ff * 0.025, sg * 0.438),
                vec3(-0.73 - ff * 0.10, 2.28 - ff * 0.035, sg * 0.415),
                0.045, 0.012), 5.0));
        }
        d = nearest(d, vec2(sdTaper(p, vec3(-0.84, 2.36, sg * 0.12), vec3(-1.06, 2.31, sg * 0.08), 0.11, 0.015), 5.0));

        d = nearest(d, vec2(sdEllipsoid(p - vec3(0.69, 2.81, sg * 0.257), vec3(0.108, 0.112, 0.065)), 5.0));
        d = nearest(d, vec2(sdEllipsoid(p - vec3(0.755, 2.825, sg * 0.307), vec3(0.047, 0.054, 0.028)), 9.0));
        d = nearest(d, vec2(sdEllipsoid(p - vec3(0.770, 2.850, sg * 0.329), vec3(0.014, 0.016, 0.010)), 13.0));
        d = nearest(d, vec2(sdEllipsoid(p - vec3(1.04, 2.755, sg * 0.105), vec3(0.022, 0.014, 0.012)), 9.0));

        d = nearest(d, vec2(sdEllipsoid(p - vec3(1.14, 2.39, sg * 0.015), vec3(0.355, 0.335, 0.175)), 8.0));
        d = nearest(d, vec2(sdCapsule(p,
            vec3(0.94, 2.535, sg * 0.125),
            vec3(1.43, 2.475, sg * 0.105), 0.012), 7.0));
    }

    d = nearest(d, vec2(sdTaper(p, vec3(0.88, 2.765, 0.0), vec3(1.88, 2.69, 0.0), 0.125, 0.018), 7.0));
    d = nearest(d, vec2(sdTaper(p, vec3(0.90, 2.67, 0.0), vec3(1.72, 2.585, 0.0), 0.039, 0.012), 7.0));
    return d;
}

vec3 normalAt(vec3 p) {
    float e = 0.0015;
    vec2 k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * scene(p + k.xyy * e).x +
        k.yyx * scene(p + k.yyx * e).x +
        k.yxy * scene(p + k.yxy * e).x +
        k.xxx * scene(p + k.xxx * e).x
    );
}

float softShadow(vec3 ro, vec3 rd) {
    float result = 1.0;
    float t = 0.035;
    for (int i = 0; i < 14; i++) {
        float h = scene(ro + rd * t).x;
        if (h < 0.002) return 0.12;
        result = min(result, 10.0 * h / t);
        t += clamp(h, 0.025, 0.42);
        if (t > 4.2) break;
    }
    return clamp(result, 0.12, 1.0);
}

vec3 materialColor(float id, vec3 p) {
    if (id < 1.5) return vec3(0.035, 0.052, 0.060);
    if (id < 2.5) return vec3(0.50, 0.62, 0.64);
    if (id < 3.5) return vec3(0.025, 0.43, 0.40);
    if (id < 4.5) return vec3(0.62, 0.73, 0.73);
    if (id < 5.5) return vec3(0.91, 0.88, 0.78);
    if (id < 6.5) return vec3(0.63, 0.71, 0.70);
    if (id < 7.5) return vec3(0.68, 0.24, 0.055);
    if (id < 8.5) return vec3(0.88, 0.32, 0.15);
    if (id < 9.5) return vec3(0.018, 0.024, 0.026);
    if (id < 10.5) return vec3(0.20, 0.085, 0.035);
    if (id < 11.5) return vec3(0.78, 0.25, 0.045);
    if (id < 12.5) {
        float lines = 1.0 - smoothstep(0.0, 0.025,
            min(abs(fract(p.x * 0.72) - 0.5), abs(fract(p.z * 0.72) - 0.5)));
        return mix(vec3(0.34, 0.47, 0.45), vec3(0.30, 0.42, 0.41), lines * 0.25);
    }
    return vec3(1.0);
}

vec3 background(vec3 rd) {
    float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 sky = mix(vec3(0.91, 0.70, 0.52), vec3(0.35, 0.61, 0.73), smoothstep(0.12, 0.88, h));
    vec3 sunDir = normalize(vec3(-0.45, 0.72, 0.55));
    float glow = pow(max(dot(rd, sunDir), 0.0), 28.0);
    return sky + vec3(0.16, 0.12, 0.075) * glow;
}

void main() {
    vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    vec3 target = vec3(0.0, 1.52, 0.0);
    vec3 camPos = target + vec3(
        sin(uYaw) * cos(uPitch),
        sin(uPitch),
        cos(uYaw) * cos(uPitch)
    ) * uDistance;
    vec3 forward = normalize(target - camPos);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(right, forward));
    vec3 rd = normalize(forward + right * uv.x * 0.50 + up * uv.y * 0.50);

    float t = 0.0;
    float id = -1.0;
    vec3 pos = camPos;
    for (int i = 0; i < 92; i++) {
        pos = camPos + rd * t;
        vec2 h = scene(pos);
        if (h.x < 0.0014) {
            id = h.y;
            break;
        }
        t += max(h.x * 0.88, 0.0015);
        if (t > 32.0) break;
    }

    vec3 color;
    if (id < 0.0) {
        color = background(rd);
    } else {
        vec3 n = normalAt(pos);
        vec3 lightDir = normalize(vec3(-0.48, 0.82, 0.50));
        float shadow = softShadow(pos + n * 0.012, lightDir);
        float diffuse = max(dot(n, lightDir), 0.0);
        float hemi = 0.5 + 0.5 * n.y;
        vec3 base = materialColor(id, pos);
        color = base * (0.25 + 0.25 * hemi + 0.82 * diffuse * shadow);
        vec3 viewDir = normalize(camPos - pos);
        vec3 halfDir = normalize(lightDir + viewDir);
        float specular = pow(max(dot(n, halfDir), 0.0), 38.0);
        color += vec3(0.72, 0.82, 0.86) * specular * (id < 1.5 ? 0.20 : 0.24) * shadow;
        color = color / (color + vec3(1.0));
        color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
    }

    outColor = vec4(color, 1.0);
}`;

export function createPelicanSdf(canvas) {
    const gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: true,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false
    });
    if (!gl) throw new Error("Pelican SDF requires WebGL2.");

    let yaw = 0.42;
    let pitch = 0.12;
    let distance = 7.4;
    let lost = false;
    let disposed = false;
    let program = null;
    let vao = null;
    let uniforms = null;

    function compile(type, source) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Pelican SDF could not create a WebGL shader.");
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader) || "Unknown shader compiler error.";
            gl.deleteShader(shader);
            throw new Error("Pelican SDF shader compilation failed: " + log);
        }
        return shader;
    }

    function initialize() {
        const vs = compile(gl.VERTEX_SHADER, vertexSource);
        let fs;
        try {
            fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
        } catch (error) {
            gl.deleteShader(vs);
            throw error;
        }
        const nextProgram = gl.createProgram();
        if (!nextProgram) {
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            throw new Error("Pelican SDF could not create a WebGL program.");
        }
        gl.attachShader(nextProgram, vs);
        gl.attachShader(nextProgram, fs);
        gl.linkProgram(nextProgram);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(nextProgram) || "Unknown program linker error.";
            gl.deleteProgram(nextProgram);
            throw new Error("Pelican SDF shader linking failed: " + log);
        }
        const nextVao = gl.createVertexArray();
        if (!nextVao) {
            gl.deleteProgram(nextProgram);
            throw new Error("Pelican SDF could not create a WebGL vertex array.");
        }
        program = nextProgram;
        vao = nextVao;
        uniforms = {
            resolution: gl.getUniformLocation(program, "uResolution"),
            time: gl.getUniformLocation(program, "uTime"),
            yaw: gl.getUniformLocation(program, "uYaw"),
            pitch: gl.getUniformLocation(program, "uPitch"),
            distance: gl.getUniformLocation(program, "uDistance")
        };
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
    }

    initialize();

    const previousTabIndex = canvas.getAttribute("tabindex");
    const previousTouchAction = canvas.style.touchAction;
    if (canvas.tabIndex < 0) canvas.setAttribute("tabindex", "0");
    canvas.style.touchAction = "none";

    const pointers = new Map();
    let pinchDistance = 0;

    function clampView() {
        pitch = Math.max(-1.25, Math.min(1.25, pitch));
        distance = Math.max(2.8, Math.min(18.0, distance));
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

    function render(timeSeconds) {
        if (disposed || lost || !program || !vao) return;
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;
        if (width <= 0 || height <= 0) return;
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform1f(uniforms.time, Number.isFinite(timeSeconds) ? timeSeconds : 0);
        gl.uniform1f(uniforms.yaw, yaw);
        gl.uniform1f(uniforms.pitch, pitch);
        gl.uniform1f(uniforms.distance, distance);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function pointerDown(event) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        try {
            canvas.focus({ preventScroll: true });
            canvas.setPointerCapture(event.pointerId);
        } catch (_) {}
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2) {
            const pts = Array.from(pointers.values());
            pinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        } else if (pointers.size > 2) {
            pinchDistance = 0;
        }
    }

    function pointerMove(event) {
        if (!pointers.has(event.pointerId)) return;
        event.preventDefault();
        const old = pointers.get(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
            const pts = Array.from(pointers.values());
            const nextDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            if (pinchDistance > 0 && nextDistance > 0) {
                distance *= pinchDistance / nextDistance;
                clampView();
            }
            pinchDistance = nextDistance;
        } else {
            yaw += (event.clientX - old.x) * 0.006;
            pitch += (event.clientY - old.y) * 0.005;
            clampView();
        }
    }

    function pointerUp(event) {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) pinchDistance = 0;
        if (pointers.size === 1) {
            const remaining = pointers.values().next().value;
            if (remaining) {
                remaining.x = event.clientX;
                remaining.y = event.clientY;
            }
        }
    }

    function wheel(event) {
        event.preventDefault();
        distance *= Math.exp(event.deltaY * 0.001);
        clampView();
    }

    function keyDown(event) {
        let handled = true;
        switch (event.key) {
            case "ArrowLeft": yaw -= 0.075; break;
            case "ArrowRight": yaw += 0.075; break;
            case "ArrowUp": pitch += 0.065; break;
            case "ArrowDown": pitch -= 0.065; break;
            case "+":
            case "=": distance *= 0.90; break;
            case "-":
            case "_": distance *= 1.11; break;
            default: handled = false;
        }
        if (handled) {
            clampView();
            event.preventDefault();
        }
    }

    function contextLost(event) {
        event.preventDefault();
        lost = true;
        program = null;
        vao = null;
        uniforms = null;
    }

    function contextRestored() {
        try {
            initialize();
            lost = false;
        } catch (_) {
            program = null;
            vao = null;
            uniforms = null;
            lost = true;
        }
    }

    canvas.addEventListener("pointerdown", pointerDown, { passive: false });
    canvas.addEventListener("pointermove", pointerMove, { passive: false });
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
        canvas.style.touchAction = previousTouchAction;
        if (previousTabIndex === null) canvas.removeAttribute("tabindex");
        else canvas.setAttribute("tabindex", previousTabIndex);
        if (program) gl.deleteProgram(program);
        if (vao) gl.deleteVertexArray(vao);
        program = null;
        vao = null;
        uniforms = null;
        pointers.clear();
    }

    return { render, setView, getView, dispose };
}
