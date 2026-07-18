const vertexShaderSource = `#version 300 es
in vec2 position;
out vec2 v_uv;
void main() {
    v_uv = position;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_ro;
uniform vec3 u_rd;
uniform vec3 u_up;
uniform vec3 u_right;

const int MAX_STEPS = 150;
const float MAX_DIST = 50.0;
const float SURF_DIST = 0.002;

// --- SDF Primitives ---

float sdSphere(vec3 p, float s) {
    return length(p) - s;
}

float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

float sdCylinder(vec3 p, vec3 c) {
    return length(p.xz - c.xy) - c.z;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 ab = b - a;
    vec3 ap = p - a;
    float t = dot(ab, ap) / dot(ab, ab);
    t = clamp(t, 0.0, 1.0);
    vec3 c = a + t * ab;
    return length(p - c) - r;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

vec2 smin(vec2 a, vec2 b, float k) {
    float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
    return vec2(mix(b.x, a.x, h) - k * h * (1.0 - h), a.x < b.x ? a.y : b.y);
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// Materials
// 1: Pelican Body (White)
// 2: Pelican Beak (Orange)
// 3: Pelican Eye (Black)
// 4: Bike Frame (Red)
// 5: Bike Tires (Dark Grey)
// 6: Bike Metal (Chrome)
// 7: Ground (Sand)

vec2 mapBike(vec3 p) {
    float d = MAX_DIST;
    float mat = 4.0;
    
    // Wheels
    vec3 pFWheel = p - vec3(0.0, -0.5, 1.2);
    pFWheel.xy *= rot(p.z * 0.1 + u_time * 2.0);
    float fTire = sdTorus(pFWheel.yzx, vec2(0.6, 0.05));
    
    vec3 pRWheel = p - vec3(0.0, -0.5, -1.2);
    pRWheel.xy *= rot(p.z * 0.1 + u_time * 2.0);
    float rTire = sdTorus(pRWheel.yzx, vec2(0.6, 0.05));
    
    float tires = min(fTire, rTire);
    
    // Frame
    float frame = sdCapsule(p, vec3(0.0, -0.5, -1.2), vec3(0.0, 0.2, -0.8), 0.04);
    frame = min(frame, sdCapsule(p, vec3(0.0, -0.5, -1.2), vec3(0.0, -0.5, 0.0), 0.04));
    frame = min(frame, sdCapsule(p, vec3(0.0, 0.2, -0.8), vec3(0.0, -0.5, 0.0), 0.05)); // seat tube
    frame = min(frame, sdCapsule(p, vec3(0.0, 0.2, -0.8), vec3(0.0, 0.6, 1.0), 0.05)); // top tube
    frame = min(frame, sdCapsule(p, vec3(0.0, -0.5, 0.0), vec3(0.0, 0.6, 1.0), 0.06)); // down tube
    
    // Front fork
    frame = min(frame, sdCapsule(p, vec3(0.0, 0.8, 0.95), vec3(0.1, -0.5, 1.2), 0.03));
    frame = min(frame, sdCapsule(p, vec3(0.0, 0.8, 0.95), vec3(-0.1, -0.5, 1.2), 0.03));
    
    // Handlebars
    float bars = sdCapsule(p, vec3(0.3, 0.8, 0.95), vec3(-0.3, 0.8, 0.95), 0.03);
    
    // Seat
    float seat = sdBox(p - vec3(0.0, 0.35, -0.85), vec3(0.1, 0.05, 0.2));
    
    // Pedals and Crank
    vec3 pCrank = p - vec3(0.0, -0.5, 0.0);
    pCrank.yz *= rot(u_time * 4.0);
    float crank = sdCapsule(pCrank, vec3(0.15, 0.2, 0.0), vec3(-0.15, -0.2, 0.0), 0.02);
    float pedals = min(sdBox(pCrank - vec3(0.2, 0.2, 0.0), vec3(0.05, 0.02, 0.08)),
                       sdBox(pCrank - vec3(-0.2, -0.2, 0.0), vec3(0.05, 0.02, 0.08)));
    
    vec2 res = vec2(tires, 5.0);
    if(frame < res.x) res = vec2(frame, 4.0);
    if(bars < res.x) res = vec2(bars, 6.0);
    if(seat < res.x) res = vec2(seat, 5.0);
    if(crank < res.x) res = vec2(crank, 6.0);
    if(pedals < res.x) res = vec2(pedals, 5.0);
    
    return res;
}

vec2 mapPelican(vec3 p) {
    // Body
    vec3 pb = p - vec3(0.0, 0.8, -0.4);
    pb.yz *= rot(0.2);
    float body = sdSphere(pb * vec3(1.2, 1.0, 0.7), 0.5);
    
    // Neck
    float neck = sdCapsule(p, vec3(0.0, 0.9, -0.2), vec3(0.0, 1.6, 0.2), 0.15);
    
    // Head
    vec3 ph = p - vec3(0.0, 1.7, 0.3);
    float head = sdSphere(ph * vec3(1.0, 1.2, 0.9), 0.2);
    
    // Beak
    float beakTop = sdCapsule(p, vec3(0.0, 1.7, 0.4), vec3(0.0, 1.6, 1.2), 0.06);
    float beakPouch = sdCapsule(p, vec3(0.0, 1.55, 0.4), vec3(0.0, 1.55, 1.1), 0.08);
    beakPouch = smin(vec2(beakPouch, 0.0), vec2(sdSphere(p - vec3(0.0, 1.4, 0.6), 0.15), 0.0), 0.1).x; // throat pouch
    
    float beak = min(beakTop, beakPouch);
    
    // Eyes
    float eyes = min(sdSphere(ph - vec3(0.12, 0.05, 0.05), 0.03),
                     sdSphere(ph - vec3(-0.12, 0.05, 0.05), 0.03));
                     
    // Wings
    float lWing = sdCapsule(p, vec3(0.3, 0.9, -0.2), vec3(0.4, 0.5, -0.6), 0.1);
    float rWing = sdCapsule(p, vec3(-0.3, 0.9, -0.2), vec3(-0.4, 0.5, -0.6), 0.1);
    float wings = min(lWing, rWing);
    
    // Legs
    // Animating legs with pedals
    float t = u_time * 4.0;
    vec3 rPedal = vec3(0.2, -0.5 -0.2*cos(t), 0.0 + 0.2*sin(t));
    vec3 lPedal = vec3(-0.2, -0.5 +0.2*cos(t), 0.0 - 0.2*sin(t));
    vec3 hip = vec3(0.2, 0.4, -0.5);
    
    float rLeg = sdCapsule(p, hip, rPedal, 0.04);
    float lLeg = sdCapsule(p, vec3(-hip.x, hip.y, hip.z), lPedal, 0.04);
    float legs = min(rLeg, lLeg);

    float pelicanWhite = min(body, min(neck, min(head, wings)));
    
    vec2 res = vec2(pelicanWhite, 1.0);
    if(beak < res.x) res = vec2(beak, 2.0);
    if(eyes < res.x) res = vec2(eyes, 3.0);
    if(legs < res.x) res = vec2(legs, 2.0); // orange legs
    
    return res;
}

vec2 map(vec3 p) {
    vec2 peli = mapPelican(p);
    vec2 bike = mapBike(p);
    
    // Ground
    float ground = p.y + 1.1; // radius of wheels is 0.6, y=-0.5 -> ground=-1.1
    
    vec2 res = peli;
    if(bike.x < res.x) res = bike;
    if(ground < res.x) res = vec2(ground, 7.0);
    
    return res;
}

vec3 getNormal(vec3 p) {
    float d = map(p).x;
    vec2 e = vec2(0.001, 0);
    vec3 n = d - vec3(
        map(p - e.xyy).x,
        map(p - e.yxy).x,
        map(p - e.yyx).x
    );
    return normalize(n);
}

// Raymarching
vec2 rayMarch(vec3 ro, vec3 rd) {
    float dO = 0.0;
    float mat = 0.0;
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dO;
        vec2 ds = map(p);
        dO += ds.x;
        mat = ds.y;
        if(dO > MAX_DIST || abs(ds.x) < SURF_DIST) break;
    }
    return vec2(dO, mat);
}

float shadow(vec3 ro, vec3 rd) {
    float res = 1.0;
    float t = 0.02;
    for(int i=0; i<30; i++) {
        float h = map(ro + rd*t).x;
        if(h < 0.001) return 0.0;
        res = min(res, 10.0*h/t);
        t += h;
        if(t > 5.0) break;
    }
    return clamp(res, 0.0, 1.0);
}

vec3 render(vec3 ro, vec3 rd) {
    vec2 rm = rayMarch(ro, rd);
    float d = rm.x;
    float m = rm.y;
    
    vec3 col = vec3(0.5, 0.7, 0.9) - rd.y * 0.3; // Sky
    
    if(d < MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 n = getNormal(p);
        vec3 l = normalize(vec3(1.0, 2.0, -1.0));
        
        float dif = clamp(dot(n, l), 0.0, 1.0);
        float sha = shadow(p + n * 0.005, l);
        float amb = 0.5 + 0.5 * dot(n, vec3(0.0, 1.0, 0.0));
        
        vec3 alb = vec3(1.0);
        if(m == 1.0) alb = vec3(0.9, 0.9, 0.95); // Pelican body
        else if(m == 2.0) alb = vec3(1.0, 0.5, 0.0); // Beak/legs
        else if(m == 3.0) alb = vec3(0.05); // Eyes
        else if(m == 4.0) alb = vec3(0.8, 0.1, 0.1); // Frame
        else if(m == 5.0) alb = vec3(0.1); // Tires/Seat
        else if(m == 6.0) alb = vec3(0.7); // Chrome
        else if(m == 7.0) {
            alb = vec3(0.8, 0.7, 0.5); // Ground
            // Checkered pattern for speed illussion
            float check = mod(floor(p.x*2.0) + floor(p.z*2.0 + u_time*5.0), 2.0);
            alb *= 0.8 + 0.2*check;
        }
        
        col = alb * (dif * sha * vec3(1.0, 0.9, 0.8) + amb * vec3(0.2, 0.3, 0.4));
        
        // Specular
        if(m == 6.0 || m == 2.0 || m == 3.0) {
            vec3 h = normalize(l - rd);
            float spe = pow(clamp(dot(n, h), 0.0, 1.0), 32.0);
            col += spe * sha;
        }
        
        // Fog
        col = mix(col, vec3(0.5, 0.7, 0.9), 1.0 - exp(-0.02 * d));
    }
    return col;
}

void main() {
    vec3 ro = u_ro;
    vec3 rd = normalize(u_rd + v_uv.x * u_right * (u_resolution.x/u_resolution.y) + v_uv.y * u_up);
    
    vec3 col = render(ro, rd);
    
    // Gamma correction
    col = pow(col, vec3(0.4545));
    outColor = vec4(col, 1.0);
}
`;

export function createPelicanSdf(canvas) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 not supported');
    
    function createShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('Shader compile error: ' + log);
        }
        return shader;
    }
    
    const vs = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    
    const quad = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
    ]);
    
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    
    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    
    const u_resolution = gl.getUniformLocation(program, 'u_resolution');
    const u_time = gl.getUniformLocation(program, 'u_time');
    const u_ro = gl.getUniformLocation(program, 'u_ro');
    const u_rd = gl.getUniformLocation(program, 'u_rd');
    const u_up = gl.getUniformLocation(program, 'u_up');
    const u_right = gl.getUniformLocation(program, 'u_right');
    
    let camera = {
        yaw: Math.PI / 4, 
        pitch: -Math.PI / 8,
        distance: 6.0
    };
    const center = [0, 0.5, 0];
    
    canvas.tabIndex = 0;
    
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    const onMouseDown = (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    };
    
    const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        
        camera.yaw -= dx * 0.01;
        camera.pitch += dy * 0.01;
        camera.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, camera.pitch));
    };
    
    const onMouseUp = () => { isDragging = false; };
    
    const onWheel = (e) => {
        e.preventDefault();
        camera.distance += e.deltaY * 0.01;
        camera.distance = Math.max(1.0, Math.min(camera.distance, 15.0));
    };
    
    const onKeyDown = (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '-', '=', '+'].includes(e.key)) {
            e.preventDefault();
        }
        const speed = 0.1;
        switch(e.key) {
            case 'ArrowLeft': camera.yaw += speed; break;
            case 'ArrowRight': camera.yaw -= speed; break;
            case 'ArrowUp': camera.pitch += speed; break;
            case 'ArrowDown': camera.pitch -= speed; break;
            case '+':
            case '=': camera.distance -= 0.5; break;
            case '-': camera.distance += 0.5; break;
        }
        camera.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, camera.pitch));
        camera.distance = Math.max(1.0, Math.min(camera.distance, 15.0));
    };
    
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, {passive: false});
    canvas.addEventListener('keydown', onKeyDown);
    
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        }
    }, {passive: false});
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - lastX;
            const dy = e.touches[0].clientY - lastY;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            camera.yaw -= dx * 0.01;
            camera.pitch += dy * 0.01;
            camera.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, camera.pitch));
        }
    }, {passive: false});
    
    canvas.addEventListener('touchend', () => { isDragging = false; });
    
    return {
        render(timeSeconds) {
            if (gl.isContextLost()) return;
            
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.useProgram(program);
            
            gl.uniform2f(u_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.uniform1f(u_time, timeSeconds);
            
            const cy = Math.cos(camera.yaw);
            const sy = Math.sin(camera.yaw);
            const cp = Math.cos(camera.pitch);
            const sp = Math.sin(camera.pitch);
            
            const ro = [
                center[0] + camera.distance * sy * cp,
                center[1] + camera.distance * sp,
                center[2] + camera.distance * cy * cp
            ];
            
            let w = [ center[0] - ro[0], center[1] - ro[1], center[2] - ro[2] ];
            let lenW = Math.hypot(w[0], w[1], w[2]);
            w = [w[0]/lenW, w[1]/lenW, w[2]/lenW];
            
            const up = [0, 1, 0];
            let u = [
                up[1]*w[2] - up[2]*w[1],
                up[2]*w[0] - up[0]*w[2],
                up[0]*w[1] - up[1]*w[0]
            ];
            let lenU = Math.hypot(u[0], u[1], u[2]);
            u = [u[0]/lenU, u[1]/lenU, u[2]/lenU];
            
            let v = [
                w[1]*u[2] - w[2]*u[1],
                w[2]*u[0] - w[0]*u[2],
                w[0]*u[1] - w[1]*u[0]
            ];
            
            gl.uniform3fv(u_ro, ro);
            gl.uniform3fv(u_rd, w);
            gl.uniform3fv(u_right, u);
            gl.uniform3fv(u_up, v);
            
            gl.bindVertexArray(vao);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        },
        
        setView(yaw, pitch, distance) {
            camera.yaw = yaw;
            camera.pitch = pitch;
            camera.distance = distance;
        },
        
        getView() {
            return {
                yaw: camera.yaw,
                pitch: camera.pitch,
                distance: camera.distance
            };
        },
        
        dispose() {
            canvas.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('keydown', onKeyDown);
            
            gl.deleteProgram(program);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            gl.deleteBuffer(vbo);
            gl.deleteVertexArray(vao);
        }
    };
}
