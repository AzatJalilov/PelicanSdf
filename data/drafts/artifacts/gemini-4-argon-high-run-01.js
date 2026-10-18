export function createPelicanSdf(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('createPelicanSdf requires a valid HTMLCanvasElement.');
  }

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });

  if (!gl) {
    throw new Error('WebGL2 is unavailable on this canvas.');
  }

  const MIN_DIST = 0.48;
  const MAX_DIST = 9.0;
  const MAX_PITCH = 1.52;

  let yaw = 0.56;
  let pitch = 0.22;
  let distance = 3.2;
  let lastTime = 0.0;
  let disposed = false;
  let contextLost = false;

  const prevTabIndex = canvas.getAttribute('tabindex');
  if (prevTabIndex === null) {
    canvas.tabIndex = 0;
  }
  const prevTouchAction = canvas.style ? canvas.style.touchAction : '';
  const prevOutline = canvas.style ? canvas.style.outline : '';
  const prevUserSelect = canvas.style ? canvas.style.userSelect : '';
  if (canvas.style) {
    canvas.style.touchAction = 'none';
    if (!canvas.style.outline) canvas.style.outline = 'none';
    canvas.style.userSelect = 'none';
  }

  const vsSource = `#version 300 es
precision highp float;
const vec2 V[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(V[gl_VertexID], 0.0, 1.0);
}`;

  const fsSource = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform vec4 uAnim;
uniform vec3 uJoints[8];

out vec4 fragColor;

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float smax(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdTapCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdTorusXY(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xy) - t.x, p.z);
  return length(q) - t.y;
}

float sdCylZ(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float evalWheelsDist(vec3 p) {
  vec3 pw = vec3(p.x - (p.x >= 0.0 ? 0.72 : -0.72), p.y + 0.48, p.z);
  float r = length(pw.xy);
  float dBnd = max(r - 0.435, abs(pw.z) - 0.105);
  if (dBnd > 0.06) return dBnd;

  float dTire = sdTorusXY(pw, vec2(0.37, 0.054));
  float dRim = sdTorusXY(pw, vec2(0.316, 0.023));
  float dHub = min(sdCylZ(pw, 0.044, 0.062), sdCylZ(pw, 0.020, 0.095));

  float a = atan(pw.y, pw.x) + uAnim.y;
  float sa = mod(a + 0.31415926, 0.62831853) - 0.31415926;
  float dSpokeXY = r * abs(sin(sa));
  float dSpokeR = max(0.04 - r, r - 0.315);
  float zTarget = mix(0.038, 0.007, clamp((r - 0.04) * 3.636, 0.0, 1.0));
  float dSpokeZ = abs(abs(pw.z) - zTarget);
  float dSpokes = max(dSpokeR, length(vec2(dSpokeXY, dSpokeZ)) - 0.0075);

  return min(min(dTire, dRim), min(dHub, dSpokes));
}

float evalFrameDist(vec3 p) {
  float dBnd = max(max(abs(p.x) - 0.82, abs(p.y + 0.04) - 0.56), abs(p.z) - 0.36);
  if (dBnd > 0.12) return dBnd;

  vec3 pSym = vec3(p.x, p.y, abs(p.z));

  float dFrame = sdCapsule(p, vec3(-0.08, -0.48, 0.0), vec3(-0.30, 0.04, 0.0), 0.027);
  dFrame = min(dFrame, sdCapsule(p, vec3(-0.08, -0.48, 0.0), vec3(0.50, -0.02, 0.0), 0.029));
  dFrame = min(dFrame, sdCapsule(p, vec3(-0.29, 0.01, 0.0), vec3(0.45, 0.14, 0.0), 0.026));
  dFrame = min(dFrame, sdCapsule(p, vec3(0.52, -0.06, 0.0), vec3(0.42, 0.22, 0.0), 0.033));
  dFrame = min(dFrame, sdCylZ(p - vec3(-0.08, -0.48, 0.0), 0.046, 0.065));

  float dStays = sdCapsule(pSym, vec3(-0.08, -0.48, 0.048), vec3(-0.72, -0.48, 0.08), 0.019);
  dStays = min(dStays, sdCapsule(pSym, vec3(-0.28, 0.00, 0.036), vec3(-0.72, -0.48, 0.08), 0.018));
  dStays = min(dStays, sdCapsule(pSym, vec3(0.52, -0.06, 0.0), vec3(0.52, -0.06, 0.076), 0.023));
  dStays = min(dStays, sdCapsule(pSym, vec3(0.52, -0.06, 0.076), vec3(0.72, -0.48, 0.08), 0.021));
  dFrame = min(dFrame, dStays);

  float dPost = sdCapsule(p, vec3(-0.30, 0.04, 0.0), vec3(-0.35, 0.17, 0.0), 0.019);
  dPost = min(dPost, sdCapsule(p, vec3(0.42, 0.22, 0.0), vec3(0.39, 0.35, 0.0), 0.021));
  dPost = min(dPost, sdCapsule(p, vec3(0.39, 0.35, 0.0), vec3(0.44, 0.37, 0.0), 0.022));

  float dBar = sdCapsule(pSym, vec3(0.44, 0.37, 0.0), vec3(0.45, 0.39, 0.15), 0.019);
  dBar = min(dBar, sdCapsule(pSym, vec3(0.45, 0.39, 0.15), vec3(0.35, 0.43, 0.27), 0.019));
  dBar = min(dBar, sdCapsule(pSym, vec3(0.35, 0.43, 0.27), vec3(0.19, 0.42, 0.315), 0.026));
  float dBell = length(p - vec3(0.39, 0.44, 0.20)) - 0.028;

  float dSaddle = smin(
    sdRoundBox(p - vec3(-0.41, 0.185, 0.0), vec3(0.06, 0.022, 0.095), 0.02),
    sdTapCapsule(p, vec3(-0.40, 0.185, 0.0), vec3(-0.22, 0.175, 0.0), 0.068, 0.026),
    0.025
  );

  float dRing = max(sdCylZ(p - vec3(-0.08, -0.48, 0.072), 0.115, 0.009), -sdCylZ(p - vec3(-0.08, -0.48, 0.072), 0.082, 0.02));
  float dCog = sdCylZ(p - vec3(-0.72, -0.48, 0.064), 0.048, 0.009);
  float uCh = clamp((p.x + 0.72) / 0.64, 0.0, 1.0);
  float rCh = mix(0.046, 0.110, uCh);
  float dChain = length(vec3(p.x - clamp(p.x, -0.72, -0.08), abs(p.y + 0.48) - rCh, p.z - 0.068)) - 0.009;

  return min(min(dFrame, dPost), min(min(dBar, dBell), min(dSaddle, min(dRing, min(dCog, dChain)))));
}

float evalCrankLegsDist(vec3 p) {
  float dBnd = length(p - vec3(-0.12, -0.15, 0.0)) - 0.66;
  if (dBnd > 0.10) return dBnd;

  vec3 pPR = uJoints[0];
  vec3 pPL = uJoints[1];
  vec3 hR  = uJoints[2];
  vec3 hL  = uJoints[3];
  vec3 kR  = uJoints[4];
  vec3 kL  = uJoints[5];
  vec3 aR  = uJoints[6];
  vec3 aL  = uJoints[7];

  vec3 cR = vec3(pPR.x, pPR.y, 0.10);
  vec3 cL = vec3(pPL.x, pPL.y, -0.10);

  float dCrank = min(
    sdCapsule(p, vec3(-0.08, -0.48, 0.082), cR, 0.017),
    sdCapsule(p, vec3(-0.08, -0.48, -0.075), cL, 0.017)
  );
  dCrank = min(dCrank, min(sdCapsule(p, cR, pPR, 0.012), sdCapsule(p, cL, pPL, 0.012)));

  float dPedals = min(
    sdRoundBox(p - pPR, vec3(0.056, 0.014, 0.042), 0.005),
    sdRoundBox(p - pPL, vec3(0.056, 0.014, 0.042), 0.005)
  );

  float dLegR = smin(
    sdTapCapsule(p, hR, mix(hR, kR, 0.65), 0.072, 0.044),
    sdTapCapsule(p, mix(hR, kR, 0.55), kR, 0.036, 0.028),
    0.02
  );
  dLegR = min(dLegR, sdTapCapsule(p, kR, aR, 0.027, 0.021));

  float dFootR = sdRoundBox(p - (pPR + vec3(0.016, 0.022, 0.0)), vec3(0.042, 0.007, 0.028), 0.005);
  dFootR = smin(dFootR, sdTapCapsule(p, aR, pPR + vec3(0.058, 0.020, -0.028), 0.016, 0.010), 0.01);
  dFootR = smin(dFootR, sdTapCapsule(p, aR, pPR + vec3(0.068, 0.020, 0.0), 0.017, 0.011), 0.01);
  dFootR = smin(dFootR, sdTapCapsule(p, aR, pPR + vec3(0.058, 0.020, 0.028), 0.016, 0.010), 0.01);

  float dLegL = smin(
    sdTapCapsule(p, hL, mix(hL, kL, 0.65), 0.072, 0.044),
    sdTapCapsule(p, mix(hL, kL, 0.55), kL, 0.036, 0.028),
    0.02
  );
  dLegL = min(dLegL, sdTapCapsule(p, kL, aL, 0.027, 0.021));

  float dFootL = sdRoundBox(p - (pPL + vec3(0.016, 0.022, 0.0)), vec3(0.042, 0.007, 0.028), 0.005);
  dFootL = smin(dFootL, sdTapCapsule(p, aL, pPL + vec3(0.058, 0.020, -0.028), 0.016, 0.010), 0.01);
  dFootL = smin(dFootL, sdTapCapsule(p, aL, pPL + vec3(0.068, 0.020, 0.0), 0.017, 0.011), 0.01);
  dFootL = smin(dFootL, sdTapCapsule(p, aL, pPL + vec3(0.058, 0.020, 0.028), 0.016, 0.010), 0.01);

  return min(min(dCrank, dPedals), min(min(dLegR, dFootR), min(dLegL, dFootL)));
}

float evalPelicanUpperDist(vec3 p) {
  float bob = uAnim.x;
  vec3 pb = p - vec3(0.0, bob, 0.0);

  float dBnd = max(length(pb.xy - vec2(-0.02, 0.64)) - 0.68, abs(pb.z) - 0.38);
  if (dBnd > 0.12) return dBnd;

  vec3 pSym = vec3(pb.x, pb.y, abs(pb.z));

  float dBody = smin(
    sdTapCapsule(pb, vec3(-0.36, 0.28, 0.0), vec3(-0.12, 0.54, 0.0), 0.175, 0.205),
    length((pb - vec3(-0.23, 0.40, 0.0)) * vec3(0.88, 1.0, 1.08)) - 0.21,
    0.06
  );

  float dTail = sdTapCapsule(pb, vec3(-0.42, 0.30, 0.0), vec3(-0.62, 0.38, 0.0), 0.065, 0.016);
  dTail = smin(dTail, sdTapCapsule(pSym, vec3(-0.42, 0.30, 0.02), vec3(-0.59, 0.36, 0.055), 0.048, 0.014), 0.02);
  dBody = smin(dBody, dTail, 0.04);

  float dNeck = smin(
    sdTapCapsule(pb, vec3(-0.08, 0.58, 0.0), vec3(-0.13, 0.78, 0.0), 0.095, 0.076),
    sdTapCapsule(pb, vec3(-0.13, 0.78, 0.0), vec3(-0.03, 0.96, 0.0), 0.076, 0.072),
    0.04
  );
  dBody = smin(dBody, dNeck, 0.05);

  float dScarf = sdTorusXY(vec3(pb.x + 0.09, pb.z, pb.y - 0.62), vec2(0.095, 0.022));
  dScarf = min(dScarf, sdTapCapsule(pb, vec3(-0.18, 0.62, 0.02), vec3(-0.32, 0.65, 0.06), 0.022, 0.012));

  vec3 wS = vec3(-0.14, 0.56, 0.165);
  vec3 wE = vec3(0.02, 0.46, 0.285);
  vec3 wW = vec3(0.25, 0.425, 0.305);
  float dWing = smin(
    sdTapCapsule(pSym, wS, wE, 0.068, 0.050),
    sdTapCapsule(pSym, wS + vec3(-0.08, -0.07, 0.0), wE + vec3(-0.07, -0.05, 0.0), 0.056, 0.042),
    0.03
  );
  dWing = smin(dWing, sdTapCapsule(pSym, wE, wW, 0.048, 0.036), 0.03);
  dWing = smin(dWing, sdTapCapsule(pSym, wE + vec3(-0.06, -0.04, 0.0), wW + vec3(-0.07, -0.03, 0.0), 0.042, 0.028), 0.025);
  dWing = smin(dWing, sdTapCapsule(pSym, wE + vec3(-0.11, -0.07, 0.0), wW + vec3(-0.12, -0.05, 0.0), 0.035, 0.022), 0.02);

  float dTips = min(
    sdTapCapsule(pSym, wW, vec3(0.22, 0.39, 0.28), 0.024, 0.014),
    min(
      sdTapCapsule(pSym, wW + vec3(0.03, 0.0, 0.0), vec3(0.27, 0.39, 0.28), 0.022, 0.013),
      sdTapCapsule(pSym, wW + vec3(-0.03, 0.0, 0.0), vec3(0.18, 0.395, 0.285), 0.022, 0.013)
    )
  );
  dBody = min(smin(dBody, dWing, 0.035), min(dTips, dScarf));

  float dHeadBnd = length(pb - vec3(0.22, 0.92, 0.0)) - 0.48;
  if (dHeadBnd < 0.12) {
    float dHead = sdTapCapsule(pb, vec3(-0.04, 0.98, 0.0), vec3(0.05, 1.00, 0.0), 0.104, 0.086);
    float dCrest = min(
      sdTapCapsule(pb, vec3(-0.06, 1.05, 0.0), vec3(-0.21, 1.08, 0.0), 0.030, 0.010),
      sdTapCapsule(pb, vec3(-0.07, 1.01, 0.0), vec3(-0.19, 1.01, 0.0), 0.026, 0.010)
    );
    dHead = smin(dHead, dCrest, 0.025);
    dHead = smin(dHead, sdCapsule(pSym, vec3(0.01, 1.045, 0.062), vec3(0.072, 1.035, 0.052), 0.020), 0.015);

    float dEye = length(pSym - vec3(0.045, 1.015, 0.084)) - 0.027;
    float dPupil = length(pSym - vec3(0.062, 1.017, 0.095)) - 0.013;

    float u = clamp((pb.x - 0.06) / 0.52, 0.0, 1.0);
    float yBill = mix(0.985, 0.935, u) + 0.012 * sin(u * 3.14159265);
    float wBill = mix(0.062, 0.018, pow(u, 0.75));
    float hBill = mix(0.032, 0.013, u);
    vec3 qBill = vec3(pb.x - 0.32, pb.y - yBill, pb.z);
    float dUpperBill = length(max(abs(qBill) - vec3(0.26, hBill, wBill), 0.0)) - 0.012;
    float dNail = sdTapCapsule(pb, vec3(0.55, 0.942, 0.0), vec3(0.60, 0.892, 0.0), 0.021, 0.009);
    dUpperBill = smin(dUpperBill, dNail, 0.018);

    float up = clamp((pb.x - 0.01) / 0.54, 0.0, 1.0);
    float sUp = sin(up * 3.14159265);
    float yTop = mix(0.955, 0.925, up);
    float sag = 0.23 * sUp * (1.0 - 0.36 * up);
    float yBot = yTop - sag;
    float yMid = 0.5 * (yTop + yBot);
    float hPouch = 0.5 * (yTop - yBot);
    float wPouch = 0.012 + 0.068 * pow(max(sUp, 0.0001), 0.65) * (1.0 - 0.25 * up);
    float vP = clamp((yTop - pb.y) / max(0.02, 2.0 * hPouch), 0.0, 1.0);
    float wCur = wPouch * sin(vP * 2.5 + 0.35);
    vec3 qPouch = vec3(pb.x - 0.28, pb.y - yMid, pb.z);
    float dPouch = length(max(abs(qPouch) - vec3(0.265, hPouch, wCur), 0.0)) - 0.018;

    float dHeadAll = min(min(smin(dHead, dUpperBill, 0.022), dPouch), min(dEye, dPupil));
    dBody = smin(dBody, dHeadAll, 0.025);
  } else {
    dBody = min(dBody, dHeadBnd);
  }

  return dBody;
}

float mapDist(vec3 p) {
  float dW = evalWheelsDist(p);
  float dF = evalFrameDist(p);
  float dL = evalCrankLegsDist(p);
  float dP = evalPelicanUpperDist(p);
  return min(min(dW, dF), min(dL, dP));
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.0009, -0.0009);
  return normalize(
    e.xyy * mapDist(p + e.xyy) +
    e.yyx * mapDist(p + e.yyx) +
    e.yxy * mapDist(p + e.yxy) +
    e.xxx * mapDist(p + e.xxx)
  );
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.03 * float(i);
    float d = mapDist(p + h * n);
    occ += (h - d) * sca;
    sca *= 0.65;
  }
  return clamp(1.0 - 2.4 * occ, 0.15, 1.0);
}

float calcSoftShadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.025;
  for (int i = 0; i < 14; i++) {
    float h = mapDist(ro + rd * t);
    res = min(res, 7.0 * h / t);
    t += clamp(h, 0.025, 0.16);
    if (res < 0.05 || t > 1.8) break;
  }
  return clamp(res, 0.12, 1.0);
}

vec4 classifyMaterial(vec3 p, out vec3 albedo, out vec3 specParams) {
  // Returns material properties: albedo, specParams = (roughness, metallic, sss)
  float bestD = 1e5;
  int mat = 0;

  // 1. Wheels
  vec3 pw = vec3(p.x - (p.x >= 0.0 ? 0.72 : -0.72), p.y + 0.48, p.z);
  float rW = length(pw.xy);
  if (rW < 0.46 && abs(pw.z) < 0.12) {
    float dTire = sdTorusXY(pw, vec2(0.37, 0.054));
    if (dTire < bestD) { bestD = dTire; mat = 1; }
    float dRim = min(sdTorusXY(pw, vec2(0.316, 0.023)), min(sdCylZ(pw, 0.044, 0.062), sdCylZ(pw, 0.020, 0.095)));
    float a = atan(pw.y, pw.x) + uAnim.y;
    float sa = mod(a + 0.31415926, 0.62831853) - 0.31415926;
    float dSpokeXY = rW * abs(sin(sa));
    float dSpokeR = max(0.04 - rW, rW - 0.315);
    float zTarget = mix(0.038, 0.007, clamp((rW - 0.04) * 3.636, 0.0, 1.0));
    float dSpokes = max(dSpokeR, length(vec2(dSpokeXY, abs(abs(pw.z) - zTarget))) - 0.0075);
    dRim = min(dRim, dSpokes);
    if (dRim < bestD) { bestD = dRim; mat = 2; }
  }

  // 2. Frame, Seat, Bars, Drivetrain
  vec3 pSym = vec3(p.x, p.y, abs(p.z));
  float dFrame = sdCapsule(p, vec3(-0.08, -0.48, 0.0), vec3(-0.30, 0.04, 0.0), 0.027);
  dFrame = min(dFrame, sdCapsule(p, vec3(-0.08, -0.48, 0.0), vec3(0.50, -0.02, 0.0), 0.029));
  dFrame = min(dFrame, sdCapsule(p, vec3(-0.29, 0.01, 0.0), vec3(0.45, 0.14, 0.0), 0.026));
  dFrame = min(dFrame, sdCapsule(p, vec3(0.52, -0.06, 0.0), vec3(0.42, 0.22, 0.0), 0.033));
  dFrame = min(dFrame, sdCylZ(p - vec3(-0.08, -0.48, 0.0), 0.046, 0.065));
  dFrame = min(dFrame, sdCapsule(pSym, vec3(-0.08, -0.48, 0.048), vec3(-0.72, -0.48, 0.08), 0.019));
  dFrame = min(dFrame, sdCapsule(pSym, vec3(-0.28, 0.00, 0.036), vec3(-0.72, -0.48, 0.08), 0.018));
  dFrame = min(dFrame, sdCapsule(pSym, vec3(0.52, -0.06, 0.0), vec3(0.52, -0.06, 0.076), 0.023));
  dFrame = min(dFrame, sdCapsule(pSym, vec3(0.52, -0.06, 0.076), vec3(0.72, -0.48, 0.08), 0.021));
  if (dFrame < bestD) { bestD = dFrame; mat = 3; }

  float dChrome = sdCapsule(p, vec3(-0.30, 0.04, 0.0), vec3(-0.35, 0.17, 0.0), 0.019);
  dChrome = min(dChrome, sdCapsule(p, vec3(0.42, 0.22, 0.0), vec3(0.39, 0.35, 0.0), 0.021));
  dChrome = min(dChrome, sdCapsule(p, vec3(0.39, 0.35, 0.0), vec3(0.44, 0.37, 0.0), 0.022));
  dChrome = min(dChrome, sdCapsule(pSym, vec3(0.44, 0.37, 0.0), vec3(0.45, 0.39, 0.15), 0.019));
  dChrome = min(dChrome, sdCapsule(pSym, vec3(0.45, 0.39, 0.15), vec3(0.35, 0.43, 0.27), 0.019));
  float dRing = max(sdCylZ(p - vec3(-0.08, -0.48, 0.072), 0.115, 0.009), -sdCylZ(p - vec3(-0.08, -0.48, 0.072), 0.082, 0.02));
  float dCog = sdCylZ(p - vec3(-0.72, -0.48, 0.064), 0.048, 0.009);
  dChrome = min(dChrome, min(dRing, dCog));
  if (dChrome < bestD) { bestD = dChrome; mat = 2; }

  float uCh = clamp((p.x + 0.72) / 0.64, 0.0, 1.0);
  float dChain = length(vec3(p.x - clamp(p.x, -0.72, -0.08), abs(p.y + 0.48) - mix(0.046, 0.110, uCh), p.z - 0.068)) - 0.009;
  if (dChain < bestD) { bestD = dChain; mat = 5; }

  float dGrips = sdCapsule(pSym, vec3(0.35, 0.43, 0.27), vec3(0.19, 0.42, 0.315), 0.026);
  float dSaddle = smin(
    sdRoundBox(p - vec3(-0.41, 0.185, 0.0), vec3(0.06, 0.022, 0.095), 0.02),
    sdTapCapsule(p, vec3(-0.40, 0.185, 0.0), vec3(-0.22, 0.175, 0.0), 0.068, 0.026),
    0.025
  );
  if (min(dGrips, dSaddle) < bestD) { bestD = min(dGrips, dSaddle); mat = 4; }

  float dBell = length(p - vec3(0.39, 0.44, 0.20)) - 0.028;
  if (dBell < bestD) { bestD = dBell; mat = 13; }

  // 3. Cranks, Pedals, Legs & Feet
  vec3 pPR = uJoints[0], pPL = uJoints[1];
  vec3 hR = uJoints[2], hL = uJoints[3];
  vec3 kR = uJoints[4], kL = uJoints[5];
  vec3 aR = uJoints[6], aL = uJoints[7];
  vec3 cR = vec3(pPR.x, pPR.y, 0.10), cL = vec3(pPL.x, pPL.y, -0.10);

  float dCrank = min(
    min(sdCapsule(p, vec3(-0.08, -0.48, 0.082), cR, 0.017), sdCapsule(p, vec3(-0.08, -0.48, -0.075), cL, 0.017)),
    min(sdCapsule(p, cR, pPR, 0.012), sdCapsule(p, cL, pPL, 0.012))
  );
  if (dCrank < bestD) { bestD = dCrank; mat = 2; }

  float dPedals = min(
    sdRoundBox(p - pPR, vec3(0.056, 0.014, 0.042), 0.005),
    sdRoundBox(p - pPL, vec3(0.056, 0.014, 0.042), 0.005)
  );
  if (dPedals < bestD) { bestD = dPedals; mat = 5; }

  float dThighWhite = min(
    sdTapCapsule(p, hR, mix(hR, kR, 0.65), 0.072, 0.044),
    sdTapCapsule(p, hL, mix(hL, kL, 0.65), 0.072, 0.044)
  );
  if (dThighWhite < bestD) { bestD = dThighWhite; mat = 6; }

  float dLegOrange = min(
    min(sdTapCapsule(p, mix(hR, kR, 0.55), kR, 0.036, 0.028), sdTapCapsule(p, kR, aR, 0.027, 0.021)),
    min(sdTapCapsule(p, mix(hL, kL, 0.55), kL, 0.036, 0.028), sdTapCapsule(p, kL, aL, 0.027, 0.021))
  );
  float dFootR = sdRoundBox(p - (pPR + vec3(0.016, 0.022, 0.0)), vec3(0.042, 0.007, 0.028), 0.005);
  dFootR = smin(dFootR, sdTapCapsule(p, aR, pPR + vec3(0.058, 0.020, -0.028), 0.016, 0.010), 0.01);
  dFootR = smin(dFootR, sdTapCapsule(p, aR, pPR + vec3(0.068, 0.020, 0.0), 0.017, 0.011), 0.01);
  dFootR = smin(dFootR, sdTapCapsule(p, aR, pPR + vec3(0.058, 0.020, 0.028), 0.016, 0.010), 0.01);
  float dFootL = sdRoundBox(p - (pPL + vec3(0.016, 0.022, 0.0)), vec3(0.042, 0.007, 0.028), 0.005);
  dFootL = smin(dFootL, sdTapCapsule(p, aL, pPL + vec3(0.058, 0.020, -0.028), 0.016, 0.010), 0.01);
  dFootL = smin(dFootL, sdTapCapsule(p, aL, pPL + vec3(0.068, 0.020, 0.0), 0.017, 0.011), 0.01);
  dFootL = smin(dFootL, sdTapCapsule(p, aL, pPL + vec3(0.058, 0.020, 0.028), 0.016, 0.010), 0.01);
  dLegOrange = min(dLegOrange, min(dFootR, dFootL));
  if (dLegOrange < bestD) { bestD = dLegOrange; mat = 10; }

  // 4. Pelican Body, Wings, Head, Beak, Pouch
  vec3 pb = p - vec3(0.0, uAnim.x, 0.0);
  vec3 pbSym = vec3(pb.x, pb.y, abs(pb.z));

  float dBody = smin(
    sdTapCapsule(pb, vec3(-0.36, 0.28, 0.0), vec3(-0.12, 0.54, 0.0), 0.175, 0.205),
    length((pb - vec3(-0.23, 0.40, 0.0)) * vec3(0.88, 1.0, 1.08)) - 0.21,
    0.06
  );
  float dTail = sdTapCapsule(pb, vec3(-0.42, 0.30, 0.0), vec3(-0.62, 0.38, 0.0), 0.065, 0.016);
  dTail = smin(dTail, sdTapCapsule(pbSym, vec3(-0.42, 0.30, 0.02), vec3(-0.59, 0.36, 0.055), 0.048, 0.014), 0.02);
  float dNeck = smin(
    sdTapCapsule(pb, vec3(-0.08, 0.58, 0.0), vec3(-0.13, 0.78, 0.0), 0.095, 0.076),
    sdTapCapsule(pb, vec3(-0.13, 0.78, 0.0), vec3(-0.03, 0.96, 0.0), 0.076, 0.072),
    0.04
  );
  vec3 wS = vec3(-0.14, 0.56, 0.165), wE = vec3(0.02, 0.46, 0.285), wW = vec3(0.25, 0.425, 0.305);
  float dWing = smin(
    sdTapCapsule(pbSym, wS, wE, 0.068, 0.050),
    sdTapCapsule(pbSym, wS + vec3(-0.08, -0.07, 0.0), wE + vec3(-0.07, -0.05, 0.0), 0.056, 0.042),
    0.03
  );
  dWing = smin(dWing, sdTapCapsule(pbSym, wE, wW, 0.048, 0.036), 0.03);
  dWing = smin(dWing, sdTapCapsule(pbSym, wE + vec3(-0.06, -0.04, 0.0), wW + vec3(-0.07, -0.03, 0.0), 0.042, 0.028), 0.025);
  float dHead = sdTapCapsule(pb, vec3(-0.04, 0.98, 0.0), vec3(0.05, 1.00, 0.0), 0.104, 0.086);
  float dCrest = min(
    sdTapCapsule(pb, vec3(-0.06, 1.05, 0.0), vec3(-0.21, 1.08, 0.0), 0.030, 0.010),
    sdTapCapsule(pb, vec3(-0.07, 1.01, 0.0), vec3(-0.19, 1.01, 0.0), 0.026, 0.010)
  );
  dHead = smin(dHead, dCrest, 0.025);
  dHead = smin(dHead, sdCapsule(pbSym, vec3(0.01, 1.045, 0.062), vec3(0.072, 1.035, 0.052), 0.020), 0.015);
  float dWhite = min(min(dBody, dTail), min(min(dNeck, dWing), dHead));
  if (dWhite < bestD) { bestD = dWhite; mat = 6; }

  float dDarkFeathers = sdTapCapsule(pbSym, wE + vec3(-0.11, -0.07, 0.0), wW + vec3(-0.12, -0.05, 0.0), 0.035, 0.022);
  dDarkFeathers = min(dDarkFeathers, min(
    sdTapCapsule(pbSym, wW, vec3(0.22, 0.39, 0.28), 0.024, 0.014),
    min(
      sdTapCapsule(pbSym, wW + vec3(0.03, 0.0, 0.0), vec3(0.27, 0.39, 0.28), 0.022, 0.013),
      sdTapCapsule(pbSym, wW + vec3(-0.03, 0.0, 0.0), vec3(0.18, 0.395, 0.285), 0.022, 0.013)
    )
  ));
  if (dDarkFeathers < bestD + 0.004) { bestD = dDarkFeathers; mat = 7; }

  float dScarf = min(
    sdTorusXY(vec3(pb.x + 0.09, pb.z, pb.y - 0.62), vec2(0.095, 0.022)),
    sdTapCapsule(pb, vec3(-0.18, 0.62, 0.02), vec3(-0.32, 0.65, 0.06), 0.022, 0.012)
  );
  if (dScarf < bestD) { bestD = dScarf; mat = 14; }

  float u = clamp((pb.x - 0.06) / 0.52, 0.0, 1.0);
  float yBill = mix(0.985, 0.935, u) + 0.012 * sin(u * 3.14159265);
  float wBill = mix(0.062, 0.018, pow(u, 0.75));
  float hBill = mix(0.032, 0.013, u);
  vec3 qBill = vec3(pb.x - 0.32, pb.y - yBill, pb.z);
  float dUpperBill = smin(
    length(max(abs(qBill) - vec3(0.26, hBill, wBill), 0.0)) - 0.012,
    sdTapCapsule(pb, vec3(0.55, 0.942, 0.0), vec3(0.60, 0.892, 0.0), 0.021, 0.009),
    0.018
  );
  if (dUpperBill < bestD) { bestD = dUpperBill; mat = 8; }

  float up = clamp((pb.x - 0.01) / 0.54, 0.0, 1.0);
  float sUp = sin(up * 3.14159265);
  float yTop = mix(0.955, 0.925, up);
  float yBot = yTop - 0.23 * sUp * (1.0 - 0.36 * up);
  float hPouch = 0.5 * (yTop - yBot);
  float wPouch = 0.012 + 0.068 * pow(max(sUp, 0.0001), 0.65) * (1.0 - 0.25 * up);
  float vP = clamp((yTop - pb.y) / max(0.02, 2.0 * hPouch), 0.0, 1.0);
  vec3 qPouch = vec3(pb.x - 0.28, pb.y - 0.5 * (yTop + yBot), pb.z);
  float dPouch = length(max(abs(qPouch) - vec3(0.265, hPouch, wPouch * sin(vP * 2.5 + 0.35)), 0.0)) - 0.018;
  if (dPouch < bestD) { bestD = dPouch; mat = 9; }

  float dEye = length(pbSym - vec3(0.045, 1.015, 0.084)) - 0.027;
  if (dEye < bestD + 0.003) { bestD = dEye; mat = 11; }
  float dPupil = length(pbSym - vec3(0.062, 1.017, 0.095)) - 0.013;
  if (dPupil < bestD + 0.003) { bestD = dPupil; mat = 12; }

  // Material palettes
  albedo = vec3(0.8);
  specParams = vec3(0.4, 0.0, 0.0);

  if (mat == 1) {
    // Tire with cream whitewall ring & tread ribs
    float ang = atan(pw.y, pw.x) + uAnim.y;
    float tread = 0.02 * sin(ang * 36.0);
    float wall = smoothstep(0.352, 0.346, rW) * smoothstep(0.326, 0.332, rW);
    albedo = mix(vec3(0.11 + tread, 0.12 + tread, 0.14 + tread), vec3(0.92, 0.89, 0.80), wall * 0.85);
    specParams = vec3(0.65, 0.05, 0.0);
  } else if (mat == 2) {
    // Chrome / Silver Alloy
    albedo = vec3(0.83, 0.86, 0.90);
    specParams = vec3(0.18, 0.88, 0.0);
  } else if (mat == 3) {
    // Glossy Maritime Teal-Blue Frame with Cream headtube accent
    float band = smoothstep(0.34, 0.36, p.x) * smoothstep(0.49, 0.47, p.x) * step(-0.04, p.y);
    albedo = mix(vec3(0.09, 0.49, 0.68), vec3(0.95, 0.92, 0.84), band * 0.75);
    specParams = vec3(0.20, 0.25, 0.0);
  } else if (mat == 4) {
    // Saddle Brown Leather & Grips
    float gripRib = 0.04 * sin(p.x * 160.0);
    albedo = vec3(0.44 + gripRib, 0.23 + gripRib * 0.5, 0.11);
    specParams = vec3(0.42, 0.05, 0.05);
  } else if (mat == 5) {
    // Pedals & Chain (Dark Anodized with Amber Reflector strip)
    float refl = step(0.046, abs(p.x - (p.z > 0.0 ? pPR.x : pPL.x))) * step(-0.42, p.y);
    albedo = mix(vec3(0.18, 0.19, 0.22), vec3(0.98, 0.58, 0.08), refl);
    specParams = vec3(0.35, 0.45, 0.0);
  } else if (mat == 6) {
    // Pelican White-Ivory Plumage
    float barb = 0.025 * sin(pb.x * 55.0 + pb.y * 40.0);
    float eyePatch = smoothstep(0.048, 0.030, length(pbSym - vec3(0.045, 1.015, 0.080)));
    albedo = mix(vec3(0.95 + barb, 0.94 + barb, 0.90 + barb), vec3(0.98, 0.78, 0.24), eyePatch * 0.75);
    specParams = vec3(0.52, 0.0, 0.35);
  } else if (mat == 7) {
    // Dark Slate Primary Wingtip Feathers
    float barb = 0.02 * sin(pb.x * 70.0);
    albedo = vec3(0.17 + barb, 0.19 + barb, 0.24 + barb);
    specParams = vec3(0.48, 0.05, 0.1);
  } else if (mat == 8) {
    // Upper Pelican Beak (Warm Ivory-Yellow to Coral-Salmon & Red Tip Nail)
    float uB = clamp((pb.x - 0.06) / 0.52, 0.0, 1.0);
    vec3 billCol = mix(vec3(0.96, 0.76, 0.34), vec3(0.96, 0.46, 0.26), smoothstep(0.15, 0.85, uB));
    billCol = mix(billCol, vec3(0.92, 0.24, 0.16), smoothstep(0.84, 0.96, uB));
    albedo = billCol;
    specParams = vec3(0.28, 0.05, 0.25);
  } else if (mat == 9) {
    // Golden-Ochre Throat Pouch with longitudinal pleats
    float pleat = 0.045 * sin((pb.y - 0.86) * 110.0 + pb.x * 22.0);
    albedo = vec3(0.97 + pleat, 0.63 + pleat * 0.7, 0.15);
    specParams = vec3(0.38, 0.0, 0.55);
  } else if (mat == 10) {
    // Vibrant Tangerine-Orange Legs & Webbed Feet
    float sc = 0.03 * sin(p.y * 120.0 + p.x * 60.0);
    albedo = vec3(0.96 + sc, 0.42 + sc * 0.6, 0.10);
    specParams = vec3(0.36, 0.05, 0.25);
  } else if (mat == 11) {
    // Eye Sclera
    albedo = vec3(0.98, 0.98, 0.96);
    specParams = vec3(0.10, 0.05, 0.0);
  } else if (mat == 12) {
    // Glossy Black Pupil
    albedo = vec3(0.03, 0.03, 0.04);
    specParams = vec3(0.05, 0.15, 0.0);
  } else if (mat == 13) {
    // Brass Handlebar Bell
    albedo = vec3(0.95, 0.76, 0.24);
    specParams = vec3(0.16, 0.85, 0.0);
  } else if (mat == 14) {
    // Red Cycling Bandana / Neckerchief
    albedo = vec3(0.88, 0.15, 0.18);
    specParams = vec3(0.45, 0.0, 0.15);
  }

  return vec4(float(mat), bestD, 0.0, 0.0);
}

vec3 renderBackground(vec3 ro, vec3 rd) {
  float y = clamp(rd.y, -1.0, 1.0);
  vec3 zenith = vec3(0.14, 0.28, 0.48);
  vec3 horizon = vec3(0.34, 0.50, 0.66);
  vec3 ground = vec3(0.20, 0.24, 0.30);

  vec3 col = y >= 0.0
    ? mix(horizon, zenith, pow(y, 0.55))
    : mix(horizon * 0.82, ground, pow(-y, 0.45));

  vec3 sunDir = normalize(vec3(0.55, 0.42, -0.65));
  float sunDot = max(dot(rd, sunDir), 0.0);
  col += vec3(0.95, 0.72, 0.42) * (0.18 * pow(sunDot, 8.0) + 0.25 * pow(sunDot, 64.0));

  // Subtle coastal ground shadow & lane lines when looking from above y = -0.89
  if (ro.y > -0.88 && rd.y < -0.01) {
    float tG = (-0.905 - ro.y) / rd.y;
    if (tG > 0.0 && tG < 18.0) {
      vec3 pG = ro + rd * tG;
      float fade = exp(-0.06 * tG * tG);
      // Soft elliptical contact shadows under both wheels & center frame
      float shRear = smoothstep(0.42, 0.02, length((pG.xz - vec2(-0.72, 0.0)) * vec2(1.1, 3.2)));
      float shFront = smoothstep(0.42, 0.02, length((pG.xz - vec2(0.72, 0.0)) * vec2(1.1, 3.2)));
      float shMid = smoothstep(0.95, 0.1, length((pG.xz - vec2(0.0, 0.0)) * vec2(0.75, 2.2)));
      float shadow = clamp(max(shRear, shFront) * 0.58 + shMid * 0.28, 0.0, 0.68);

      // Subtle warm boardwalk/road strip under bike
      float roadMask = smoothstep(0.85, 0.75, abs(pG.z)) * smoothstep(4.5, 1.5, abs(pG.x));
      vec3 roadCol = vec3(0.27, 0.29, 0.34);
      float dash = smoothstep(0.025, 0.018, abs(pG.z)) * step(0.0, sin(pG.x * 5.0 - uAnim.y * 1.5));
      roadCol = mix(roadCol, vec3(0.78, 0.68, 0.36), dash * 0.45);
      col = mix(col, roadCol, roadMask * fade * 0.45);
      col *= 1.0 - shadow * fade;
    }
  }

  return col;
}

vec2 intersectAABB(vec3 ro, vec3 invRd) {
  const vec3 bMin = vec3(-1.22, -0.96, -0.42);
  const vec3 bMax = vec3( 1.22,  1.18,  0.42);
  vec3 t0 = (bMin - ro) * invRd;
  vec3 t1 = (bMax - ro) * invRd;
  vec3 tSmaller = min(t0, t1);
  vec3 tBigger  = max(t0, t1);
  float tNear = max(max(tSmaller.x, tSmaller.y), tSmaller.z);
  float tFar  = min(min(tBigger.x, tBigger.y), tBigger.z);
  return vec2(tNear, tFar);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / max(uRes.y, 1.0);
  vec3 ro = uCamPos;
  vec3 rd = normalize(uCamFwd + uv.x * 0.82 * uCamRight + uv.y * 0.82 * uCamUp);

  vec3 invRd = 1.0 / (rd + vec3(equal(rd, vec3(0.0))) * 1e-8);
  vec2 box = intersectAABB(ro, invRd);

  vec3 col = renderBackground(ro, rd);

  if (box.x <= box.y && box.y > 0.0) {
    float t = max(0.02, box.x);
    float tMax = min(box.y, 16.0);
    bool hit = false;

    for (int i = 0; i < 68; i++) {
      vec3 p = ro + rd * t;
      float d = mapDist(p);
      float eps = 0.0011 * clamp(t * 0.45, 0.45, 2.2);
      if (d < eps) {
        hit = true;
        break;
      }
      t += d;
      if (t > tMax) break;
    }

    if (hit) {
      vec3 p = ro + rd * t;
      vec3 n = calcNormal(p);
      vec3 albedo, specParams;
      classifyMaterial(p, albedo, specParams);

      float rough = specParams.x;
      float metal = specParams.y;
      float sss   = specParams.z;

      float ao = calcAO(p, n);

      vec3 keyDir = normalize(vec3(0.52, 0.76, 0.38));
      vec3 fillDir = normalize(-rd + vec3(-0.25, 0.35, 0.15));
      vec3 backDir = normalize(vec3(-0.65, 0.35, -0.60));

      float sh = calcSoftShadow(p + n * 0.004, keyDir);

      float diffKey  = max(dot(n, keyDir), 0.0) * sh;
      float diffFill = max(dot(n, fillDir), 0.0) * 0.38;
      float diffBack = max(dot(n, backDir), 0.0) * 0.25;

      // Subsurface wrap lighting for feathers, pouch, beak, feet
      float wrap = max(0.0, (dot(n, keyDir) + 0.45) / 1.45) * sss * (0.4 + 0.6 * sh);
      float backGlow = pow( clamp(dot(rd, -keyDir), 0.0, 1.0), 2.5 ) * sss * 0.35;

      vec3 skyAmb = mix(vec3(0.28, 0.32, 0.38), vec3(0.55, 0.66, 0.78), 0.5 + 0.5 * n.y);

      vec3 hKey = normalize(keyDir - rd);
      vec3 hFill = normalize(fillDir - rd);
      float shininess = mix(96.0, 8.0, rough * rough);
      float specKey = pow(max(dot(n, hKey), 0.0), shininess) * sh * mix(0.25, 1.4, 1.0 - rough);
      float specFill = pow(max(dot(n, hFill), 0.0), shininess * 0.6) * 0.22 * (1.0 - rough);

      vec3 f0 = mix(vec3(0.04), albedo, metal);
      float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.5);

      vec3 diffLight = skyAmb * 0.48 * ao
        + vec3(1.04, 0.97, 0.88) * (diffKey * 0.88 + wrap * 0.55)
        + vec3(0.78, 0.86, 0.98) * diffFill * ao
        + vec3(0.95, 0.82, 0.68) * (diffBack * ao + backGlow);

      vec3 reflSky = mix(vec3(0.22, 0.28, 0.36), vec3(0.68, 0.80, 0.94), smoothstep(-0.2, 0.6, reflect(rd, n).y));

      vec3 lit = albedo * (1.0 - metal * 0.65) * diffLight;
      lit += mix(vec3(1.0, 0.98, 0.94), albedo, metal * 0.7) * (specKey + specFill);
      lit += reflSky * f0 * mix(0.3, 1.2, metal) * ao;
      lit += vec3(0.75, 0.84, 0.96) * fresnel * 0.22 * ao;

      col = lit;
    }
  }

  // ACES-inspired filmic tonemapping and sRGB gamma
  col = max(col, 0.0);
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

  fragColor = vec4(col, 1.0);
}`;

  let program = null;
  let vs = null;
  let fs = null;
  let vao = null;
  let uResLoc = null;
  let uCamPosLoc = null;
  let uCamRightLoc = null;
  let uCamUpLoc = null;
  let uCamFwdLoc = null;
  let uAnimLoc = null;
  let uJointsLoc = null;

  const jointsFlat = new Float32Array(24);

  function compileShader(type, source) {
    const sh = gl.createShader(type);
    if (!sh) {
      if (gl.isContextLost()) return null;
      throw new Error('Failed to create WebGL shader.');
    }
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const info = gl.getShaderInfoLog(sh) || 'Unknown shader compile error';
      gl.deleteShader(sh);
      throw new Error(`Shader compilation failed: ${info}`);
    }
    return sh;
  }

  function initGlResources() {
    if (gl.isContextLost()) return;
    vs = compileShader(gl.VERTEX_SHADER, vsSource);
    fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    program = gl.createProgram();
    if (!program) {
      if (gl.isContextLost()) return;
      throw new Error('Failed to create WebGL program.');
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
      const info = gl.getProgramInfoLog(program) || 'Unknown program link error';
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`Program link failed: ${info}`);
    }

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    uResLoc = gl.getUniformLocation(program, 'uRes');
    uCamPosLoc = gl.getUniformLocation(program, 'uCamPos');
    uCamRightLoc = gl.getUniformLocation(program, 'uCamRight');
    uCamUpLoc = gl.getUniformLocation(program, 'uCamUp');
    uCamFwdLoc = gl.getUniformLocation(program, 'uCamFwd');
    uAnimLoc = gl.getUniformLocation(program, 'uAnim');
    uJointsLoc = gl.getUniformLocation(program, 'uJoints');
  }

  initGlResources();

  function solveKnee(hx, hy, ax, ay, zOut, outArr, offset) {
    const dx = ax - hx;
    const dy = ay - hy;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2) || 0.001;
    const h = Math.sqrt(Math.max(0.005, 0.1764 - 0.25 * d2));
    const nx = -dy / d;
    const ny = dx / d;
    outArr[offset] = 0.5 * (hx + ax) + nx * h;
    outArr[offset + 1] = 0.5 * (hy + ay) + ny * h;
    outArr[offset + 2] = zOut;
  }

  function updateJoints(t) {
    const theta = 0.65 + t * 2.4;
    const cT = Math.cos(theta);
    const sT = Math.sin(theta);
    const bob = 0.012 * Math.sin(theta * 2.0);
    const rC = 0.165;

    // 0: pPR, 1: pPL
    const prX = -0.08 + rC * cT;
    const prY = -0.48 + rC * sT;
    const plX = -0.08 - rC * cT;
    const plY = -0.48 - rC * sT;

    jointsFlat[0] = prX; jointsFlat[1] = prY; jointsFlat[2] = 0.155;
    jointsFlat[3] = plX; jointsFlat[4] = plY; jointsFlat[5] = -0.155;

    // 2: hR, 3: hL
    const hX = -0.27;
    const hY = 0.25 + bob;
    jointsFlat[6] = hX; jointsFlat[7] = hY; jointsFlat[8] = 0.135;
    jointsFlat[9] = hX; jointsFlat[10] = hY; jointsFlat[11] = -0.135;

    // 6: aR, 7: aL
    const arX = prX - 0.025;
    const arY = prY + 0.032;
    const alX = plX - 0.025;
    const alY = plY + 0.032;
    jointsFlat[18] = arX; jointsFlat[19] = arY; jointsFlat[20] = 0.155;
    jointsFlat[21] = alX; jointsFlat[22] = alY; jointsFlat[23] = -0.155;

    // 4: kR, 5: kL
    solveKnee(hX, hY, arX, arY, 0.16, jointsFlat, 12);
    solveKnee(hX, hY, alX, alY, -0.16, jointsFlat, 15);

    return { bob, wheelAng: -theta * 0.75 };
  }

  function render(timeSeconds) {
    if (Number.isFinite(timeSeconds)) {
      lastTime = timeSeconds;
    }
    if (disposed || contextLost || gl.isContextLost() || !program) {
      return;
    }

    const w = canvas.width | 0;
    const h = canvas.height | 0;
    if (w <= 0 || h <= 0) return;

    gl.viewport(0, 0, w, h);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    const cp = Math.cos(Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch)));
    const sp = Math.sin(Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch)));
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);

    const dirX = sy * cp;
    const dirY = sp;
    const dirZ = cy * cp;

    const targetX = 0.0;
    const targetY = 0.06;
    const targetZ = 0.0;

    const camX = targetX + distance * dirX;
    const camY = targetY + distance * dirY;
    const camZ = targetZ + distance * dirZ;

    const anim = updateJoints(lastTime);

    gl.uniform2f(uResLoc, w, h);
    gl.uniform3f(uCamPosLoc, camX, camY, camZ);
    gl.uniform3f(uCamRightLoc, cy, 0.0, -sy);
    gl.uniform3f(uCamUpLoc, -sy * sp, cp, -cy * sp);
    gl.uniform3f(uCamFwdLoc, -dirX, -dirY, -dirZ);
    gl.uniform4f(uAnimLoc, anim.bob, anim.wheelAng, lastTime, 0.0);
    gl.uniform3fv(uJointsLoc, jointsFlat);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setView(nextYaw, nextPitch, nextDistance) {
    if (Number.isFinite(nextYaw)) yaw = nextYaw;
    if (Number.isFinite(nextPitch)) pitch = nextPitch;
    if (Number.isFinite(nextDistance)) distance = Math.max(0.05, nextDistance);
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  // Interaction state
  const activePointers = new Map();
  let lastPinchDist = 0;
  let mouseDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let lastTouchPinch = 0;
  let lastProcessedEvent = null;

  function clampVal(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function focusCanvas() {
    try {
      canvas.focus({ preventScroll: true });
    } catch (_) {
      try { canvas.focus(); } catch (__) {}
    }
  }

  function getOrbitSpeed() {
    const refW = (canvas.clientWidth || canvas.width || 360);
    return Math.max(0.011, (2.2 * Math.PI) / Math.max(180, Math.min(480, refW)));
  }

  function applyOrbitDelta(dx, dy) {
    const s = getOrbitSpeed();
    yaw -= dx * s;
    pitch = clampVal(pitch + dy * s * 0.85, -MAX_PITCH, MAX_PITCH);
  }

  function onPointerDown(e) {
    if (disposed) return;
    focusCanvas();
    if (e.cancelable) e.preventDefault();
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (typeof canvas.setPointerCapture === 'function') {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  }

  function onPointerMove(e) {
    if (disposed || e === lastProcessedEvent) return;
    lastProcessedEvent = e;
    if (!activePointers.has(e.pointerId)) return;
    if (e.cancelable) e.preventDefault();

    const prev = activePointers.get(e.pointerId);
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;

    if (activePointers.size === 1) {
      applyOrbitDelta(dx, dy);
      render(lastTime);
    } else if (activePointers.size >= 2) {
      const pts = Array.from(activePointers.values());
      const curDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (lastPinchDist > 1 && curDist > 1) {
        const scale = lastPinchDist / curDist;
        distance = clampVal(distance * scale, MIN_DIST, MAX_DIST);
        render(lastTime);
      }
      lastPinchDist = curDist;
    }
  }

  function onPointerUp(e) {
    if (disposed || e === lastProcessedEvent) return;
    lastProcessedEvent = e;
    activePointers.delete(e.pointerId);
    if (typeof canvas.releasePointerCapture === 'function') {
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (activePointers.size < 2) {
      lastPinchDist = 0;
    }
  }

  function onMouseDown(e) {
    if (disposed || activePointers.size > 0) return;
    if (e.button !== 0) return;
    focusCanvas();
    if (e.cancelable) e.preventDefault();
    mouseDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function onMouseMove(e) {
    if (disposed || e === lastProcessedEvent || activePointers.size > 0) return;
    lastProcessedEvent = e;
    if (!mouseDragging) return;
    if (e.cancelable) e.preventDefault();
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    applyOrbitDelta(dx, dy);
    render(lastTime);
  }

  function onMouseUp(e) {
    if (disposed || e === lastProcessedEvent) return;
    lastProcessedEvent = e;
    mouseDragging = false;
  }

  function onTouchStart(e) {
    if (disposed || activePointers.size > 0) return;
    focusCanvas();
    if (e.cancelable) e.preventDefault();
    if (e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length >= 2) {
      lastTouchPinch = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
    }
  }

  function onTouchMove(e) {
    if (disposed || activePointers.size > 0) return;
    if (e.cancelable) e.preventDefault();
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastTouchX;
      const dy = e.touches[0].clientY - lastTouchY;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      applyOrbitDelta(dx, dy);
      render(lastTime);
    } else if (e.touches.length >= 2) {
      const d = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      if (lastTouchPinch > 1 && d > 1) {
        distance = clampVal(distance * (lastTouchPinch / d), MIN_DIST, MAX_DIST);
        render(lastTime);
      }
      lastTouchPinch = d;
    }
  }

  function onTouchEnd(e) {
    if (disposed || activePointers.size > 0) return;
    if (e.touches && e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
    lastTouchPinch = 0;
  }

  function onWheel(e) {
    if (disposed) return;
    if (e.cancelable) e.preventDefault();
    const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (raw === 0) return;
    const step = Math.abs(raw) < 12 ? Math.sign(raw) * 65 : clampVal(raw, -240, 240);
    distance = clampVal(distance * Math.exp(step * 0.0022), MIN_DIST, MAX_DIST);
    render(lastTime);
  }

  function onKeyDown(e) {
    if (disposed) return;
    const k = e.key;
    const c = e.code;
    let handled = true;
    if (k === 'ArrowLeft' || c === 'ArrowLeft') {
      yaw -= 0.16;
    } else if (k === 'ArrowRight' || c === 'ArrowRight') {
      yaw += 0.16;
    } else if (k === 'ArrowUp' || c === 'ArrowUp') {
      pitch = clampVal(pitch + 0.13, -MAX_PITCH, MAX_PITCH);
    } else if (k === 'ArrowDown' || c === 'ArrowDown') {
      pitch = clampVal(pitch - 0.13, -MAX_PITCH, MAX_PITCH);
    } else if (k === '+' || k === '=' || c === 'Equal' || c === 'NumpadAdd') {
      distance = clampVal(distance * 0.86, MIN_DIST, MAX_DIST);
    } else if (k === '-' || k === '_' || c === 'Minus' || c === 'NumpadSubtract') {
      distance = clampVal(distance * 1.16, MIN_DIST, MAX_DIST);
    } else {
      handled = false;
    }
    if (handled) {
      if (e.cancelable) e.preventDefault();
      render(lastTime);
    }
  }

  function onContextLost(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    contextLost = true;
  }

  function onContextRestored() {
    if (disposed) return;
    contextLost = false;
    initGlResources();
    render(lastTime);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  render(0.0);

  function dispose() {
    if (disposed) return;
    disposed = true;
    activePointers.clear();

    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);

    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);

    if (prevTabIndex === null) {
      canvas.removeAttribute('tabindex');
    }
    if (canvas.style) {
      canvas.style.touchAction = prevTouchAction;
      canvas.style.outline = prevOutline;
      canvas.style.userSelect = prevUserSelect;
    }

    if (!gl.isContextLost()) {
      gl.bindVertexArray(null);
      gl.useProgram(null);
      if (vao) gl.deleteVertexArray(vao);
      if (program) gl.deleteProgram(program);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
    }
    vao = null;
    program = null;
    vs = null;
    fs = null;
  }

  return {
    render,
    setView,
    getView,
    dispose
  };
}
export default createPelicanSdf;
