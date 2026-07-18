export function createPelicanSdf(canvas) {
    let gl = null;
    let program = null;
    let vao = null;
    let uRes, uRo, uTarget, uTime;
    let isContextLost = false;

    let yaw = 0.5, pitch = 0.3, distance = 9.0;
    const initialTargetY = 1.5;

    const vsSource = `#version 300 es
    in vec4 position;
    void main() {
        gl_Position = position;
    }`;

    const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 u_res;
    uniform vec3 u_ro;
    uniform vec3 u_target;
    uniform float u_time;

    mat2 rot(float a) { 
        float s=sin(a), c=cos(a); 
        return mat2(c, -s, s, c); 
    }
    
    float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
    }
    
    float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
        vec3 pa = p - a, ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h) - r;
    }
    
    float sdCone(vec3 p, vec3 a, vec3 b, float ra, float rb) {
        vec3 ba = b - a;
        float h = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
        return length(p - a - ba * h) - mix(ra, rb, h); 
    }
    
    float sdTorus(vec3 p, vec2 t) {
        vec2 q = vec2(length(p.xy) - t.x, p.z);
        return length(q) - t.y;
    }

    vec3 solveKnee(vec3 h, vec3 f, float L1, float L2, float dir) {
        vec2 tF = f.xy;
        float d = length(tF - h.xy);
        if(d > L1 + L2) {
            tF = h.xy + normalize(tF - h.xy) * (L1 + L2 - 0.001);
            d = L1 + L2 - 0.001;
        }
        float ad = atan(tF.y - h.y, tF.x - h.x);
        float ak = acos(clamp((L1 * L1 + d * d - L2 * L2) / (2.0 * L1 * d), -1.0, 1.0));
        vec2 k = h.xy + L1 * vec2(cos(ad + dir * ak), sin(ad + dir * ak));
        return vec3(k, (h.z + f.z) * 0.5 + sign(h.z) * 0.05);
    }

    void op(inout vec2 dm, float d, float m) {
        if(d < dm.x) dm = vec2(d, m);
    }

    vec2 map(vec3 p) {
        vec2 res = vec2(p.y, 6.0); 

        float speed = 4.0;
        float ang = u_time * speed;

        float bob = sin(ang * 2.0) * 0.03;
        vec3 pBob = p - vec3(0.0, bob, 0.0);
        vec3 pZ = pBob; pZ.z = abs(pZ.z); 

        float mBlack = 1e5, mFrame = 1e5, mSil = 1e5;

        vec3 wF = vec3(1.3, 0.8, 0.0);
        vec3 wR = vec3(-1.3, 0.8, 0.0);
        mBlack = min(min(mBlack, sdTorus(p - wF, vec2(0.8, 0.05))), sdTorus(p - wR, vec2(0.8, 0.05)));

        mSil = min(min(mSil, sdTorus(p - wF, vec2(0.76, 0.03))), sdTorus(p - wR, vec2(0.76, 0.03)));

        float wSpeed = speed / 0.8;
        mat2 rW = rot(-u_time * wSpeed);
        for(int i = 0; i < 2; i++) {
            vec3 pw = p - (i == 0 ? wF : wR);
            pw.xy *= rW;
            pw.xy = abs(pw.xy);
            if(pw.x < pw.y) pw.xy = pw.yx; 
            mSil = min(mSil, sdCapsule(pw, vec3(0), vec3(0.76, 0.0, 0.0), 0.008));
        }

        vec3 pF = p; pF.z = abs(pF.z);
        float fork = sdCapsule(pF, vec3(1.0, 1.8, 0.0), vec3(wF.xy, 0.08), 0.025);
        float sstay = sdCapsule(pF, vec3(-0.35, 1.7, 0.0), vec3(wR.xy, 0.08), 0.02);
        float cstay = sdCapsule(pF, vec3(0.0, 0.8, 0.0), vec3(wR.xy, 0.08), 0.025);
        float dtube = sdCapsule(p, vec3(1.0, 1.8, 0.0), vec3(0.0, 0.8, 0.0), 0.035);
        float ttube = sdCapsule(p, vec3(1.0, 1.8, 0.0), vec3(-0.35, 1.7, 0.0), 0.035);
        float stube = sdCapsule(p, vec3(-0.35, 1.7, 0.0), vec3(0.0, 0.8, 0.0), 0.035);
        mFrame = min(fork, min(sstay, min(cstay, min(dtube, min(ttube, stube)))));

        vec2 BB = vec2(0.0, 0.8);
        vec3 pedR = vec3(BB.x + cos(ang)*0.35, BB.y + sin(ang)*0.35, 0.17);
        vec3 pedL = vec3(BB.x - cos(ang)*0.35, BB.y - sin(ang)*0.35, -0.17);
        mSil = min(mSil, sdCapsule(p, vec3(BB, 0.12), vec3(BB, -0.12), 0.04)); 
        mSil = min(mSil, sdCapsule(p, vec3(BB, 0.12), pedR, 0.015)); 
        mSil = min(mSil, sdCapsule(p, vec3(BB, -0.12), pedL, 0.015)); 
        mSil = min(mSil, sdCapsule(p, pedR - vec3(0,0,0.06), pedR + vec3(0,0,0.06), 0.035));
        mSil = min(mSil, sdCapsule(p, pedL - vec3(0,0,0.06), pedL + vec3(0,0,0.06), 0.035));
        
        float chainring = max(length(p.xy - BB) - 0.16, abs(p.z - 0.08) - 0.01);
        mSil = min(mSil, max(chainring, -(length(p.xy - BB) - 0.14)));

        mSil = min(mSil, sdCapsule(p, vec3(1.0, 1.8, 0.0), vec3(1.0, 2.1, 0.0), 0.025)); 
        mSil = min(mSil, sdCapsule(p, vec3(1.0, 2.1, 0.0), vec3(0.95, 2.1, 0.0), 0.025)); 
        mSil = min(mSil, sdCapsule(p, vec3(0.95, 2.1, 0.25), vec3(0.95, 2.1, -0.25), 0.022)); 
        mBlack = min(mBlack, sdCapsule(pF, vec3(0.95, 2.1, 0.25), vec3(1.15, 2.05, 0.25), 0.026)); 

        mSil = min(mSil, sdCapsule(p, vec3(-0.35, 1.7, 0.0), vec3(-0.35, 2.0, 0.0), 0.02)); 
        mBlack = min(mBlack, sdCapsule(pBob, vec3(-0.45, 2.0, 0.0), vec3(-0.15, 2.03, 0.0), 0.07)); 

        op(res, mBlack, 3.0);
        op(res, mFrame, 4.0);
        op(res, mSil, 5.0);

        float mWhite = 1e5, mOrg = 1e5;

        float body = sdCapsule(pBob, vec3(-0.05, 2.25, 0.0), vec3(-0.4, 2.55, 0.0), 0.4);
        float neck = sdCapsule(pBob, vec3(-0.05, 2.25, 0.0), vec3(0.65, 3.5, 0.0), 0.14);
        float head = length(pBob - vec3(0.75, 3.55, 0.0)) - 0.22;
        float tail = sdCone(pBob, vec3(-0.4, 2.55, 0.0), vec3(-0.85, 2.4, 0.0), 0.2, 0.02);
        
        vec3 wingC = pZ; 
        float wing = sdCapsule(wingC, vec3(-0.25, 2.5, 0.38), vec3(-0.6, 2.3, 0.45), 0.14);
        
        mWhite = smin(body, smin(neck, head, 0.12), 0.18);
        mWhite = smin(mWhite, tail, 0.1);
        mWhite = smin(mWhite, wing, 0.08);

        float beak = sdCone(pBob, vec3(0.9, 3.55, 0.0), vec3(1.9, 3.2, 0.0), 0.08, 0.015);
        float pouch = sdCapsule(pBob, vec3(1.5, 3.25, 0.0), vec3(0.45, 3.05, 0.0), 0.07);
        mOrg = smin(beak, pouch, 0.12);

        op(res, length(pZ - vec3(0.85, 3.65, 0.14)) - 0.035, 3.0); 

        vec3 hipR = vec3(-0.15, 2.15, 0.25) + vec3(0.0, bob, 0.0);
        vec3 hipL = vec3(-0.15, 2.15, -0.25) + vec3(0.0, bob, 0.0);
        vec3 kR = solveKnee(hipR, pedR, 0.78, 0.78, 1.0);
        vec3 kL = solveKnee(hipL, pedL, 0.78, 0.78, 1.0);

        float legR = min(sdCapsule(p, hipR, kR, 0.05), sdCapsule(p, kR, pedR, 0.035));
        float legL = min(sdCapsule(p, hipL, kL, 0.05), sdCapsule(p, kL, pedL, 0.035));
        mOrg = min(mOrg, min(legR, legL));

        op(res, mWhite, 1.0);
        op(res, mOrg, 2.0);

        return res;
    }

    vec3 calcNormal(vec3 p) {
        vec2 e = vec2(1.0, -1.0) * 0.5773 * 0.001;
        return normalize(
            e.xyy * map(p + e.xyy).x + 
            e.yyx * map(p + e.yyx).x + 
            e.yxy * map(p + e.yxy).x + 
            e.xxx * map(p + e.xxx).x
        );
    }

    float calcShadow(vec3 ro, vec3 rd) {
        float res = 1.0, t = 0.01;
        for(int i = 0; i < 40 && t < 10.0; i++) {
            float h = map(ro + rd * t).x;
            if(h < 0.001) return 0.0;
            res = min(res, 20.0 * h / t);
            t += h;
        }
        return res;
    }

    void main() {
        vec2 uv = (2.0 * gl_FragCoord.xy - u_res) / u_res.y;

        vec3 ro = u_ro;
        vec3 ta = u_target;
        vec3 cw = normalize(ta - ro);
        vec3 cu = normalize(cross(cw, vec3(0.0, 1.0, 0.0)));
        vec3 cv = normalize(cross(cu, cw));
        vec3 rd = normalize(uv.x * cu + uv.y * cv + 2.0 * cw);

        float t = 0.0;
        float mat = -1.0;
        for(int i = 0; i < 150; i++) {
            vec3 p = ro + rd * t;
            vec2 res = map(p);
            if(res.x < 0.001) { mat = res.y; break; }
            if(t > 40.0) break;
            t += res.x;
        }

        vec3 col = mix(vec3(0.35, 0.55, 0.8), vec3(0.7, 0.85, 1.0), clamp(rd.y * 0.6 + 0.4, 0.0, 1.0));
        
        if(rd.y < 0.0) {
            float th = -ro.y / rd.y;
            vec3 ph = ro + th * rd;
            float sh = smoothstep(0.0, 3.0, length(ph.xz - ta.xz));
            col = mix(vec3(0.35, 0.38, 0.4) * sh, col, exp(-0.012 * th));
        }
        vec3 bg = col;

        if(mat > -0.5) {
            vec3 p = ro + rd * t;
            vec3 n = calcNormal(p);
            vec3 l = normalize(vec3(0.7, 1.0, 0.6));

            vec3 mCol = vec3(1.0);
            float rough = 0.5, metal = 0.0;

            if(mat == 1.0) { mCol = vec3(1.0, 0.98, 0.95); rough = 0.8; }
            else if(mat == 2.0) { mCol = vec3(1.0, 0.55, 0.05); rough = 0.5; }
            else if(mat == 3.0) { mCol = vec3(0.08); rough = 0.4; }
            else if(mat == 4.0) { mCol = vec3(0.8, 0.1, 0.15); rough = 0.2; }
            else if(mat == 5.0) { mCol = vec3(0.7, 0.75, 0.8); rough = 0.1; metal = 1.0; }
            else if(mat == 6.0) { 
                float speed = 4.0;
                float gx = fract(p.x * 2.0 + u_time * speed * 2.0);
                float gz = fract(p.z * 2.0);
                float grid = smoothstep(0.0, 0.05, abs(gx - 0.5)) * smoothstep(0.0, 0.05, abs(gz - 0.5));
                mCol = mix(vec3(0.3, 0.32, 0.35), vec3(0.35, 0.38, 0.4), grid);
                rough = 0.9;
            }

            float dif = clamp(dot(n, l), 0.0, 1.0);
            float sh = (mat == 6.0 || dif > 0.0) ? calcShadow(p, l) : 0.0;
            float amb = 0.4 + 0.6 * clamp(0.5 + 0.5 * n.y, 0.0, 1.0);

            vec3 h = normalize(l - rd);
            float spec = pow(max(dot(n, h), 0.0), mix(4.0, 128.0, 1.0 - rough));
            float f = max(0.0, 1.0 - max(dot(n, -rd), 0.0));
            float fresnel = mix(0.04, 1.0, pow(f, 5.0));

            vec3 lin = amb * vec3(0.5, 0.6, 0.75) + dif * vec3(1.0, 0.95, 0.85) * sh;
            col = mCol * lin;
            
            if(metal > 0.5) col += spec * vec3(1.0) * sh * fresnel * 2.0;
            else col += spec * vec3(1.0) * sh * 0.2;

            if(mat == 6.0) {
                col = mix(bg, col, exp(-0.012 * t));
            } else {
                col = mix(bg, col, exp(-0.003 * t));
            }
        }
        
        col = col / (1.0 + col);
        col = pow(col, vec3(0.4545));
        fragColor = vec4(col, 1.0);
    }`;

    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compile failed: ${log}`);
        }
        return shader;
    }

    function initGL() {
        gl = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: false });
        if (!gl) throw new Error('WebGL2 not available');

        const vert = compileShader(gl.VERTEX_SHADER, vsSource);
        const frag = compileShader(gl.FRAGMENT_SHADER, fsSource);

        program = gl.createProgram();
        gl.attachShader(program, vert);
        gl.attachShader(program, frag);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            throw new Error(`Program link failed: ${log}`);
        }

        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1,-1,  1,-1, -1, 1,
            -1, 1,  1,-1,  1, 1
        ]), gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        uRes = gl.getUniformLocation(program, 'u_res');
        uRo = gl.getUniformLocation(program, 'u_ro');
        uTarget = gl.getUniformLocation(program, 'u_target');
        uTime = gl.getUniformLocation(program, 'u_time');
    }

    initGL();

    const activePointers = new Map();
    
    const clampView = () => {
        pitch = Math.max(-1.5, Math.min(1.5, pitch));
        distance = Math.max(1.0, Math.min(50.0, distance));
    };

    const evtHandlers = {
        contextLost(e) {
            e.preventDefault();
            isContextLost = true;
        },
        contextRestored() {
            isContextLost = false;
            initGL();
        },
        ptrDown(e) {
            canvas.focus();
            canvas.setPointerCapture(e.pointerId);
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        },
        ptrMove(e) {
            if (!activePointers.has(e.pointerId)) return;
            const prev = activePointers.get(e.pointerId);

            if (activePointers.size === 1) {
                yaw -= (e.clientX - prev.x) * 0.01;
                pitch += (e.clientY - prev.y) * 0.01;
                clampView();
                activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            } else if (activePointers.size === 2) {
                const pts = Array.from(activePointers.values());
                const dx1 = pts[0].x - pts[1].x, dy1 = pts[0].y - pts[1].y;
                const dist1 = Math.hypot(dx1, dy1);

                activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                
                const ptsNew = Array.from(activePointers.values());
                const dx2 = ptsNew[0].x - ptsNew[1].x, dy2 = ptsNew[0].y - ptsNew[1].y;
                const dist2 = Math.hypot(dx2, dy2);

                distance -= (dist2 - dist1) * 0.02;
                clampView();
            }
        },
        ptrUp(e) {
            activePointers.delete(e.pointerId);
            canvas.releasePointerCapture(e.pointerId);
        },
        wheel(e) {
            e.preventDefault();
            distance += e.deltaY * 0.01;
            clampView();
        },
        keyDown(e) {
            const step = 0.1;
            switch(e.key) {
                case 'ArrowLeft': yaw -= step; break;
                case 'ArrowRight': yaw += step; break;
                case 'ArrowUp': pitch -= step; break;
                case 'ArrowDown': pitch += step; break;
                case '=': case '+': distance -= step * 5.0; break;
                case '-': case '_': distance += step * 5.0; break;
                default: return; 
            }
            e.preventDefault();
            clampView();
        },
        touchMove(e) {
            if (e.target === canvas) e.preventDefault();
        }
    };

    canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('webglcontextlost', evtHandlers.contextLost);
    canvas.addEventListener('webglcontextrestored', evtHandlers.contextRestored);
    canvas.addEventListener('pointerdown', evtHandlers.ptrDown);
    canvas.addEventListener('pointermove', evtHandlers.ptrMove);
    canvas.addEventListener('pointerup', evtHandlers.ptrUp);
    canvas.addEventListener('pointercancel', evtHandlers.ptrUp);
    canvas.addEventListener('wheel', evtHandlers.wheel, { passive: false });
    canvas.addEventListener('keydown', evtHandlers.keyDown);
    canvas.addEventListener('touchmove', evtHandlers.touchMove, { passive: false });

    return {
        setView(y, p, d) {
            yaw = y;
            pitch = p;
            distance = d;
            clampView();
        },
        getView() {
            return { yaw, pitch, distance };
        },
        render(timeSeconds) {
            if (isContextLost) return;
            
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(program);
            gl.bindVertexArray(vao);
            
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uTime, timeSeconds);
            gl.uniform3f(uTarget, 0.0, initialTargetY, 0.0);
            
            const roX = Math.sin(yaw) * Math.cos(pitch) * distance;
            const roY = initialTargetY + Math.sin(pitch) * distance;
            const roZ = Math.cos(yaw) * Math.cos(pitch) * distance;
            
            gl.uniform3f(uRo, roX, roY, roZ);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        },
        dispose() {
            canvas.removeEventListener('webglcontextlost', evtHandlers.contextLost);
            canvas.removeEventListener('webglcontextrestored', evtHandlers.contextRestored);
            canvas.removeEventListener('pointerdown', evtHandlers.ptrDown);
            canvas.removeEventListener('pointermove', evtHandlers.ptrMove);
            canvas.removeEventListener('pointerup', evtHandlers.ptrUp);
            canvas.removeEventListener('pointercancel', evtHandlers.ptrUp);
            canvas.removeEventListener('wheel', evtHandlers.wheel);
            canvas.removeEventListener('keydown', evtHandlers.keyDown);
            canvas.removeEventListener('touchmove', evtHandlers.touchMove);
            
            if (gl) {
                const ext = gl.getExtension('WEBGL_lose_context');
                if (ext) ext.loseContext();
            }
        }
    };
}
