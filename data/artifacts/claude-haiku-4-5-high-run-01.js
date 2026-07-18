export function createPelicanSdf(canvas) {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 not available');

  const vs = `#version 300 es
    precision highp float;
    in vec2 p;
    out vec2 uv;
    void main() {
      uv = p * .5 + .5;
      gl_Position = vec4(p, 0., 1.);
    }`;

  const fs = `#version 300 es
    precision highp float;
    uniform vec3 cp, cd, cr, cu;
    uniform float t;
    in vec2 uv;
    out vec4 col;

    float sd(vec3 p, float r) { return length(p) - r; }
    float sb(vec3 p, vec3 b) {
      vec3 q = abs(p) - b;
      return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.);
    }
    float sc(vec3 p, float h, float r) {
      vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
      return min(max(d.x, d.y), 0.) + length(max(d, 0.));
    }
    float st(vec3 p, float r1, float r2) {
      vec2 q = vec2(length(p.xz) - r1, p.y);
      return length(q) - r2;
    }
    float scap(vec3 p, vec3 a, vec3 b, float r) {
      vec3 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
      return length(pa - ba * h) - r;
    }

    float scene(vec3 p) {
      float d = 1e10;
      
      // Pelican body
      d = min(d, sd(p - vec3(0., .72, 0.), .3));
      d = min(d, sd(p - vec3(.1, .82, 0.), .25));
      
      // Head
      d = min(d, sd(p - vec3(.2, 1.05, 0.), .11));
      
      // Long beak
      d = min(d, scap(p, vec3(.3, 1.05, 0.), vec3(.75, 1., 0.), .038));
      
      // Throat pouch
      d = min(d, sd(p - vec3(.4, .9, 0.), .06));
      
      // Wings
      d = min(d, sb(p - vec3(-.15, .75, .12), vec3(.1, .2, .08)));
      d = min(d, sb(p - vec3(-.15, .75, -.12), vec3(.1, .2, .08)));
      
      // Eyes
      d = min(d, sd(p - vec3(.25, 1.08, .07), .015));
      d = min(d, sd(p - vec3(.25, 1.08, -.07), .015));
      
      // Legs on pedals
      d = min(d, scap(p, vec3(.05, .5, -.08), vec3(.1, .2, -.15), .02));
      d = min(d, scap(p, vec3(-.05, .5, .08), vec3(-.1, .2, .15), .02));
      
      // Bicycle frame tubes
      d = min(d, scap(p, vec3(0., .5, 0.), vec3(0., .08, 0.), .024));
      d = min(d, scap(p, vec3(0., .5, 0.), vec3(-.3, .08, 0.), .023));
      d = min(d, scap(p, vec3(0., .08, 0.), vec3(.3, .08, 0.), .024));
      d = min(d, scap(p, vec3(.3, .08, 0.), vec3(0., .5, 0.), .023));
      
      // Seat
      d = min(d, sb(p - vec3(0., .52, 0.), vec3(.06, .025, .1)));
      
      // Handlebars
      d = min(d, scap(p, vec3(0., .48, -.08), vec3(0., .48, .08), .023));
      d = min(d, scap(p, vec3(0., .48, 0.), vec3(0., .54, 0.), .018));
      
      // Bottom bracket
      d = min(d, sd(p - vec3(0., .08, 0.), .033));
      
      // Rotating crank
      float ca = t * 2.5;
      float cx = sin(ca) * .07;
      float cz = cos(ca) * .07;
      d = min(d, scap(p, vec3(0., .08, 0.), vec3(cx, .08, cz), .011));
      d = min(d, scap(p, vec3(0., .08, 0.), vec3(-cx, .08, -cz), .011));
      
      // Pedals
      d = min(d, sb(p - vec3(cx * .8, .05, cz * .8), vec3(.018, .032, .025)));
      d = min(d, sb(p - vec3(-cx * .8, .05, -cz * .8), vec3(.018, .032, .025)));
      
      // Rear wheel left
      d = min(d, st(p - vec3(-.3, .08, 0.), .24, .027));
      d = min(d, sc(p - vec3(-.3, .08, 0.), .06, .24));
      
      // Rear wheel right
      d = min(d, st(p - vec3(.3, .08, 0.), .24, .027));
      d = min(d, sc(p - vec3(.3, .08, 0.), .06, .24));
      
      return d;
    }

    vec3 norm(vec3 p) {
      const float e = .001;
      vec2 g = vec2(1, -1) * .5773;
      return normalize(
        g.xyy * scene(p + g.xyy * e) +
        g.yyx * scene(p + g.yyx * e) +
        g.yxy * scene(p + g.yxy * e) +
        g.xxx * scene(p + g.xxx * e)
      );
    }

    void main() {
      vec3 rd = normalize((uv.x - .5) * cr + (uv.y - .5) * cu + cd);
      vec3 ro = cp;
      float depth = 0.;
      for (int i = 0; i < 100; i++) {
        float s = scene(ro);
        if (abs(s) < .0008 || depth > 40.) break;
        ro += rd * s;
        depth += s;
      }
      
      vec3 c = vec3(.05, .08, .12);
      if (scene(ro) < .001) {
        vec3 n = norm(ro);
        vec3 l = normalize(vec3(1., 1.2, .6));
        float diff = max(0., dot(n, l)) * .7 + .3;
        c = mix(vec3(.85, .75, .65), vec3(.4, .3, .2), .5) * diff;
      }
      col = vec4(c, 1.);
    }`;

  function compileShader(src, t) {
    const sh = gl.createShader(t);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  const prg = gl.createProgram();
  gl.attachShader(prg, compileShader(vs, gl.VERTEX_SHADER));
  gl.attachShader(prg, compileShader(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prg);
  if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prg));
  gl.useProgram(prg);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prg, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, 0, 0, 0);

  let yaw = .3, pitch = .2, distance = 2.2;
  let md = false, lx = 0, ly = 0;

  const md_h = e => { md = true; lx = e.clientX; ly = e.clientY; };
  const mm_h = e => {
    if (!md) return;
    yaw += (e.clientX - lx) * .008;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + (e.clientY - ly) * .008));
    lx = e.clientX; ly = e.clientY;
  };
  const mu_h = () => { md = false; };
  const w_h = e => {
    e.preventDefault();
    distance *= 1 + e.deltaY * .0008;
    distance = Math.max(.5, Math.min(8, distance));
  };
  const k_h = e => {
    const s = .04;
    if (e.key === 'ArrowLeft') yaw -= s;
    if (e.key === 'ArrowRight') yaw += s;
    if (e.key === 'ArrowUp') pitch += s;
    if (e.key === 'ArrowDown') pitch -= s;
    if (e.key === '+') distance *= .91;
    if (e.key === '-') distance *= 1.1;
  };

  canvas.addEventListener('mousedown', md_h);
  canvas.addEventListener('mousemove', mm_h);
  canvas.addEventListener('mouseup', mu_h);
  canvas.addEventListener('wheel', w_h, { passive: false });
  canvas.addEventListener('keydown', k_h);
  canvas.tabIndex = 0;

  const render = time => {
    gl.useProgram(prg);
    gl.bindVertexArray(vao);
    
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp_v = Math.cos(pitch), sp = Math.sin(pitch);
    const cpos = [distance * cy * cp_v, distance * sp, distance * sy * cp_v];
    const cdir = [-cpos[0], -cpos[1], -cpos[2]];
    const len = Math.hypot(cdir[0], cdir[1], cdir[2]);
    cdir[0] /= len; cdir[1] /= len; cdir[2] /= len;
    const cr = [sy, 0, -cy];
    const cu = [-sp * cy, cp_v, -sp * sy];
    
    gl.uniform3fv(gl.getUniformLocation(prg, 'cp'), cpos);
    gl.uniform3fv(gl.getUniformLocation(prg, 'cd'), cdir);
    gl.uniform3fv(gl.getUniformLocation(prg, 'cr'), cr);
    gl.uniform3fv(gl.getUniformLocation(prg, 'cu'), cu);
    gl.uniform1f(gl.getUniformLocation(prg, 't'), time);
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const dispose = () => {
    canvas.removeEventListener('mousedown', md_h);
    canvas.removeEventListener('mousemove', mm_h);
    canvas.removeEventListener('mouseup', mu_h);
    canvas.removeEventListener('wheel', w_h);
    canvas.removeEventListener('keydown', k_h);
    gl.deleteProgram(prg);
    gl.deleteBuffer(buf);
    gl.deleteVertexArray(vao);
  };

  return { render, setView: (y, p, d) => { yaw = y; pitch = p; distance = d; }, getView: () => ({ yaw, pitch, distance }), dispose };
}
