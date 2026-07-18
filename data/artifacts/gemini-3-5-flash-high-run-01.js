export function createPelicanSdf(canvas) {
    const gl = canvas.getContext("webgl2", {
        alpha: false,
        depth: false,
        antialias: true,
        powerPreference: "high-performance"
    });

    if (!gl) {
        throw new Error("WebGL 2.0 is not available in this browser.");
    }

    canvas.tabIndex = 0;
    canvas.style.outline = "none";

    let yaw = 0.6;
    let pitch = 0.25;
    let distance = 3.2;
    const target = [0.0, 0.2, 0.0];

    const vsSource = `#version 300 es
    in vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }`;

    const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_cameraPos;
    uniform vec3 u_target;

    float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
        vec3 pa = p - a, ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h) - r;
    }

    float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a)/k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
    }

    vec2 map(vec3 p, float t) {
        vec2 res = vec2(1e5, 0.0);

        float d_ground = p.y + 1.0;
        res = vec2(d_ground, 1.0);

        float rot_t = -t * 4.4;

        vec3 q_rw = p - vec3(0.0, -0.4, -0.9);
        float d_rw_tire = length(vec2(length(q_rw.yz) - 0.55, q_rw.x)) - 0.045;
        float d_rw_rim = length(vec2(length(q_rw.yz) - 0.53, q_rw.x)) - 0.015;
        float r_dist_rw = length(q_rw.yz);
        float d_rw_spokes = max(abs(q_rw.x) - 0.005, abs(sin((atan(q_rw.y, q_rw.z) + rot_t) * 6.0) * r_dist_rw) - 0.008);
        d_rw_spokes = max(d_rw_spokes, r_dist_rw - 0.53);
        d_rw_spokes = max(d_rw_spokes, 0.05 - r_dist_rw);

        if (d_rw_tire < res.x) res = vec2(d_rw_tire, 6.0);
        if (d_rw_rim < res.x) res = vec2(d_rw_rim, 7.0);
        if (d_rw_spokes < res.x) res = vec2(d_rw_spokes, 7.0);

        vec3 q_fw = p - vec3(0.0, -0.4, 0.9);
        float d_fw_tire = length(vec2(length(q_fw.yz) - 0.55, q_fw.x)) - 0.045;
        float d_fw_rim = length(vec2(length(q_fw.yz) - 0.53, q_fw.x)) - 0.015;
        float r_dist_fw = length(q_fw.yz);
        float d_fw_spokes = max(abs(q_fw.x) - 0.005, abs(sin((atan(q_fw.y, q_fw.z) + rot_t) * 6.0) * r_dist_fw) - 0.008);
        d_fw_spokes = max(d_fw_spokes, r_dist_fw - 0.53);
        d_fw_spokes = max(d_fw_spokes, 0.05 - r_dist_fw);

        if (d_fw_tire < res.x) res = vec2(d_fw_tire, 6.0);
        if (d_fw_rim < res.x) res = vec2(d_fw_rim, 7.0);
        if (d_fw_spokes < res.x) res = vec2(d_fw_spokes, 7.0);

        vec3 C = vec3(0.0, -0.4, 0.0);
        vec3 S = vec3(0.0, 0.35, -0.3);
        vec3 Ht = vec3(0.0, 0.55, 0.75);
        vec3 Hb = vec3(0.0, 0.3, 0.78);
        vec3 RH = vec3(0.0, -0.4, -0.9);
        vec3 FH = vec3(0.0, -0.4, 0.9);

        float d_chainstay = sdCapsule(p, RH + vec3(0.03, 0.0, 0.0), C + vec3(0.03, 0.0, 0.0), 0.015);
        d_chainstay = min(d_chainstay, sdCapsule(p, RH - vec3(0.03, 0.0, 0.0), C - vec3(0.03, 0.0, 0.0), 0.015));

        float d_seatstay = sdCapsule(p, RH + vec3(0.03, 0.0, 0.0), S, 0.012);
        d_seatstay = min(d_seatstay, sdCapsule(p, RH - vec3(0.03, 0.0, 0.0), S, 0.012));

        float d_seattube = sdCapsule(p, S, C, 0.022);
        float d_downtube = sdCapsule(p, C, Hb, 0.025);
        float d_toptube = sdCapsule(p, S, Ht, 0.022);

        float d_fork = sdCapsule(p, Hb + vec3(0.04, 0.0, -0.02), FH + vec3(0.02, 0.0, 0.0), 0.018);
        d_fork = min(d_fork, sdCapsule(p, Hb - vec3(0.04, 0.0, -0.02), FH - vec3(0.02, 0.0, 0.0), 0.018));

        vec3 H_bar = vec3(0.0, 0.65, 0.73);
        float d_stem = sdCapsule(p, Hb, H_bar, 0.022);
        float d_hbar = sdCapsule(p, H_bar - vec3(0.22, -0.02, 0.05), H_bar + vec3(0.22, -0.02, 0.05), 0.016);

        float d_frame = min(d_chainstay, min(d_seatstay, min(d_seattube, min(d_downtube, min(d_toptube, min(d_fork, min(d_stem, d_hbar)))))));
        if (d_frame < res.x) res = vec2(d_frame, 5.0);

        float d_grips = sdCapsule(p, H_bar - vec3(0.18, -0.02, 0.05), H_bar - vec3(0.24, -0.02, 0.04), 0.018);
        d_grips = min(d_grips, sdCapsule(p, H_bar + vec3(0.18, -0.02, 0.05), H_bar + vec3(0.24, -0.02, 0.04), 0.018));
        if (d_grips < res.x) res = vec2(d_grips, 6.0);

        vec3 q_seat = p - S - vec3(0.0, 0.05, 0.0);
        float d_seat = (length(q_seat / vec3(0.12, 0.06, 0.22)) - 1.0) * 0.06;
        if (d_seat < res.x) res = vec2(d_seat, 6.0);

        float theta = t * 4.4;
        float s_th = sin(theta);
        float c_th = cos(theta);
        vec3 P_r_crank = C + vec3(0.12, 0.22 * s_th, 0.22 * c_th);
        vec3 P_l_crank = C + vec3(-0.12, -0.22 * s_th, -0.22 * c_th);

        float d_cranks = sdCapsule(p, C + vec3(0.08, 0.0, 0.0), P_r_crank, 0.015);
        d_cranks = min(d_cranks, sdCapsule(p, C - vec3(0.08, 0.0, 0.0), P_l_crank, 0.015));
        if (d_cranks < res.x) res = vec2(d_cranks, 7.0);

        float d_pedal_r = sdCapsule(p, P_r_crank - vec3(0.0, 0.0, 0.06), P_r_crank + vec3(0.08, 0.0, 0.06), 0.016);
        float d_pedal_l = sdCapsule(p, P_l_crank - vec3(0.08, 0.0, 0.06), P_l_crank + vec3(0.0, 0.0, 0.06), 0.016);
        if (min(d_pedal_r, d_pedal_l) < res.x) res = vec2(min(d_pedal_r, d_pedal_l), 6.0);

        vec3 body_center = vec3(0.0, 0.62, -0.25);

        vec3 q_body = p - body_center;
        float d_body = (length(q_body / vec3(0.24, 0.28, 0.35)) - 1.0) * 0.24;
        vec3 q_tail = p - (body_center + vec3(0.0, 0.15, -0.32));
        float d_tail = (length(q_tail / vec3(0.12, 0.1, 0.18)) - 1.0) * 0.1;
        d_body = smin(d_body, d_tail, 0.08);

        vec3 n1 = body_center + vec3(0.0, 0.18, 0.22);
        vec3 n2 = vec3(0.0, 1.0, 0.12);
        vec3 n3 = vec3(0.0, 1.15, 0.18);
        float d_neck = sdCapsule(p, n1, n2, 0.12);
        d_neck = smin(d_neck, sdCapsule(p, n2, n3, 0.11), 0.08);

        vec3 head_center = vec3(0.0, 1.25, 0.22);
        float d_head = length(p - head_center) - 0.15;

        float d_pelican_white = smin(d_body, d_neck, 0.14);
        d_pelican_white = smin(d_pelican_white, d_head, 0.08);

        vec3 q_wl = p - (body_center + vec3(-0.25, 0.05, -0.05));
        q_wl.yz = mat2(0.955, 0.295, -0.295, 0.955) * q_wl.yz;
        float d_wing_l = (length(q_wl / vec3(0.08, 0.18, 0.26)) - 1.0) * 0.08;

        vec3 q_wr = p - (body_center + vec3(0.25, 0.05, -0.05));
        q_wr.yz = mat2(0.955, 0.295, -0.295, 0.955) * q_wr.yz;
        float d_wing_r = (length(q_wr / vec3(0.08, 0.18, 0.26)) - 1.0) * 0.08;

        d_pelican_white = smin(d_pelican_white, min(d_wing_l, d_wing_r), 0.05);

        vec3 H_r = body_center + vec3(0.15, -0.15, 0.0);
        vec3 H_l = body_center + vec3(-0.15, -0.15, 0.0);
        vec3 F_r = P_r_crank + vec3(0.04, 0.03, 0.0);
        vec3 F_l = P_l_crank + vec3(-0.04, 0.03, 0.0);
        vec3 K_r = mix(H_r, F_r, 0.5) + vec3(0.14, 0.15, 0.14);
        vec3 K_l = mix(H_l, F_l, 0.5) + vec3(-0.14, 0.15, 0.14);

        float d_leg_r = sdCapsule(p, H_r, K_r, 0.055);
        d_leg_r = smin(d_leg_r, sdCapsule(p, K_r, F_r, 0.045), 0.05);

        float d_leg_l = sdCapsule(p, H_l, K_l, 0.055);
        d_leg_l = smin(d_leg_l, sdCapsule(p, K_l, F_l, 0.045), 0.05);

        d_pelican_white = smin(d_pelican_white, min(d_leg_r, d_leg_l), 0.06);
        if (d_pelican_white < res.x) res = vec2(d_pelican_white, 2.0);

        float d_foot_r = sdCapsule(p, F_r, F_r + vec3(-0.02, -0.01, 0.12), 0.03);
        d_foot_r = min(d_foot_r, sdCapsule(p, F_r, F_r + vec3(0.06, -0.01, 0.1), 0.025));
        float d_foot_l = sdCapsule(p, F_l, F_l + vec3(0.02, -0.01, 0.12), 0.03);
        d_foot_l = min(d_foot_l, sdCapsule(p, F_l, F_l + vec3(-0.06, -0.01, 0.1), 0.025));
        float d_feet = min(d_foot_r, d_foot_l);
        if (d_feet < res.x) res = vec2(d_feet, 3.0);

        vec3 beak_start = head_center + vec3(0.0, -0.02, 0.08);
        vec3 beak_end = head_center + vec3(0.0, -0.15, 0.65);
        float d_beak = sdCapsule(p, beak_start, beak_end, 0.055);

        vec3 pouch_center = (beak_start + beak_end) * 0.5 + vec3(0.0, -0.16, -0.05);
        vec3 q_pouch = p - pouch_center;
        float d_pouch = (length(q_pouch / vec3(0.09, 0.22, 0.26)) - 1.0) * 0.09;

        float d_beak_all = smin(d_beak, d_pouch, 0.08);
        if (d_beak_all < res.x) res = vec2(d_beak_all, 3.0);

        vec3 eye_r = head_center + vec3(0.11, 0.06, 0.08);
        vec3 eye_l = head_center + vec3(-0.11, 0.06, 0.08);
        float d_eyes = min(length(p - eye_r) - 0.025, length(p - eye_l) - 0.025);
        if (d_eyes < res.x) res = vec2(d_eyes, 4.0);

        return res;
    }

    vec3 getNormal(vec3 p, float t) {
        vec2 e = vec2(0.001, 0.0);
        return normalize(vec3(
            map(p + e.xyy, t).x - map(p - e.xyy, t).x,
            map(p + e.yxy, t).x - map(p - e.yxy, t).x,
            map(p + e.yyx, t).x - map(p - e.yyx, t).x
        ));
    }

    float getShadow(vec3 ro, vec3 rd, float t) {
        float res = 1.0;
        float t_max = 3.0;
        float h_curr = 0.015;
        for (int i = 0; i < 20; i++) {
            float h = map(ro + rd * h_curr, t).x;
            if (h < 0.001) return 0.0;
            res = min(res, 8.0 * h / h_curr);
            h_curr += clamp(h, 0.03, 0.18);
            if (h_curr > t_max) break;
        }
        return clamp(res, 0.0, 1.0);
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
        vec3 forward = normalize(u_target - u_cameraPos);
        vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
        vec3 up = cross(right, forward);

        float fov = 1.35;
        vec3 rayDir = normalize(forward * fov + right * uv.x + up * uv.y);

        float d_surf = 0.0016;
        float d_max = 12.0;
        float depth = 0.1;
        vec2 r_map = vec2(0.0);
        bool hit = false;

        for (int i = 0; i < 110; i++) {
            vec3 p = u_cameraPos + rayDir * depth;
            r_map = map(p, u_time);
            if (r_map.x < d_surf) {
                hit = true;
                break;
            }
            depth += r_map.x;
            if (depth > d_max) break;
        }

        vec3 col = vec3(0.0);

        if (hit) {
            vec3 hitPos = u_cameraPos + rayDir * depth;
            vec3 normal = getNormal(hitPos, u_time);
            float matId = r_map.y;

            vec3 matColor = vec3(1.0);
            float specPower = 16.0;
            float specStrength = 0.2;
            float metalness = 0.0;

            if (matId == 1.0) {
                matColor = vec3(0.85, 0.82, 0.76);
                vec2 g_uv = hitPos.xz;
                g_uv.y -= u_time * 1.33;
                float tiles = step(0.96, fract(g_uv.x * 2.5)) + step(0.96, fract(g_uv.y * 2.5));
                matColor = mix(matColor, vec3(0.74, 0.71, 0.65), clamp(tiles, 0.0, 1.0));
                float d_origin = length(hitPos.xz);
                matColor = mix(matColor, vec3(0.72, 0.82, 0.90), clamp(d_origin * 0.16, 0.0, 1.0));
                specPower = 4.0;
                specStrength = 0.02;
            } else if (matId == 2.0) {
                matColor = vec3(0.97, 0.97, 0.94);
                specPower = 10.0;
                specStrength = 0.08;
            } else if (matId == 3.0) {
                if (hitPos.y < 1.15 && hitPos.z > 0.1) {
                    matColor = vec3(0.99, 0.58, 0.25);
                } else {
                    matColor = vec3(1.0, 0.50, 0.01);
                }
                specPower = 24.0;
                specStrength = 0.25;
            } else if (matId == 4.0) {
                matColor = vec3(0.02, 0.02, 0.05);
                specPower = 120.0;
                specStrength = 1.4;
            } else if (matId == 5.0) {
                matColor = vec3(0.01, 0.56, 0.57);
                specPower = 64.0;
                specStrength = 0.9;
                metalness = 0.45;
            } else if (matId == 6.0) {
                matColor = vec3(0.18, 0.18, 0.20);
                specPower = 6.0;
                specStrength = 0.03;
            } else if (matId == 7.0) {
                matColor = vec3(0.84, 0.84, 0.87);
                specPower = 95.0;
                specStrength = 1.5;
                metalness = 0.85;
            }

            vec3 sunDir = normalize(vec3(1.5, 2.2, 0.8));
            vec3 sunCol = vec3(1.0, 0.96, 0.86) * 1.15;
            vec3 skyCol = vec3(0.68, 0.82, 0.94) * 0.45;
            vec3 skyLight = (0.5 + 0.5 * normal.y) * skyCol;
            vec3 groundCol = vec3(0.35, 0.3, 0.25) * 0.2;
            vec3 groundLight = (0.5 + 0.5 * -normal.y) * groundCol;

            float ndl = max(dot(normal, sunDir), 0.0);
            float shadow = 1.0;
            if (ndl > 0.01) {
                shadow = getShadow(hitPos + normal * 0.008, sunDir, u_time);
            }

            vec3 viewDir = normalize(u_cameraPos - hitPos);
            vec3 halfDir = normalize(sunDir + viewDir);
            float spec = pow(max(dot(normal, halfDir), 0.0), specPower) * specStrength;

            if (metalness > 0.0) {
                vec3 reflDir = reflect(rayDir, normal);
                vec3 reflCol = mix(vec3(0.68, 0.82, 0.94), vec3(0.85, 0.82, 0.76), clamp(-reflDir.y, 0.0, 1.0));
                matColor = mix(matColor, reflCol * matColor, metalness * 0.5);
            }

            col = matColor * (sunCol * ndl * shadow + skyLight + groundLight) + vec3(spec * shadow);

            float ao = clamp(map(hitPos + normal * 0.08, u_time).x / 0.08, 0.0, 1.0);
            col *= mix(0.55, 1.0, ao);

            col = mix(col, vec3(0.75, 0.85, 0.94), clamp(depth * 0.08, 0.0, 1.0));
        } else {
            vec3 skyColor = mix(vec3(0.96, 0.98, 1.0), vec3(0.68, 0.82, 0.94), clamp(rayDir.y * 0.5 + 0.5, 0.0, 1.0));
            vec3 sunDirection = normalize(vec3(1.5, 2.2, 0.8));
            float sunGlow = pow(max(dot(rayDir, sunDirection), 0.0), 24.0);
            skyColor += vec3(1.0, 0.92, 0.78) * sunGlow * 0.55;
            col = skyColor;
        }

        fragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
    }`;

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`An error occurred compiling the shaders: ${info}`);
        }
        return shader;
    }

    const program = gl.createProgram();
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`);
    }

    const positionAttributeLocation = gl.getAttribLocation(program, "position");
    const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    const timeUniformLocation = gl.getUniformLocation(program, "u_time");
    const cameraPosUniformLocation = gl.getUniformLocation(program, "u_cameraPos");
    const targetUniformLocation = gl.getUniformLocation(program, "u_target");

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1.0, -1.0,
         3.0, -1.0,
        -1.0,  3.0
    ]), gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    let isCtxLost = false;

    const onContextLost = (e) => {
        e.preventDefault();
        isCtxLost = true;
    };

    const onContextRestored = () => {
        isCtxLost = false;
    };

    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

    let isDragging = false;
    let startX = 0, startY = 0;
    let startYaw = 0, startPitch = 0;

    const onMouseDown = (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startYaw = yaw;
        startPitch = pitch;
        canvas.focus();
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        yaw = startYaw - dx * 0.0075;
        pitch = Math.max(-0.45 * Math.PI, Math.min(0.45 * Math.PI, startPitch + dy * 0.0075));
    };

    const onMouseUp = () => {
        isDragging = false;
    };

    const onWheel = (e) => {
        e.preventDefault();
        distance = Math.max(1.1, Math.min(7.5, distance + e.deltaY * 0.0035));
    };

    const onKeyDown = (e) => {
        let handled = true;
        switch (e.key) {
            case "ArrowLeft": yaw -= 0.06; break;
            case "ArrowRight": yaw += 0.06; break;
            case "ArrowUp": pitch = Math.min(0.45 * Math.PI, pitch + 0.05); break;
            case "ArrowDown": pitch = Math.max(-0.45 * Math.PI, pitch - 0.05); break;
            case "+":
            case "=":
                distance = Math.max(1.1, distance - 0.12);
                break;
            case "-":
            case "_":
                distance = Math.min(7.5, distance + 0.12);
                break;
            default:
                handled = false;
        }
        if (handled) {
            e.preventDefault();
        }
    };

    let touchStartDist = 0;
    let startDistOnTouch = 0;

    const onTouchStart = (e) => {
        canvas.focus();
        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startYaw = yaw;
            startPitch = pitch;
        } else if (e.touches.length === 2) {
            isDragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDist = Math.hypot(dx, dy);
            startDistOnTouch = distance;
        }
    };

    const onTouchMove = (e) => {
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            yaw = startYaw - dx * 0.0085;
            pitch = Math.max(-0.45 * Math.PI, Math.min(0.45 * Math.PI, startPitch + dy * 0.0085));
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (touchStartDist > 0) {
                const factor = dist / touchStartDist;
                distance = Math.max(1.1, Math.min(7.5, startDistOnTouch / factor));
            }
        }
    };

    const onTouchEnd = () => {
        isDragging = false;
        touchStartDist = 0;
    };

    canvas.addEventListener("mousedown", onMouseDown, false);
    window.addEventListener("mousemove", onMouseMove, false);
    window.addEventListener("mouseup", onMouseUp, false);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown, false);

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, false);

    return {
        render(timeSeconds) {
            if (isCtxLost || gl.isContextLost()) return;

            gl.viewport(0, 0, canvas.width, canvas.height);

            gl.useProgram(program);

            const camX = target[0] + distance * Math.cos(pitch) * Math.cos(yaw);
            const camY = target[1] + distance * Math.sin(pitch);
            const camZ = target[2] + distance * Math.sin(yaw) * Math.cos(pitch);

            gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
            gl.uniform1f(timeUniformLocation, timeSeconds);
            gl.uniform3f(cameraPosUniformLocation, camX, camY, camZ);
            gl.uniform3f(targetUniformLocation, target[0], target[1], target[2]);

            gl.bindVertexArray(vao);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        },

        setView(newYaw, newPitch, newDistance) {
            yaw = newYaw;
            pitch = Math.max(-0.45 * Math.PI, Math.min(0.45 * Math.PI, newPitch));
            distance = Math.max(1.1, Math.min(7.5, newDistance));
        },

        getView() {
            return { yaw, pitch, distance };
        },

        dispose() {
            canvas.removeEventListener("webglcontextlost", onContextLost);
            canvas.removeEventListener("webglcontextrestored", onContextRestored);
            canvas.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("keydown", onKeyDown);
            canvas.removeEventListener("touchstart", onTouchStart);
            canvas.removeEventListener("touchmove", onTouchMove);
            canvas.removeEventListener("touchend", onTouchEnd);

            if (!gl.isContextLost()) {
                gl.deleteBuffer(positionBuffer);
                gl.deleteVertexArray(vao);
                gl.deleteShader(vs);
                gl.deleteShader(fs);
                gl.deleteProgram(program);
                const ext = gl.getExtension("WEBGL_lose_context");
                if (ext) ext.loseContext();
            }
        }
    };
}
