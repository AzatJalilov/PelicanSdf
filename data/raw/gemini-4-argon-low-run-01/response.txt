export function createPelicanSdf(canvas) {
  if (!canvas || typeof canvas.getContext !== "function") {
    throw new Error("A valid HTMLCanvasElement is required.");
  }

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });

  if (!gl) {
    throw new Error("WebGL2 is unavailable.");
  }

  const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

const vec2 POS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2( 3.0, -1.0),
  vec2(-1.0,  3.0)
);

out vec2 vUv;

void main() {
  vec2 p = POS[gl_VertexID];
  vUv = 0.5 * p + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

  const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform vec4 uAnim0; // x: wheelAngle, y: crankAngle, z: bob, w: headNod
uniform vec4 uAnim1; // x: pouchBob, y: tailBob, z: sinCrank, w: cosCrank
uniform vec4 uFootR; // xyz: right pedal/foot pos, w: unused
uniform vec4 uFootL; // xyz: left pedal/foot pos, w: unused
uniform vec4 uKneeR; // xyz: right knee pos, w: time
uniform vec4 uKneeL; // xyz: left knee pos, w: steer

const float PI = 3.14159265359;
const float MAX_DIST = 26.0;
const float GROUND_Y = -1.03;

const float MAT_CHROME    = 1.0;
const float MAT_TIRE      = 2.0;
const float MAT_FRAME     = 3.0;
const float MAT_LEATHER   = 4.0;
const float MAT_FEATHER   = 5.0;
const float MAT_WING_TIP  = 6.0;
const float MAT_BEAK      = 7.0;
const float MAT_POUCH     = 8.0;
const float MAT_EYE_WHITE = 9.0;
const float MAT_PUPIL     = 10.0;
const float MAT_FOOT      = 11.0;
const float MAT_CAP       = 12.0;
const float MAT_BRASS     = 13.0;
const float MAT_SCARF     = 14.0;
const float MAT_BLUSH     = 15.0;
const float MAT_GROUND    = 16.0;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
  return -smin(-a, -b, k);
}

vec2 opU(vec2 a, vec2 b) {
  return (a.x < b.x) ? a : b;
}

vec2 opUSmooth(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  float d = mix(b.x, a.x, h) - k * h * (1.0 - h);
  float m = (a.x < b.x) ? a.y : b.y;
  return vec2(d, m);
}

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-4);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

float sdTorusZ(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xy) - t.x, p.z);
  return length(q) - t.y;
}

float sdTorusY(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdCappedCylinderZ(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdCappedCylinderY(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdArcZ(vec2 p, vec2 sc, float ra, float rb) {
  p.x = abs(p.x);
  float k = (sc.y * p.x > sc.x * p.y) ? dot(p, sc) : length(p);
  return sqrt(max(0.0, dot(p, p) + ra * ra - 2.0 * ra * k)) - rb;
}

float sdWheel(vec3 p, float ang, out float mat) {
  float tire = sdTorusZ(p, vec2(0.56, 0.064));
  float rim = sdTorusZ(p, vec2(0.495, 0.025));
  float hub = sdCappedCylinderZ(p, 0.056, 0.075);
  hub = min(hub, sdCappedCylinderZ(vec3(p.xy, abs(p.z) - 0.048), 0.078, 0.012));

  vec2 pr = rot(ang) * p.xy;
  float r = length(pr);
  float a = atan(pr.y, pr.x);
  float n = 12.0;
  float ia = floor(a / (2.0 * PI / n) + 0.5) * (2.0 * PI / n);
  vec2 q = rot(-ia) * pr;
  float zOff = 0.032 * sin(ia * 6.0);
  vec3 sp = vec3(q.x - 0.275, q.y, p.z - zOff * clamp((0.49 - r) / 0.43, 0.0, 1.0));
  float spokes = length(vec2(max(abs(sp.x) - 0.215, 0.0), length(sp.yz))) - 0.0085;

  float d = tire;
  mat = MAT_TIRE;
  float metal = min(min(rim, hub), spokes);
  if (metal < d) {
    d = metal;
    mat = MAT_CHROME;
  }
  return d;
}

vec2 sdBicycle(vec3 p) {
  float bnd = sdBox(p - vec3(0.03, -0.02, 0.0), vec3(1.85, 1.25, 0.65));
  if (bnd > 0.25) return vec2(bnd, MAT_FRAME);

  vec2 res = vec2(MAX_DIST, MAT_FRAME);

  vec3 rearC = vec3(-0.95, -0.42, 0.0);
  vec3 frontC = vec3(0.95, -0.42, 0.0);
  vec3 bbC = vec3(-0.12, -0.40, 0.0);
  vec3 seatCluster = vec3(-0.42, 0.34, 0.0);
  vec3 headBot = vec3(0.60, 0.21, 0.0);
  vec3 headTop = vec3(0.50, 0.49, 0.0);

  // Wheels
  float wMat;
  float dRearW = sdWheel(p - rearC, uAnim0.x, wMat);
  res = opU(res, vec2(dRearW, wMat));

  vec3 pf = p - frontC;
  pf.xz = rot(uKneeL.w) * pf.xz;
  float dFrontW = sdWheel(pf, uAnim0.x, wMat);
  res = opU(res, vec2(dFrontW, wMat));

  // Main painted frame
  float frame = sdCapsule(p, bbC, seatCluster, 0.033);
  frame = smin(frame, sdCapsule(p, seatCluster, headTop, 0.031), 0.025);
  frame = smin(frame, sdCapsule(p, bbC, headBot, 0.035), 0.025);
  frame = smin(frame, sdCapsule(p, headBot - vec3(0.02, 0.05, 0.0), headTop + vec3(-0.02, 0.05, 0.0), 0.039), 0.02);

  // Rear stays (mirrored in Z)
  vec3 pm = vec3(p.xy, abs(p.z));
  float stays = sdCapsule(pm, vec3(rearC.xy, 0.072), vec3(bbC.xy, 0.048), 0.021);
  stays = min(stays, sdCapsule(pm, vec3(rearC.xy, 0.072), vec3(seatCluster.xy + vec2(0.0, -0.02), 0.038), 0.019));
  frame = smin(frame, stays, 0.018);

  // Front fork
  vec3 forkCrown = vec3(0.62, 0.16, 0.0);
  float fork = sdCapsule(p, headBot, forkCrown, 0.031);
  fork = smin(fork, sdCapsule(pm, vec3(forkCrown.xy, 0.0), vec3(0.67, 0.09, 0.068), 0.024), 0.018);
  fork = smin(fork, sdCapsule(pm, vec3(0.67, 0.09, 0.068), vec3(frontC.xy, 0.068), 0.021), 0.014);
  frame = min(frame, fork);

  // Cute fenders
  vec3 prF = p - rearC;
  float rearFender = max(
    abs(length(prF.xy) - 0.635) - 0.014,
    max(abs(prF.z) - 0.075, -prF.y - 0.08)
  );
  vec3 pfF = pf;
  float frontFender = max(
    abs(length(pfF.xy) - 0.635) - 0.014,
    max(abs(pfF.z) - 0.075, -pfF.y - 0.05)
  );
  frame = min(frame, min(rearFender, frontFender));
  res = opU(res, vec2(frame, MAT_FRAME));

  // Chrome seatpost, stem, handlebars, crank, chainring
  vec3 seatTop = vec3(-0.48, 0.50, 0.0);
  float chrome = sdCapsule(p, seatCluster, seatTop, 0.022);
  chrome = min(chrome, sdCappedCylinderZ(p - bbC, 0.048, 0.085));

  vec3 stemTop = vec3(0.45, 0.66, 0.0);
  vec3 stemFwd = vec3(0.55, 0.69, 0.0);
  chrome = min(chrome, sdCapsule(p, headTop, stemTop, 0.023));
  chrome = smin(chrome, sdCapsule(p, stemTop, stemFwd, 0.023), 0.012);

  // Swept cruiser handlebars (mirrored Z)
  vec3 hb0 = vec3(0.55, 0.69, 0.0);
  vec3 hb1 = vec3(0.58, 0.72, 0.18);
  vec3 hb2 = vec3(0.46, 0.71, 0.34);
  vec3 hb3 = vec3(0.32, 0.69, 0.40);
  float hbar = sdCapsule(pm, hb0, hb1, 0.019);
  hbar = smin(hbar, sdCapsule(pm, hb1, hb2, 0.019), 0.02);
  hbar = smin(hbar, sdCapsule(pm, hb2, hb3, 0.019), 0.02);
  chrome = min(chrome, hbar);

  // Chainring & rear cog
  float ring = max(sdCappedCylinderZ(p - (bbC + vec3(0.0, 0.0, 0.068)), 0.145, 0.010),
                   -sdCappedCylinderZ(p - (bbC + vec3(0.0, 0.0, 0.068)), 0.105, 0.025));
  vec2 cpr = rot(uAnim0.y) * (p.xy - bbC.xy);
  float cSpokes = min(
    sdBox(vec3(cpr, p.z - 0.068), vec3(0.13, 0.014, 0.009)),
    sdBox(vec3(rot(PI * 0.5) * cpr, p.z - 0.068), vec3(0.13, 0.014, 0.009))
  );
  chrome = min(chrome, min(ring, cSpokes));
  chrome = min(chrome, sdCappedCylinderZ(p - (rearC + vec3(0.0, 0.0, 0.056)), 0.062, 0.010));

  // Crank arms + pedal spindles
  vec3 crankR = vec3(bbC.x + 0.18 * uAnim1.w, bbC.y + 0.18 * uAnim1.z, 0.105);
  vec3 crankL = vec3(bbC.x - 0.18 * uAnim1.w, bbC.y - 0.18 * uAnim1.z, -0.105);
  chrome = min(chrome, sdCapsule(p, bbC + vec3(0.0, 0.0, 0.095), crankR, 0.018));
  chrome = min(chrome, sdCapsule(p, bbC + vec3(0.0, 0.0, -0.095), crankL, 0.018));
  chrome = min(chrome, sdCapsule(p, crankR, uFootR.xyz, 0.012));
  chrome = min(chrome, sdCapsule(p, crankL, uFootL.xyz, 0.012));

  // Saddle rails + springs
  chrome = min(chrome, sdCapsule(pm, vec3(-0.48, 0.48, 0.02), vec3(-0.37, 0.50, 0.05), 0.010));
  chrome = min(chrome, sdCappedCylinderY(pm - vec3(-0.56, 0.49, 0.065), 0.024, 0.032));
  res = opU(res, vec2(chrome, MAT_CHROME));

  // Chain loop & pedal blocks & grips (dark rubber/metal)
  float chainTop = sdCapsule(p, bbC + vec3(0.0, 0.135, 0.062), rearC + vec3(0.0, 0.058, 0.055), 0.011);
  float chainBot = sdCapsule(p, bbC + vec3(0.0, -0.135, 0.062), rearC + vec3(0.0, -0.058, 0.055), 0.011);
  float pedalR = sdRoundBox(p - uFootR.xyz, vec3(0.065, 0.016, 0.048), 0.006);
  float pedalL = sdRoundBox(p - uFootL.xyz, vec3(0.065, 0.016, 0.048), 0.006);
  float darkParts = min(min(chainTop, chainBot), min(pedalR, pedalL));
  res = opU(res, vec2(darkParts, MAT_TIRE));

  // Leather saddle and handlebar grips
  vec3 sp = p - vec3(-0.49, 0.545, 0.0);
  sp.xy = rot(-0.07) * sp.xy;
  float saddleBack = sdEllipsoid(sp - vec3(-0.055, 0.0, 0.0), vec3(0.115, 0.042, 0.125));
  float saddleNose = sdCapsule(sp, vec3(-0.05, 0.0, 0.0), vec3(0.14, -0.01, 0.0), 0.038);
  float saddle = smin(saddleBack, saddleNose, 0.04);
  float grips = sdCapsule(pm, hb2, hb3, 0.028);
  res = opU(res, vec2(min(saddle, grips), MAT_LEATHER));

  // Brass bell + vintage headlamp
  float bell = sdSphere(p - vec3(0.48, 0.755, 0.20), 0.034);
  vec3 lp = p - vec3(0.65, 0.52, 0.0);
  lp.xy = rot(-0.12) * lp.xy;
  float lampBody = sdTaperedCapsule(lp, vec3(-0.05, 0.0, 0.0), vec3(0.04, 0.0, 0.0), 0.032, 0.055);
  res = opU(res, vec2(min(bell, lampBody), MAT_BRASS));
  float lampLens = sdSphere(lp - vec3(0.045, 0.0, 0.0), 0.046);
  res = opU(res, vec2(lampLens, MAT_EYE_WHITE));

  return res;
}

vec2 sdPelican(vec3 p) {
  float bnd = sdBox(p - vec3(0.12, 0.72, 0.0), vec3(1.38, 1.32, 0.72));
  if (bnd > 0.25) return vec2(bnd, MAT_FEATHER);

  vec2 res = vec2(MAX_DIST, MAT_FEATHER);

  float bob = uAnim0.z;
  float nod = uAnim0.w;
  float pouchBob = uAnim1.x;
  float tailBob = uAnim1.y;

  // Torso, chest, rump & tail feathers
  vec3 bp = p - vec3(-0.34, 0.80 + bob, 0.0);
  vec3 bpr = bp;
  bpr.xy = rot(-0.26) * bpr.xy;

  float body = sdEllipsoid(bpr, vec3(0.35, 0.25, 0.24));
  float chest = sdEllipsoid(bp - vec3(0.19, 0.11, 0.0), vec3(0.23, 0.22, 0.21));
  float belly = sdEllipsoid(bp - vec3(-0.03, -0.10, 0.0), vec3(0.27, 0.19, 0.21));
  body = smin(body, chest, 0.09);
  body = smin(body, belly, 0.08);

  // Tail feathers
  vec3 tp = bp - vec3(-0.33, 0.04 + tailBob, 0.0);
  tp.xy = rot(0.35) * tp.xy;
  float tail = sdTaperedCapsule(tp, vec3(0.0, 0.0, 0.0), vec3(-0.20, 0.07, 0.0), 0.11, 0.028);
  tail = smin(tail, sdTaperedCapsule(vec3(tp.xy, abs(tp.z)), vec3(0.02, -0.01, 0.03), vec3(-0.17, 0.05, 0.09), 0.075, 0.022), 0.025);
  body = smin(body, tail, 0.055);

  // S-curved neck
  vec3 n0 = vec3(-0.18, 0.93 + bob, 0.0);
  vec3 n1 = vec3(-0.02, 1.07 + bob, 0.0);
  vec3 n2 = vec3(-0.08, 1.24 + bob, 0.0);
  vec3 n3 = vec3(0.03, 1.40 + bob, 0.0);
  float neck = sdTaperedCapsule(p, n0, n1, 0.125, 0.095);
  neck = smin(neck, sdTaperedCapsule(p, n1, n2, 0.095, 0.086), 0.045);
  neck = smin(neck, sdTaperedCapsule(p, n2, n3, 0.086, 0.092), 0.045);
  body = smin(body, neck, 0.075);

  // Head & playful crest feathers
  vec3 hp = p - n3;
  hp.xy = rot(nod) * hp.xy;
  float head = sdEllipsoid(hp - vec3(0.03, 0.03, 0.0), vec3(0.145, 0.125, 0.118));
  float brow = sdCapsule(vec3(hp.xy, abs(hp.z)), vec3(0.07, 0.08, 0.05), vec3(0.14, 0.06, 0.085), 0.032);
  head = smin(head, brow, 0.025);
  float crest1 = sdTaperedCapsule(hp, vec3(-0.06, 0.09, 0.0), vec3(-0.24, 0.15, 0.0), 0.045, 0.012);
  float crest2 = sdTaperedCapsule(hp, vec3(-0.08, 0.05, 0.0), vec3(-0.22, 0.07, 0.0), 0.036, 0.010);
  head = smin(head, smin(crest1, crest2, 0.02), 0.03);
  body = smin(body, head, 0.045);

  // Thigh drumsticks (feathered)
  vec3 hipR = vec3(-0.36, 0.60 + bob, 0.14);
  vec3 hipL = vec3(-0.36, 0.60 + bob, -0.14);
  float thighR = sdTaperedCapsule(p, hipR, mix(hipR, uKneeR.xyz, 0.55), 0.078, 0.042);
  float thighL = sdTaperedCapsule(p, hipL, mix(hipL, uKneeL.xyz, 0.55), 0.078, 0.042);
  body = smin(body, min(thighR, thighL), 0.04);

  // Wings reaching to handlebars (mirrored Z)
  vec3 pm = vec3(p.xy, abs(p.z));
  vec3 sh = vec3(-0.24, 0.90 + bob, 0.19);
  vec3 el = vec3(0.03, 0.78 + 0.6 * bob, 0.34);
  vec3 wr = vec3(0.35, 0.69, 0.36);

  float uArm = sdTaperedCapsule(pm, sh, el, 0.085, 0.068);
  float fArm = sdTaperedCapsule(pm, el, wr, 0.068, 0.052);
  float wing = smin(uArm, fArm, 0.04);

  // Layered wing coverts along the upper/forearm
  vec3 wc = pm - vec3(-0.06, 0.81 + 0.8 * bob, 0.285);
  wc.xy = rot(-0.22) * wc.xy;
  wc.xz = rot(0.32) * wc.xz;
  float wingBlade = sdRoundBox(wc, vec3(0.24, 0.065, 0.022), 0.022);
  wing = smin(wing, wingBlade, 0.035);
  body = smin(body, wing, 0.045);

  res = opU(res, vec2(body, MAT_FEATHER));

  // Primary wingtip feathers gripping the handlebar
  float f1 = sdTaperedCapsule(pm, wr + vec3(-0.02, 0.02, 0.01), vec3(0.45, 0.71, 0.35), 0.036, 0.020);
  float f2 = sdTaperedCapsule(pm, wr + vec3(-0.03, 0.00, 0.02), vec3(0.40, 0.69, 0.38), 0.034, 0.019);
  float f3 = sdTaperedCapsule(pm, wr + vec3(-0.04, -0.02, 0.02), vec3(0.35, 0.67, 0.40), 0.032, 0.018);
  float wingTips = smin(f1, smin(f2, f3, 0.015), 0.015);
  res = opUSmooth(res, vec2(wingTips, MAT_WING_TIP), 0.02);

  // Long pelican upper beak + hooked nail tip + lower mandible
  vec3 bStart = vec3(0.12, 0.03, 0.0);
  vec3 bEnd = vec3(0.84, -0.05, 0.0);
  vec3 ba = hp - bStart;
  vec3 bb = bEnd - bStart;
  float bh = clamp(dot(ba, bb) / dot(bb, bb), 0.0, 1.0);
  vec3 bCurve = hp - (bStart + bb * bh + vec3(0.0, 0.022 * sin(bh * PI), 0.0));
  vec3 bRad = mix(vec3(0.06, 0.046, 0.068), vec3(0.025, 0.016, 0.024), bh);
  float upperBeak = length(bCurve / vec3(1.0, bRad.y / bRad.x, bRad.z / bRad.x)) - bRad.x;
  float beakRidge = sdTaperedCapsule(hp, vec3(0.13, 0.062, 0.0), vec3(0.82, -0.032, 0.0), 0.022, 0.011);
  upperBeak = smin(upperBeak, beakRidge, 0.018);
  float beakHook = sdTaperedCapsule(hp, vec3(0.82, -0.04, 0.0), vec3(0.87, -0.095, 0.0), 0.022, 0.009);
  upperBeak = smin(upperBeak, beakHook, 0.015);

  vec3 jawRim = vec3(hp.xy, abs(hp.z));
  float lowerJaw = sdTaperedCapsule(jawRim, vec3(0.11, -0.01, 0.058), vec3(0.80, -0.06, 0.016), 0.016, 0.009);
  float beak = smin(upperBeak, lowerJaw, 0.015);
  res = opU(res, vec2(beak, MAT_BEAK));

  // Signature throat pouch (gular sac) hanging under the beak
  vec3 pp = hp - vec3(0.43, -0.15 + pouchBob, 0.0);
  pp.xy = rot(-0.08) * pp.xy;
  vec3 pq = pp;
  pq.y -= 0.05 * cos(clamp(pq.x * 3.8, -1.5, 1.5));
  pq.z *= 1.0 + 0.35 * clamp(-pq.y * 3.0, -0.3, 0.8);
  float pouch = sdEllipsoid(pq, vec3(0.34, 0.145, 0.095));
  float throatJoin = sdTaperedCapsule(hp, vec3(0.06, -0.08, 0.0), vec3(0.32, -0.17 + pouchBob, 0.0), 0.082, 0.115);
  pouch = smin(pouch, throatJoin, 0.06);
  // Subtle longitudinal throat folds
  pouch += 0.003 * sin(hp.x * 28.0) * smoothstep(0.0, -0.18, hp.y);
  // Carve hollow inside top of pouch below upper beak
  vec3 hollowP = hp - vec3(0.45, -0.03, 0.0);
  float hollow = sdEllipsoid(hollowP, vec3(0.30, 0.065, 0.065));
  pouch = smax(pouch, -hollow, 0.02);
  res = opU(res, vec2(pouch, MAT_POUCH));

  // Eyes (mirrored Z)
  vec3 hpM = vec3(hp.xy, abs(hp.z));
  float eyeRing = sdSphere(hpM - vec3(0.082, 0.052, 0.088), 0.036);
  res = opU(res, vec2(eyeRing, MAT_BEAK));
  float eyeWhite = sdSphere(hpM - vec3(0.088, 0.052, 0.095), 0.030);
  res = opU(res, vec2(eyeWhite, MAT_EYE_WHITE));
  float pupil = sdSphere(hpM - vec3(0.106, 0.054, 0.111), 0.015);
  res = opU(res, vec2(pupil, MAT_PUPIL));

  // Rosy cheek blush
  float cheek = sdEllipsoid(hpM - vec3(0.095, 0.005, 0.095), vec3(0.032, 0.020, 0.018));
  res = opU(res, vec2(cheek, MAT_BLUSH));

  // Jaunty sailor cap on the pelican's head
  vec3 cp = hp - vec3(-0.01, 0.135, 0.0);
  cp.xy = rot(0.16) * cp.xy;
  float capBrim = sdCappedCylinderY(cp, 0.082, 0.018);
  float capCrown = sdEllipsoid(cp - vec3(0.0, 0.032, 0.0), vec3(0.098, 0.042, 0.098));
  float cap = smin(capBrim, capCrown, 0.015);
  res = opU(res, vec2(cap, MAT_CAP));
  float capBand = max(sdCappedCylinderY(cp - vec3(0.0, 0.006, 0.0), 0.085, 0.010),
                      -sdCappedCylinderY(cp - vec3(0.0, 0.006, 0.0), 0.075, 0.020));
  res = opU(res, vec2(capBand, MAT_SCARF));

  // Cozy neck scarf + fluttering tail
  vec3 sp = p - vec3(-0.04, 1.04 + bob, 0.0);
  sp.xy = rot(-0.22) * sp.xy;
  float scarfRing = sdTorusY(sp, vec2(0.102, 0.028));
  vec3 st0 = vec3(-0.11, 1.03 + bob, 0.08);
  vec3 st1 = vec3(-0.30, 0.99 + bob + 0.02 * tailBob, 0.15);
  vec3 st2 = vec3(-0.47, 1.02 + bob - 0.5 * tailBob, 0.19);
  float scarfTail = sdTaperedCapsule(p, st0, st1, 0.026, 0.032);
  scarfTail = smin(scarfTail, sdTaperedCapsule(p, st1, st2, 0.032, 0.018), 0.02);
  res = opU(res, vec2(smin(scarfRing, scarfTail, 0.02), MAT_SCARF));

  // Orange legs (upper leg, knobby knee, lower shin, and 3-toed webbed feet on pedals)
  float legR = sdCapsule(p, hipR, uKneeR.xyz, 0.024);
  legR = smin(legR, sdCapsule(p, uKneeR.xyz, uFootR.xyz + vec3(0.0, 0.022, 0.0), 0.020), 0.022);
  legR = smin(legR, sdSphere(p - uKneeR.xyz, 0.029), 0.015);

  float legL = sdCapsule(p, hipL, uKneeL.xyz, 0.024);
  legL = smin(legL, sdCapsule(p, uKneeL.xyz, uFootL.xyz + vec3(0.0, 0.022, 0.0), 0.020), 0.022);
  legL = smin(legL, sdSphere(p - uKneeL.xyz, 0.029), 0.015);

  // Webbed feet (right and left)
  vec3 fr = p - (uFootR.xyz + vec3(0.0, 0.02, 0.0));
  float footR = sdTaperedCapsule(fr, vec3(-0.03, 0.0, 0.0), vec3(0.10, -0.006, 0.0), 0.022, 0.014);
  footR = smin(footR, sdTaperedCapsule(fr, vec3(-0.02, 0.0, 0.0), vec3(0.085, -0.006, 0.055), 0.018, 0.012), 0.022);
  footR = smin(footR, sdTaperedCapsule(fr, vec3(-0.02, 0.0, 0.0), vec3(0.085, -0.006, -0.055), 0.018, 0.012), 0.022);
  float webR = sdRoundBox(fr - vec3(0.035, -0.006, 0.0), vec3(0.048, 0.005, 0.042), 0.006);
  footR = smin(footR, webR, 0.015);

  vec3 fl = p - (uFootL.xyz + vec3(0.0, 0.02, 0.0));
  float footL = sdTaperedCapsule(fl, vec3(-0.03, 0.0, 0.0), vec3(0.10, -0.006, 0.0), 0.022, 0.014);
  footL = smin(footL, sdTaperedCapsule(fl, vec3(-0.02, 0.0, 0.0), vec3(0.085, -0.006, 0.055), 0.018, 0.012), 0.022);
  footL = smin(footL, sdTaperedCapsule(fl, vec3(-0.02, 0.0, 0.0), vec3(0.085, -0.006, -0.055), 0.018, 0.012), 0.022);
  float webL = sdRoundBox(fl - vec3(0.035, -0.006, 0.0), vec3(0.048, 0.005, 0.042), 0.006);
  footL = smin(footL, webL, 0.015);

  float legs = min(smin(legR, footR, 0.018), smin(legL, footL, 0.018));
  res = opU(res, vec2(legs, MAT_FOOT));

  return res;
}

vec2 sdSceneSubject(vec3 p) {
  return opU(sdBicycle(p), sdPelican(p));
}

vec2 mapScene(vec3 p) {
  vec2 res = sdSceneSubject(p);
  float ground = p.y - GROUND_Y;
  if (ground < res.x) {
    res = vec2(ground, MAT_GROUND);
  }
  return res;
}

bool intersectSubjectBounds(vec3 ro, vec3 rd, out float tMin, out float tMax) {
  vec3 bMin = vec3(-1.95, -1.12, -0.78);
  vec3 bMax = vec3( 1.95,  2.15,  0.78);
  vec3 invD = 1.0 / rd;
  vec3 t0s = (bMin - ro) * invD;
  vec3 t1s = (bMax - ro) * invD;
  vec3 tsmaller = min(t0s, t1s);
  vec3 tbigger  = max(t0s, t1s);
  tMin = max(0.0, max(tsmaller.x, max(tsmaller.y, tsmaller.z)));
  tMax = min(MAX_DIST, min(tbigger.x, min(tbigger.y, tbigger.z)));
  return tMax >= tMin;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0012;
  return normalize(
    e.xyy * sdSceneSubject(p + e.xyy).x +
    e.yyx * sdSceneSubject(p + e.yyx).x +
    e.yxy * sdSceneSubject(p + e.yxy).x +
    e.xxx * sdSceneSubject(p + e.xxx).x
  );
}

float calcSoftShadow(vec3 ro, vec3 rd, float tMax) {
  float bMin, bMax;
  if (!intersectSubjectBounds(ro, rd, bMin, bMax)) return 1.0;
  float res = 1.0;
  float t = max(0.02, bMin);
  float limit = min(tMax, bMax);
  for (int i = 0; i < 24; i++) {
    if (t > limit) break;
    float h = sdSceneSubject(ro + rd * t).x;
    if (h < 0.001) return 0.0;
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.02, 0.18);
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.035 * float(i);
    float d = mapScene(p + n * h).x;
    occ += (h - d) * sca;
    sca *= 0.65;
  }
  return clamp(1.0 - 2.4 * occ, 0.0, 1.0);
}

vec3 skyColor(vec3 rd) {
  vec3 sunDir = normalize(vec3(0.56, 0.68, 0.47));
  float y = clamp(rd.y, 0.0, 1.0);
  vec3 top = vec3(0.33, 0.65, 0.92);
  vec3 hor = vec3(0.95, 0.89, 0.78);
  vec3 col = mix(hor, top, pow(y, 0.55));
  if (rd.y < 0.0) {
    col = mix(hor, vec3(0.68, 0.64, 0.58), clamp(-rd.y * 3.0, 0.0, 1.0));
  }
  float sun = clamp(dot(rd, sunDir), 0.0, 1.0);
  col += vec3(1.0, 0.85, 0.55) * pow(sun, 16.0) * 0.35;
  col += vec3(1.0, 0.96, 0.85) * smoothstep(0.996, 0.9995, sun);
  return col;
}

vec3 shadeGround(vec3 p, vec3 rd, vec3 sunDir) {
  float scroll = uAnim0.x * 0.56;
  vec2 uv = vec2(p.x - scroll, p.z);

  // Warm boardwalk / cobblestone promenade pattern
  float plankId = floor(uv.z * 3.5);
  float seamZ = smoothstep(0.04, 0.0, abs(fract(uv.z * 3.5) - 0.5) - 0.46);
  float seamX = smoothstep(0.03, 0.0, abs(fract(uv.x * 0.9 + 0.37 * plankId) - 0.5) - 0.47);
  float grain = 0.5 + 0.5 * sin(uv.x * 16.0 + sin(uv.z * 28.0 + plankId));

  vec3 woodA = vec3(0.76, 0.67, 0.55);
  vec3 woodB = vec3(0.70, 0.60, 0.49);
  vec3 base = mix(woodA, woodB, 0.5 + 0.5 * sin(plankId * 2.3 + grain * 0.6));
  base *= 1.0 - 0.14 * max(seamZ, seamX);

  // Subtle painted seaside cycle lane stripe
  float lane = smoothstep(0.02, 0.0, abs(abs(p.z) - 0.52) - 0.03);
  base = mix(base, vec3(0.95, 0.88, 0.72), lane * 0.65);

  float sh = calcSoftShadow(p + vec3(0.0, 0.015, 0.0), sunDir, 6.0);
  // Contact shadow under the two tires
  float tireOcc = exp(-9.0 * length(vec2((p.x + 0.95) * 1.4, p.z * 3.5)))
                + exp(-9.0 * length(vec2((p.x - 0.95) * 1.4, p.z * 3.5)));
  float bodyOcc = exp(-1.1 * length(vec2(p.x * 0.75, p.z * 1.8))) * 0.35;
  float occ = clamp(1.0 - 0.55 * tireOcc - bodyOcc, 0.25, 1.0);

  vec3 n = vec3(0.0, 1.0, 0.0);
  float ndl = max(dot(n, sunDir), 0.0);
  vec3 lin = vec3(1.04, 0.95, 0.82) * ndl * (0.32 + 0.68 * sh);
  lin += vec3(0.45, 0.62, 0.82) * 0.38 * occ;

  vec3 col = base * lin;
  float dist = length(p - uCamPos);
  float fog = 1.0 - exp(-0.0045 * dist * dist);
  return mix(col, skyColor(rd), clamp(fog, 0.0, 1.0));
}

void getMaterial(float mat, vec3 p, vec3 n, out vec3 albedo, out float rough, out float metal) {
  rough = 0.45;
  metal = 0.0;
  albedo = vec3(0.8);

  if (mat < 1.5) { // Chrome
    albedo = vec3(0.88, 0.91, 0.95);
    rough = 0.14;
    metal = 0.92;
  } else if (mat < 2.5) { // Tire & dark rubber
    float rRear = length(p.xy - vec2(-0.95, -0.42));
    float rFront = length(p.xy - vec2(0.95, -0.42));
    float r = min(rRear, rFront);
    bool whitewall = (r > 0.495 && r < 0.542 && abs(p.z) > 0.032);
    albedo = whitewall ? vec3(0.93, 0.90, 0.82) : vec3(0.14, 0.15, 0.17);
    rough = whitewall ? 0.55 : 0.78;
  } else if (mat < 3.5) { // Coral/Teal vintage bicycle frame
    albedo = vec3(0.12, 0.58, 0.60);
    // Cream head-tube & seat-tube accent bands
    if (p.x > 0.45 && p.y > 0.18 && p.y < 0.50) {
      albedo = vec3(0.95, 0.91, 0.81);
    }
    rough = 0.22;
    metal = 0.18;
  } else if (mat < 4.5) { // Leather saddle & grips
    albedo = vec3(0.45, 0.23, 0.11);
    rough = 0.42;
  } else if (mat < 5.5) { // Pelican feathers
    albedo = vec3(0.96, 0.95, 0.91);
    float warmCrown = smoothstep(1.22, 1.48, p.y);
    albedo = mix(albedo, vec3(0.98, 0.91, 0.74), warmCrown * 0.55);
    albedo += 0.015 * sin(p.x * 40.0 + p.y * 30.0);
    rough = 0.65;
  } else if (mat < 6.5) { // Charcoal primary wingtips
    albedo = vec3(0.18, 0.20, 0.24);
    rough = 0.58;
  } else if (mat < 7.5) { // Beak
    float tipMix = smoothstep(0.55, 0.88, p.x);
    albedo = mix(vec3(0.98, 0.66, 0.18), vec3(0.94, 0.32, 0.18), tipMix);
    rough = 0.34;
  } else if (mat < 8.5) { // Throat pouch
    float depthMix = smoothstep(1.38, 1.15, p.y);
    albedo = mix(vec3(0.97, 0.68, 0.45), vec3(0.93, 0.46, 0.38), depthMix);
    rough = 0.48;
  } else if (mat < 9.5) { // Eye white / headlamp lens
    albedo = vec3(0.98, 0.98, 0.99);
    rough = 0.12;
  } else if (mat < 10.5) { // Pupil
    albedo = vec3(0.05, 0.05, 0.07);
    rough = 0.06;
  } else if (mat < 11.5) { // Webbed feet & legs
    albedo = vec3(0.96, 0.47, 0.12);
    rough = 0.46;
  } else if (mat < 12.5) { // Sailor cap
    albedo = vec3(0.96, 0.97, 0.99);
    rough = 0.55;
  } else if (mat < 13.5) { // Brass bell & lamp
    albedo = vec3(0.94, 0.76, 0.32);
    rough = 0.18;
    metal = 0.88;
  } else if (mat < 14.5) { // Striped scarf & cap band
    float stripe = step(0.0, sin((p.x + p.y) * 32.0));
    albedo = mix(vec3(0.86, 0.20, 0.22), vec3(0.15, 0.29, 0.55), stripe * 0.35);
    rough = 0.68;
  } else if (mat < 15.5) { // Cheek blush
    albedo = vec3(0.96, 0.52, 0.52);
    rough = 0.65;
  }
}

void main() {
  vec2 fragCoord = vUv * uResolution;
  vec2 p = (2.0 * fragCoord - uResolution) / min(uResolution.x, uResolution.y);

  vec3 ro = uCamPos;
  vec3 rd = normalize(uCamFwd * 1.85 + p.x * uCamRight + p.y * uCamUp);

  vec3 sunDir = normalize(vec3(0.56, 0.68, 0.47));

  float tGround = MAX_DIST;
  if (rd.y < -1e-4) {
    float tg = (GROUND_Y - ro.y) / rd.y;
    if (tg > 0.0 && tg < MAX_DIST) tGround = tg;
  }

  float bMin, bMax;
  bool hitBounds = intersectSubjectBounds(ro, rd, bMin, bMax);

  float t = bMin;
  float mat = -1.0;
  bool hitSubject = false;

  if (hitBounds && bMin < tGround) {
    float limit = min(bMax, tGround);
    for (int i = 0; i < 96; i++) {
      if (t > limit) break;
      vec2 h = sdSceneSubject(ro + rd * t);
      float eps = 0.00075 * (1.0 + 0.35 * t);
      if (h.x < eps) {
        hitSubject = true;
        mat = h.y;
        break;
      }
      t += h.x;
    }
  }

  vec3 col;
  if (hitSubject) {
    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);
    vec3 v = -rd;

    vec3 albedo;
    float rough, metal;
    getMaterial(mat, pos, n, albedo, rough, metal);

    float ao = calcAO(pos, n);
    float sh = calcSoftShadow(pos + n * 0.006, sunDir, 5.0);

    float ndl = max(dot(n, sunDir), 0.0);
    vec3 fillDir = normalize(vec3(-0.65, 0.40, -0.55));
    float fill = max(dot(n, fillDir), 0.0);
    float bounce = max(0.0, -n.y);
    float rim = pow(clamp(1.0 - max(dot(n, v), 0.0), 0.0, 1.0), 3.0) * (0.35 + 0.65 * max(n.y, 0.0));

    // Soft subsurface glow on the throat pouch and beak
    float sss = 0.0;
    if (mat > 6.5 && mat < 8.5) {
      sss = pow(clamp(dot(rd, sunDir), 0.0, 1.0), 2.5) * 0.38;
    }

    vec3 diffCol = albedo * (1.0 - 0.82 * metal);
    vec3 specF0 = mix(vec3(0.04), albedo, metal);

    vec3 hVec = normalize(sunDir + v);
    float ndh = max(dot(n, hVec), 0.0);
    float specPow = mix(128.0, 8.0, rough * rough);
    float spec = pow(ndh, specPow) * (1.4 - rough) * sh * ndl;

    vec3 envRef = skyColor(reflect(rd, n));
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 fSpec = mix(specF0, vec3(1.0), fresnel);

    vec3 lin = vec3(0.0);
    lin += vec3(1.08, 0.97, 0.84) * ndl * (0.18 + 0.82 * sh);
    lin += vec3(0.45, 0.63, 0.86) * (0.32 + 0.28 * n.y) * ao;
    lin += vec3(0.85, 0.72, 0.56) * fill * 0.25 * ao;
    lin += vec3(0.75, 0.62, 0.45) * bounce * 0.22 * ao;
    lin += vec3(1.0, 0.60, 0.35) * sss;

    col = diffCol * lin;
    col += fSpec * spec * vec3(1.05, 0.98, 0.88);
    col += fSpec * envRef * (0.12 + 0.58 * metal) * (1.0 - 0.65 * rough) * ao;
    col += vec3(0.95, 0.92, 0.82) * rim * 0.22 * ao;
  } else if (tGround < MAX_DIST) {
    vec3 gPos = ro + rd * tGround;
    col = shadeGround(gPos, rd, sunDir);
  } else {
    col = skyColor(rd);
  }

  // Filmic tone curve and gamma
  col = max(col, 0.0);
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

  fragColor = vec4(col, 1.0);
}
`;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("Unable to allocate WebGL shader.");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || "Unknown shader compile error";
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${info}`);
    }
    return shader;
  }

  const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error("Unable to create WebGL program.");
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "Unknown program link error";
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${info}`);
  }

  const vao = gl.createVertexArray();
  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uCamPos = gl.getUniformLocation(program, "uCamPos");
  const uCamRight = gl.getUniformLocation(program, "uCamRight");
  const uCamUp = gl.getUniformLocation(program, "uCamUp");
  const uCamFwd = gl.getUniformLocation(program, "uCamFwd");
  const uAnim0 = gl.getUniformLocation(program, "uAnim0");
  const uAnim1 = gl.getUniformLocation(program, "uAnim1");
  const uFootR = gl.getUniformLocation(program, "uFootR");
  const uFootL = gl.getUniformLocation(program, "uFootL");
  const uKneeR = gl.getUniformLocation(program, "uKneeR");
  const uKneeL = gl.getUniformLocation(program, "uKneeL");

  const MIN_PITCH = -1.42;
  const MAX_PITCH = 1.42;
  const MIN_DIST = 0.75;
  const MAX_DIST = 11.0;

  let yaw = 0.56;
  let pitch = 0.22;
  let distance = 3.65;
  let lastTime = 0;
  let contextLost = false;
  let disposed = false;

  if (canvas.tabIndex < 0) {
    canvas.tabIndex = 0;
  }
  if (canvas.style) {
    canvas.style.touchAction = "none";
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function setView(nextYaw, nextPitch, nextDistance) {
    if (Number.isFinite(nextYaw)) {
      yaw = nextYaw;
    }
    if (Number.isFinite(nextPitch)) {
      pitch = clamp(nextPitch, MIN_PITCH, MAX_PITCH);
    }
    if (Number.isFinite(nextDistance)) {
      distance = clamp(nextDistance, MIN_DIST, MAX_DIST);
    }
    if (!disposed) {
      render(lastTime);
    }
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  function solveKnee(hipX, hipY, hipZ, footX, footY, footZ, kneeZ) {
    const dx = footX - hipX;
    const dy = footY - hipY;
    const dz = kneeZ - hipZ;
    const l1 = Math.sqrt(Math.max(0.01, 0.44 * 0.44 - dz * dz));
    const dz2 = footZ - kneeZ;
    const l2 = Math.sqrt(Math.max(0.01, 0.46 * 0.46 - dz2 * dz2));
    const d2 = dx * dx + dy * dy;
    const d = Math.max(1e-4, Math.sqrt(d2));
    const clampedD = Math.min(d, l1 + l2 - 1e-4);
    const a = (l1 * l1 - l2 * l2 + clampedD * clampedD) / (2 * clampedD);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / d;
    const uy = dy / d;
    // Forward-bending bird knee/ankle joint (+X / +Y perpendicular)
    const px = uy;
    const py = -ux;
    return [hipX + a * ux + h * px, hipY + a * uy + h * py, kneeZ];
  }

  function render(timeSeconds = 0) {
    if (disposed || contextLost) return;
    if (typeof gl.isContextLost === "function" && gl.isContextLost()) return;

    const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    lastTime = t;

    const w = Math.max(1, canvas.width | 0);
    const h = Math.max(1, canvas.height | 0);

    gl.viewport(0, 0, w, h);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // Camera target softly shifts toward upper details when zoomed in close
    const zoomBlend = clamp((2.2 - distance) / 1.45, 0, 1);
    const targetX = 0.04 + 0.14 * zoomBlend;
    const targetY = 0.34 + 0.32 * zoomBlend;
    const targetZ = 0.0;

    // setView(0, 0, d) -> camera on +Z looking toward -Z: bicycle's right side (+X to the right)
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);

    const dirX = cp * sy;
    const dirY = sp;
    const dirZ = cp * cy;

    const camX = targetX + distance * dirX;
    const camY = targetY + distance * dirY;
    const camZ = targetZ + distance * dirZ;

    const fwdX = -dirX;
    const fwdY = -dirY;
    const fwdZ = -dirZ;

    // Right = normalize(cross(fwd, worldUp(0,1,0)))
    let rightX = -fwdZ;
    let rightY = 0;
    let rightZ = fwdX;
    const rLen = Math.hypot(rightX, rightZ) || 1;
    rightX /= rLen;
    rightZ /= rLen;

    // Up = cross(right, fwd)
    const upX = rightY * fwdZ - rightZ * fwdY;
    const upY = rightZ * fwdX - rightX * fwdZ;
    const upZ = rightX * fwdY - rightY * fwdX;

    // Deterministic cycling kinematics
    const crankAngle = -t * 3.8;
    const wheelAngle = -t * 6.4;
    const sinC = Math.sin(crankAngle);
    const cosC = Math.cos(crankAngle);
    const bob = 0.022 * Math.sin(crankAngle * 2.0);
    const headNod = 0.045 * Math.sin(crankAngle * 2.0 - 0.5);
    const pouchBob = -0.018 * Math.sin(crankAngle * 2.0 - 0.9);
    const tailBob = 0.025 * Math.sin(crankAngle * 2.0 + 0.6);
    const steer = 0.04 * Math.sin(crankAngle);

    const bbX = -0.12;
    const bbY = -0.40;
    const crankR = 0.18;

    const footRX = bbX + crankR * cosC;
    const footRY = bbY + crankR * sinC;
    const footRZ = 0.155;

    const footLX = bbX - crankR * cosC;
    const footLY = bbY - crankR * sinC;
    const footLZ = -0.155;

    const hipX = -0.36;
    const hipY = 0.60 + bob;
    const kneeR = solveKnee(hipX, hipY, 0.14, footRX, footRY + 0.022, footRZ, 0.175);
    const kneeL = solveKnee(hipX, hipY, -0.14, footLX, footLY + 0.022, footLZ, -0.175);

    gl.uniform2f(uResolution, w, h);
    gl.uniform3f(uCamPos, camX, camY, camZ);
    gl.uniform3f(uCamRight, rightX, rightY, rightZ);
    gl.uniform3f(uCamUp, upX, upY, upZ);
    gl.uniform3f(uCamFwd, fwdX, fwdY, fwdZ);

    gl.uniform4f(uAnim0, wheelAngle, crankAngle, bob, headNod);
    gl.uniform4f(uAnim1, pouchBob, tailBob, sinC, cosC);
    gl.uniform4f(uFootR, footRX, footRY, footRZ, 0.0);
    gl.uniform4f(uFootL, footLX, footLY, footLZ, 0.0);
    gl.uniform4f(uKneeR, kneeR[0], kneeR[1], kneeR[2], t);
    gl.uniform4f(uKneeL, kneeL[0], kneeL[1], kneeL[2], steer);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  // Pointer, mouse, touch pinch, wheel, and keyboard controls
  const activePointers = new Map();
  let lastPinchDist = 0;
  let draggingMouse = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function focusCanvas() {
    if (typeof canvas.focus === "function") {
      try {
        canvas.focus({ preventScroll: true });
      } catch (_) {
        canvas.focus();
      }
    }
  }

  function onPointerDown(e) {
    if (disposed) return;
    focusCanvas();
    if (e.cancelable) e.preventDefault();
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (typeof canvas.setPointerCapture === "function") {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  }

  function onPointerMove(e) {
    if (disposed || !activePointers.has(e.pointerId)) return;
    if (e.cancelable) e.preventDefault();
    const prev = activePointers.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    activePointers.set(e.pointerId, cur);

    if (activePointers.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const rect = canvas.getBoundingClientRect();
      const span = Math.max(240, Math.min(rect.width || canvas.width || 600, rect.height || canvas.height || 600));
      const nextYaw = yaw - (dx / span) * Math.PI * 2.2;
      const nextPitch = pitch + (dy / span) * Math.PI * 1.4;
      setView(nextYaw, nextPitch, distance);
    } else if (activePointers.size >= 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastPinchDist > 1 && dist > 1) {
        const scale = lastPinchDist / dist;
        setView(yaw, pitch, distance * scale);
      }
      lastPinchDist = dist;
    }
  }

  function onPointerUp(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      lastPinchDist = 0;
    }
    if (typeof canvas.releasePointerCapture === "function") {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  }

  function onMouseDown(e) {
    if (disposed || "PointerEvent" in globalThis) return;
    if (e.button !== 0) return;
    focusCanvas();
    if (e.cancelable) e.preventDefault();
    draggingMouse = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function onMouseMove(e) {
    if (disposed || !draggingMouse) return;
    if (e.cancelable) e.preventDefault();
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    const rect = canvas.getBoundingClientRect();
    const span = Math.max(240, Math.min(rect.width || canvas.width || 600, rect.height || canvas.height || 600));
    setView(yaw - (dx / span) * Math.PI * 2.2, pitch + (dy / span) * Math.PI * 1.4, distance);
  }

  function onMouseUp() {
    draggingMouse = false;
  }

  function onWheel(e) {
    if (disposed) return;
    if (e.cancelable) e.preventDefault();
    const modeScale = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 240 : 1;
    const delta = clamp(e.deltaY * modeScale, -240, 240);
    const factor = Math.exp(delta * 0.0014);
    setView(yaw, pitch, distance * factor);
  }

  function onKeyDown(e) {
    if (disposed) return;
    const stepOrbit = 0.11;
    const stepZoom = 0.88;
    switch (e.key) {
      case "ArrowLeft":
        if (e.cancelable) e.preventDefault();
        setView(yaw - stepOrbit, pitch, distance);
        break;
      case "ArrowRight":
        if (e.cancelable) e.preventDefault();
        setView(yaw + stepOrbit, pitch, distance);
        break;
      case "ArrowUp":
        if (e.cancelable) e.preventDefault();
        setView(yaw, pitch + stepOrbit, distance);
        break;
      case "ArrowDown":
        if (e.cancelable) e.preventDefault();
        setView(yaw, pitch - stepOrbit, distance);
        break;
      case "+":
      case "=":
      case "Add":
        if (e.cancelable) e.preventDefault();
        setView(yaw, pitch, distance * stepZoom);
        break;
      case "-":
      case "_":
      case "Subtract":
        if (e.cancelable) e.preventDefault();
        setView(yaw, pitch, distance / stepZoom);
        break;
    }
  }

  function onContextLost(e) {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    contextLost = true;
  }

  function onContextRestored() {
    contextLost = false;
  }

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("mousedown", onMouseDown, { passive: false });
  globalThis.addEventListener("mousemove", onMouseMove, { passive: false });
  globalThis.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  function dispose() {
    if (disposed) return;
    disposed = true;
    activePointers.clear();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("mousedown", onMouseDown);
    globalThis.removeEventListener("mousemove", onMouseMove);
    globalThis.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    try {
      if (!contextLost && (!gl.isContextLost || !gl.isContextLost())) {
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
      }
    } catch (_) {}
  }

  render(0);

  return {
    render,
    setView,
    getView,
    dispose,
  };
}
