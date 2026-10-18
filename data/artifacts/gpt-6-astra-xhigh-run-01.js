export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  });
  if (!gl) throw new Error("createPelicanSdf requires WebGL2.");

  const vertexSource = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const fragmentSource = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uSize;
uniform vec3 uEye, uRight, uUp, uForward;
uniform vec2 uCrank;
uniform vec3 uKneeR, uKneeL, uAnkleR, uAnkleL;
uniform float uSpin, uFlutter;
out vec4 outColor;

const float PI = 3.14159265359;
const vec3 LIGHT = vec3(-0.435, 0.805, 0.403);

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}
float box(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float roundBox(vec3 p, vec3 b, float r) {
  return box(p, b) - r;
}
float ell(vec3 p, vec3 r) {
  float a = length(p / r);
  if (a < 0.0001) return -min(r.x, min(r.y, r.z));
  return a * (a - 1.0) / length(p / (r * r));
}
float cap(vec3 p, vec3 a, vec3 b, float r) {
  vec3 v = b - a;
  return length(p - a - v * clamp(dot(p-a,v)/dot(v,v),0.0,1.0)) - r;
}
float taper(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 v = b-a;
  float len = length(v);
  v /= len;
  vec3 w = p-a;
  float y = dot(w,v);
  vec2 q = vec2(length(w-v*y), y);
  float k = (ra-rb)/len;
  float s = sqrt(max(1.0-k*k,0.001));
  float t = dot(q,vec2(-k,s));
  if (t < 0.0) return length(q)-ra;
  if (t > s*len) return length(q-vec2(0.0,len))-rb;
  return dot(q,vec2(s,k))-ra;
}
float torz(vec3 p, float r, float t) {
  return length(vec2(length(p.xy)-r,p.z))-t;
}
float cylz(vec3 p, float r, float h) {
  vec2 q = vec2(length(p.xy)-r,abs(p.z)-h);
  return length(max(q,0.0))+min(max(q.x,q.y),0.0);
}
float smin(float a, float b, float k) {
  float h = max(k-abs(a-b),0.0)/k;
  return min(a,b)-h*h*k*0.25;
}
void hit(inout vec2 h, float d, float m) {
  if (d < h.x) h = vec2(d,m);
}
bool group(inout vec2 h, float bound) {
  if (bound >= h.x) return false;
  if (bound > 0.14) {
    h = vec2(bound,0.0);
    return false;
  }
  return true;
}

vec2 scene(vec3 p) {
  vec2 h = vec2(1000.0,0.0);
  vec3 q;

  // Two complete wheels, with dished spokes and enamel mudguards.
  q = vec3(abs(p.x)-1.20,p.y-0.75,p.z);
  if (group(h,box(q,vec3(0.83,0.85,0.23)))) {
    float radial = length(q.xy);
    float tire = length(vec2(radial-0.675,q.z))-0.075;
    float tm = abs(q.z)>0.047 && abs(radial-0.675)<0.057 ? 3.0 : 2.0;
    hit(h,tire,tm);
    hit(h,torz(q,0.604,0.026),4.0);
    hit(h,torz(vec3(q.xy,abs(q.z)-0.025),0.589,0.010),4.0);
    hit(h,cylz(q,0.066,0.103),4.0);
    hit(h,cylz(q,0.032,0.179),4.0);

    float spin = uSpin * (p.x < 0.0 ? -1.0 : 1.0);
    float a = mod(atan(q.y,q.x)+spin+PI/20.0,PI/10.0)-PI/20.0;
    vec3 spoke = vec3(radial*cos(a),radial*sin(a),abs(q.z));
    hit(h,cap(spoke,vec3(0.060,0,0.084),vec3(0.589,0,0.015),0.0075),4.0);

    vec2 r = rot(-spin)*q.xy;
    hit(h,ell(vec3(abs(r.x)-0.36,r.y,abs(q.z)-0.047),
              vec3(0.067,0.022,0.017)),10.0);

    float fender = length(vec2(radial-0.793,max(abs(q.z)-0.067,0.0)))-0.018;
    hit(h,max(fender,0.12-q.y),5.0);
    float trim = torz(vec3(q.xy,abs(q.z)-0.071),0.792,0.007);
    hit(h,max(trim,0.13-q.y),4.0);
    if (p.x < 0.0)
      hit(h,ell(p-vec3(-1.963,1.005,0),vec3(0.024,0.052,0.054)),14.0);
  }

  // Diamond frame, rear stays, fork, saddle, bars and headlamp.
  if (group(h,box(p-vec3(-0.10,1.42,0),vec3(1.40,0.94,0.68)))) {
    float d = cap(p,vec3(-0.55,1.67,0),vec3(0.70,1.73,0),0.045);
    d = min(d,cap(p,vec3(0.79,1.48,0),vec3(-0.12,0.84,0),0.052));
    d = min(d,cap(p,vec3(-0.12,0.84,0),vec3(-0.55,1.67,0),0.047));
    d = min(d,cap(p,vec3(0.68,1.79,0),vec3(0.81,1.45,0),0.066));
    q = vec3(p.xy,abs(p.z));
    d = min(d,cap(q,vec3(-1.20,0.75,0.13),vec3(-0.55,1.67,0.035),0.029));
    d = min(d,cap(q,vec3(-1.20,0.75,0.13),vec3(-0.12,0.84,0.09),0.032));
    d = min(d,cap(q,vec3(0.81,1.46,0.105),vec3(0.96,1.08,0.13),0.036));
    d = min(d,cap(q,vec3(0.96,1.08,0.13),vec3(1.20,0.75,0.13),0.036));
    d = min(d,cap(p,vec3(0.82,1.44,-0.13),vec3(0.82,1.44,0.13),0.044));
    hit(h,d,5.0);

    hit(h,cap(p,vec3(-0.55,1.67,0),vec3(-0.68,1.97,0),0.032),4.0);
    hit(h,cap(p,vec3(-0.557,1.685,0),vec3(-0.578,1.733,0),0.047),10.0);
    hit(h,ell(p-vec3(-0.66,1.995,0),vec3(0.318,0.081,0.181)),8.0);
    hit(h,cap(q,vec3(-0.86,1.929,0.092),vec3(-0.43,1.94,0.073),0.013),4.0);

    hit(h,cap(p,vec3(0.68,1.79,0),vec3(0.58,2.08,0),0.033),4.0);
    hit(h,cap(p,vec3(0.58,2.08,0),vec3(0.76,2.19,0),0.035),4.0);
    hit(h,cap(p,vec3(0.76,2.19,-0.47),vec3(0.76,2.19,0.47),0.028),4.0);
    hit(h,cap(q,vec3(0.76,2.19,0.47),vec3(0.52,2.19,0.55),0.029),4.0);
    hit(h,cap(q,vec3(0.69,2.19,0.496),vec3(0.50,2.19,0.56),0.044),8.0);
    hit(h,cap(q,vec3(0.68,2.16,0.47),vec3(0.53,2.12,0.49),0.012),4.0);
    hit(h,ell(p-vec3(0.77,2.248,0.27),vec3(0.065,0.046,0.065)),10.0);

    float cable = cap(q,vec3(0.65,2.15,0.45),vec3(0.72,1.96,0.32),0.008);
    cable = min(cable,cap(q,vec3(0.72,1.96,0.32),vec3(0.92,1.54,0.17),0.008));
    hit(h,cable,2.0);
    hit(h,roundBox(q-vec3(0.94,1.35,0.127),vec3(0.047,0.029,0.026),0.008),2.0);
    hit(h,cap(p,vec3(0.75,1.77,0),vec3(0.96,1.77,0),0.018),4.0);
    hit(h,cylz((p-vec3(0.96,1.83,0)).zyx,0.085,0.092),4.0);
    hit(h,ell(p-vec3(1.060,1.83,0),vec3(0.018,0.072,0.072)),15.0);
  }

  // Smooth body, S-shaped neck, head, and a small fluttering scarf.
  if (group(h,box(p-vec3(-0.39,2.98,0),vec3(1.17,1.13,0.52)))) {
    q = p-vec3(-0.65,2.53,0);
    q.xy = rot(0.13)*q.xy;
    float d = ell(q,vec3(0.73,0.61,0.44));
    d = smin(d,taper(p,vec3(-0.17,2.66,0),vec3(0.16,3.00,0),0.29,0.215),0.14);
    d = smin(d,taper(p,vec3(0.16,3.00,0),vec3(0.045,3.35,0),0.215,0.172),0.10);
    d = smin(d,taper(p,vec3(0.045,3.35,0),vec3(0.28,3.62,0),0.172,0.235),0.10);
    d = smin(d,ell(p-vec3(0.38,3.67,0),vec3(0.34,0.32,0.274)),0.10);
    hit(h,d,1.0);

    q = p-vec3(0.153,3.025,0);
    vec2 band = vec2(abs(length(q.xz)-0.226)-0.012,abs(q.y)-0.058);
    hit(h,length(max(band,0.0))+min(max(band.x,band.y),0.0)-0.006,14.0);
    hit(h,ell(p-vec3(-0.075,3.06,0.10),vec3(0.084,0.074,0.086)),14.0);
    q = p-vec3(-0.365,3.085,0.10);
    q.xy = rot(0.10)*q.xy;
    q.y += 0.028*sin(q.x*9.0+uFlutter);
    d = roundBox(q,vec3(0.30,0.060,0.023),0.012);
    d = max(d,(-q.x-0.24)*0.7-abs(q.y));
    hit(h,d*0.90,14.0);
  }

  // Bilateral wings reach the handlebar; overlapping feathers have real volume.
  if (group(h,box(p-vec3(-0.54,2.53,0),vec3(1.31,0.61,0.75)))) {
    q = vec3(p.xy,abs(p.z));
    float d = taper(q,vec3(-0.88,2.72,0.31),vec3(-0.26,2.47,0.48),0.22,0.15);
    d = smin(d,taper(q,vec3(-0.26,2.47,0.48),vec3(0.53,2.23,0.54),0.15,0.061),0.10);
    hit(h,d,1.0);
    for (int i=0;i<3;i++) {
      float f = float(i);
      hit(h,taper(q,
        vec3(-0.38+0.10*f,2.47-0.060*f,0.600+0.016*f),
        vec3(0.56-0.060*f,2.23-0.046*f,0.580+0.016*f),
        0.075-0.008*f,0.027),13.0);
      hit(h,taper(q,
        vec3(-0.85+0.10*f,2.70-0.065*f,0.49+0.025*f),
        vec3(-0.24+0.08*f,2.47-0.060*f,0.61+0.012*f),
        0.082-0.008*f,0.040),17.0);
      hit(h,taper(q,
        vec3(-1.14,2.41,0.10*f),
        vec3(-1.69+0.060*f,2.22+0.025*f,0.09*f),
        0.115-0.020*f,0.022),1.0);
      hit(h,taper(q,
        vec3(-1.49+0.05*f,2.29+0.025*f,0.09*f),
        vec3(-1.73+0.06*f,2.19+0.025*f,0.09*f),
        0.052-0.008*f,0.014),13.0);
    }
    hit(h,cap(q,vec3(0.54,2.25,0.55),vec3(0.51,2.18,0.55),0.038),13.0);
  }

  // Long upper bill, deep gular pouch, mouth seam, and eyes on both sides.
  if (group(h,box(p-vec3(0.75,3.63,0),vec3(1.08,0.58,0.37)))) {
    q = vec3(p.x,(p.y-3.60)*1.9,p.z);
    float d = taper(q,vec3(0.62,0,0),vec3(1.86,-0.19,0),0.18,0.025)/1.9;
    hit(h,d,6.0);
    hit(h,taper(p,vec3(1.84,3.50,0),vec3(1.89,3.46,0),0.030,0.014),6.0);
    q = vec3(p.xy,p.z*1.45);
    d = taper(q,vec3(0.77,3.42,0),vec3(1.84,3.49,0),0.225,0.018)/1.45;
    d = max(d,p.y-(3.57-0.075*(p.x-0.65)));
    hit(h,d,7.0);

    q = vec3(p.xy,abs(p.z));
    d = cap(q,vec3(0.68,3.555,0.156),vec3(1.16,3.519,0.105),0.008);
    d = min(d,cap(q,vec3(1.16,3.519,0.105),vec3(1.81,3.475,0.026),0.007));
    hit(h,d,8.0);
    hit(h,cap(q,vec3(0.81,3.621,0.137),vec3(0.875,3.613,0.127),0.010),8.0);

    hit(h,ell(q-vec3(0.47,3.76,0.245),vec3(0.093,0.096,0.036)),10.0);
    hit(h,ell(q-vec3(0.493,3.774,0.274),vec3(0.048,0.055,0.025)),9.0);
    hit(h,length(q-vec3(0.506,3.796,0.295))-0.013,16.0);
    hit(h,length(q-vec3(0.476,3.761,0.298))-0.005,16.0);
    hit(h,taper(q,vec3(0.377,3.857,0.221),vec3(0.508,3.874,0.211),0.033,0.024),1.0);

    hit(h,taper(p,vec3(0.27,3.935,0),vec3(-0.10,4.065,0),0.064,0.011),1.0);
    hit(h,taper(q,vec3(0.20,3.935,0.083),vec3(-0.15,4.014,0.084),0.049,0.010),17.0);
  }

  // Chain drive, rotating cranks, pedals, and articulated webbed feet.
  if (group(h,box(p-vec3(-0.25,1.36,0),vec3(1.12,0.85,0.60)))) {
    vec3 bb = vec3(-0.12,0.84,0);
    hit(h,cylz(p-bb,0.060,0.29),4.0);

    q = p-vec3(-0.12,0.84,0.19);
    hit(h,torz(q,0.184,0.018),4.0);
    hit(h,cylz(q,0.052,0.031),4.0);
    vec2 c = uCrank/0.275;
    q.xy = mat2(c.x,-c.y,c.y,c.x)*q.xy;
    hit(h,roundBox(q,vec3(0.172,0.012,0.013),0.006),4.0);
    hit(h,roundBox(q,vec3(0.012,0.172,0.013),0.006),4.0);

    float chain = taper(vec3(p.xy,0),vec3(-1.20,0.75,0),
                        vec3(-0.12,0.84,0),0.078,0.202);
    hit(h,length(vec2(chain,p.z-0.19))-0.011,12.0);
    hit(h,torz(p-vec3(-1.20,0.75,0.19),0.067,0.013),4.0);

    for (int i=0;i<2;i++) {
      float s = i==0 ? 1.0 : -1.0;
      vec2 end = vec2(-0.12,0.84)+s*uCrank;
      vec3 knee = i==0 ? uKneeR : uKneeL;
      vec3 ankle = i==0 ? uAnkleR : uAnkleL;
      vec3 hip = vec3(-0.55,2.06,0.25*s);

      hit(h,cap(p,vec3(-0.12,0.84,0.25*s),vec3(end,0.25*s),0.028),4.0);
      hit(h,cap(p,vec3(end,0.25*s),vec3(end,0.51*s),0.021),4.0);
      hit(h,roundBox(p-vec3(end,0.40*s),vec3(0.118,0.022,0.132),0.009),2.0);
      hit(h,roundBox(p-vec3(end.x,end.y,0.544*s),vec3(0.080,0.013,0.006),0.004),10.0);

      hit(h,taper(p,hip,knee,0.077,0.054),11.0);
      hit(h,taper(p,knee,ankle,0.054,0.045),11.0);
      hit(h,ell(p-vec3(-0.52,2.01,0.27*s),vec3(0.145,0.17,0.139)),1.0);
      hit(h,cap(p,ankle,vec3(end.x-0.025,end.y+0.085,0.40*s),0.047),11.0);
      hit(h,ell(p-vec3(end.x+0.043,end.y+0.076,0.40*s),
                vec3(0.178,0.052,0.129)),11.0);
      for (int j=0;j<3;j++) {
        float z = (0.31+0.09*float(j))*s;
        hit(h,ell(p-vec3(end.x+0.179,end.y+0.060,z),
                  vec3(0.055,0.024,0.028)),11.0);
      }
    }
  }
  return h;
}

vec2 interval(vec3 ro, vec3 rd) {
  vec3 inv = 1.0/(rd+vec3(0.0000001));
  vec3 a = (vec3(-2.08,-0.13,-0.80)-ro)*inv;
  vec3 b = (vec3( 2.08, 4.23, 0.80)-ro)*inv;
  vec3 lo = min(a,b), hi = max(a,b);
  return vec2(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));
}
vec3 normalAt(vec3 p, float e) {
  vec2 k = vec2(1.0,-1.0);
  vec3 n = k.xyy*scene(p+k.xyy*e).x+
           k.yyx*scene(p+k.yyx*e).x+
           k.yxy*scene(p+k.yxy*e).x+
           k.xxx*scene(p+k.xxx*e).x;
  return normalize(n+vec3(1e-9));
}
float shadowAt(vec3 p) {
  vec2 bound = interval(p,LIGHT);
  if (bound.y < max(bound.x,0.0)) return 1.0;
  float t = max(0.025,bound.x);
  float end = min(bound.y,7.0);
  float shade = 1.0;
  for (int i=0;i<28;i++) {
    if (t > end) break;
    vec2 h = scene(p+LIGHT*t);
    if (h.y > 0.5) {
      if (h.x < 0.001) return 0.0;
      shade = min(shade,9.0*h.x/t);
    }
    t += clamp(h.x,0.022,0.34);
  }
  return clamp(shade,0.0,1.0);
}
float ambientOcclusion(vec3 p, vec3 n) {
  float occ = 0.0;
  occ += max(0.0,0.035-scene(p+n*0.035).x);
  occ += max(0.0,0.100-scene(p+n*0.100).x)*0.55;
  occ += max(0.0,0.220-scene(p+n*0.220).x)*0.25;
  return clamp(1.0-3.0*occ,0.36,1.0);
}

void material(float id, vec3 p, out vec3 albedo, out float rough, out float metal) {
  albedo = vec3(0.92,0.875,0.735);
  rough = 0.67;
  metal = 0.0;
  if (id==2.0) {
    albedo=vec3(0.023,0.031,0.035); rough=0.83;
    float a=atan(p.y-0.75,abs(p.x)-1.20);
    albedo*=0.90+0.10*smoothstep(0.5,0.9,sin(a*90.0+uSpin*90.0*sign(p.x)+p.z*85.0));
  } else if (id==3.0) {
    albedo=vec3(0.73,0.61,0.40); rough=0.76;
  } else if (id==4.0) {
    albedo=vec3(0.66,0.73,0.74); rough=0.24; metal=0.87;
  } else if (id==5.0) {
    albedo=vec3(0.024,0.285,0.265); rough=0.27; metal=0.32;
    if (p.x>0.10 && p.x<0.18 && p.y>1.65 && p.y<1.79)
      albedo=vec3(0.86,0.72,0.40);
  } else if (id==6.0) {
    albedo=mix(vec3(0.98,0.67,0.17),vec3(0.90,0.30,0.065),smoothstep(1.65,1.94,p.x));
    rough=0.39;
  } else if (id==7.0) {
    albedo=mix(vec3(0.93,0.37,0.075),vec3(0.99,0.63,0.20),smoothstep(3.19,3.56,p.y));
    float folds=sin(atan(p.z,p.y-3.57)*19.0+p.x*2.0);
    albedo*=0.95+0.05*folds; rough=0.57;
  } else if (id==8.0) {
    albedo=vec3(0.24,0.083,0.038); rough=0.54;
  } else if (id==9.0) {
    albedo=vec3(0.007,0.013,0.017); rough=0.13;
  } else if (id==10.0) {
    albedo=vec3(0.86,0.49,0.12); rough=0.31; metal=0.36;
  } else if (id==11.0) {
    albedo=vec3(0.88,0.365,0.075); rough=0.58;
    albedo*=0.96+0.04*sin(p.y*110.0+p.z*28.0);
  } else if (id==12.0) {
    albedo=vec3(0.15,0.19,0.20); rough=0.34; metal=0.75;
    albedo*=0.82+0.18*sin(p.x*130.0+uSpin*6.0);
  } else if (id==13.0) {
    albedo=vec3(0.105,0.16,0.19); rough=0.69;
  } else if (id==14.0) {
    albedo=vec3(0.70,0.057,0.037); rough=0.65;
    if (p.y>2.8) albedo=mix(albedo,vec3(0.91,0.82,0.64),
      0.85*smoothstep(0.91,0.98,sin(p.y*68.0+p.x*14.0)));
  } else if (id==15.0) {
    albedo=vec3(0.99,0.85,0.51); rough=0.15;
  } else if (id==16.0) {
    albedo=vec3(1.0); rough=0.12;
  } else if (id==17.0) {
    albedo=vec3(0.78,0.805,0.75); rough=0.70;
  }
  if (id==1.0 || id==17.0)
    albedo*=0.989+0.011*sin(p.x*171.0)*sin(p.y*153.0)*sin(p.z*167.0);
}

vec3 environment(vec3 r) {
  vec3 c=mix(vec3(0.35,0.27,0.18),vec3(0.48,0.70,0.75),smoothstep(-0.3,0.5,r.y));
  float softbox=pow(max(dot(r,normalize(vec3(-0.5,0.8,0.6))),0.0),28.0);
  c+=vec3(1.7,1.55,1.3)*softbox;
  c+=vec3(0.55,0.68,0.75)*pow(max(dot(r,normalize(vec3(0.7,0.3,-0.6))),0.0),16.0);
  return c;
}
vec3 shade(vec3 p, vec3 rd, float id, float t) {
  vec3 n=normalAt(p,max(0.00055,t*0.000065));
  if (dot(n,rd)>0.0) n=-n;
  vec3 albedo;
  float rough,metal;
  material(id,p,albedo,rough,metal);
  vec3 v=-rd;
  float ao=ambientOcclusion(p,n);
  float sh=shadowAt(p+n*0.006);
  float nl=max(dot(n,LIGHT),0.0);
  vec3 ambient=mix(vec3(0.30,0.235,0.16),vec3(0.39,0.52,0.56),n.y*0.5+0.5);
  float fill=max(dot(n,normalize(vec3(0.65,0.25,-0.72))),0.0);
  vec3 diffuse=albedo*(ambient*ao+vec3(1.22,1.10,0.88)*nl*sh+vec3(0.15,0.20,0.23)*fill*ao);
  vec3 reflected=environment(reflect(rd,n))*albedo*ao;
  vec3 col=mix(diffuse,reflected,metal);

  vec3 hv=normalize(LIGHT+v);
  float spec=pow(max(dot(n,hv),0.0),mix(155.0,16.0,rough));
  vec3 f0=mix(vec3(0.055),albedo,metal);
  float fresnel=pow(1.0-max(dot(n,v),0.0),5.0);
  col+=(f0+(1.0-f0)*fresnel)*spec*3.0*sh*nl;
  col+=vec3(0.18,0.25,0.28)*pow(1.0-max(dot(n,v),0.0),3.0)*fill*ao;
  if (id==6.0 || id==7.0 || id==11.0)
    col+=albedo*0.13*pow(max(dot(-n,LIGHT),0.0),2.0);
  if (id==15.0) col+=albedo*0.16;
  if (id==16.0) col+=vec3(0.30);
  return col;
}
vec3 film(vec3 x) {
  x=max(x,0.0);
  x=(x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14);
  return pow(clamp(x,0.0,1.0),vec3(0.454545));
}
void main() {
  float small=min(uSize.x,uSize.y);
  vec2 uv=(2.0*gl_FragCoord.xy-uSize)/small;
  vec3 rd=normalize(uForward+0.39*(uv.x*uRight+uv.y*uUp));
  vec3 ro=uEye;
  vec3 background=mix(vec3(0.64,0.74,0.71),vec3(0.24,0.43,0.49),
                      clamp(0.40+rd.y*0.65,0.0,1.0));
  vec3 col=background;

  float ground=10000.0;
  if (ro.y>-0.024 && rd.y<-0.00001) ground=(-0.025-ro.y)/rd.y;
  vec2 span=interval(ro,rd);
  float t=max(span.x,0.001);
  float end=min(span.y,ground);
  float id=0.0;
  float footprint=0.78/small;
  if (end>t) {
    for (int i=0;i<124;i++) {
      vec2 h=scene(ro+rd*t);
      float eps=max(0.00045,t*footprint*0.30);
      if (abs(h.x)<eps && h.y>0.5) { id=h.y; break; }
      t+=max(abs(h.x)*0.84,eps*0.5);
      if (t>end) break;
    }
  }
  if (id>0.5) {
    col=shade(ro+rd*t,rd,id,t);
  } else if (ground<10000.0) {
    vec3 p=ro+rd*ground;
    float r=length(p.xz);
    vec3 base=mix(vec3(0.48,0.63,0.64),vec3(0.77,0.70,0.57),exp(-0.047*r*r));
    float width=max(0.005,ground*footprint*0.65);
    float ring=1.0-smoothstep(0.006,0.006+width,abs(r-2.35));
    base*=1.0-ring*0.105;
    float sh=shadowAt(p+vec3(0,0.006,0));
    float contact=max(exp(-25.0*(p.x-1.2)*(p.x-1.2)-45.0*p.z*p.z),
                      exp(-25.0*(p.x+1.2)*(p.x+1.2)-45.0*p.z*p.z));
    col=base*(0.53+0.47*sh)*(1.0-0.18*contact);
    col=mix(col,background,1.0-exp(-0.025*max(ground-9.0,0.0)));
  }
  float vignette=1.0-0.055*min(dot(uv,uv)*0.20,1.0);
  outColor=vec4(film(col*vignette),1.0);
}`;

  let resources = null;
  let lost = gl.isContextLost();
  let disposed = false;

  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to allocate a pelican shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "No compiler log.";
      gl.deleteShader(shader);
      throw new Error("Pelican SDF shader compilation failed:\n" + log);
    }
    return shader;
  }

  function initialize() {
    let vs = null, fs = null, program = null, vao = null;
    try {
      vs = compile(gl.VERTEX_SHADER, vertexSource);
      fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      if (!program) throw new Error("Unable to allocate the pelican shader program.");
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error("Pelican SDF shader linking failed:\n" + (gl.getProgramInfoLog(program) || "No linker log."));
      }
      vao = gl.createVertexArray();
      if (!vao) throw new Error("Unable to allocate the pelican vertex array.");
      const uniforms = {};
      for (const name of [
        "uSize", "uEye", "uRight", "uUp", "uForward", "uCrank",
        "uKneeR", "uKneeL", "uAnkleR", "uAnkleL", "uSpin", "uFlutter"
      ]) uniforms[name] = gl.getUniformLocation(program, name);
      resources = { program, vao, uniforms };
      lost = false;
    } catch (error) {
      if (vao) gl.deleteVertexArray(vao);
      if (program) gl.deleteProgram(program);
      throw error;
    } finally {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
    }
  }

  if (!lost) {
    try {
      initialize();
    } catch (error) {
      if (!gl.isContextLost()) throw error;
      lost = true;
    }
  }

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const TAU = Math.PI * 2;
  let yaw = 0.46, pitch = 0.17, distance = 7.5;
  const target = [0, 2.04, 0];
  const eye = new Float32Array(3);
  const right = new Float32Array(3);
  const up = new Float32Array(3);
  const forward = new Float32Array(3);
  const kneeR = new Float32Array(3), kneeL = new Float32Array(3);
  const ankleR = new Float32Array(3), ankleL = new Float32Array(3);

  function basis() {
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    right[0] = cy; right[1] = 0; right[2] = -sy;
    up[0] = -sy * sp; up[1] = cp; up[2] = -cy * sp;
    forward[0] = -sy * cp; forward[1] = -sp; forward[2] = -cy * cp;
    for (let i = 0; i < 3; i++) eye[i] = target[i] - forward[i] * distance;
  }

  function setView(newYaw, newPitch, newDistance) {
    if (disposed) return;
    if (![newYaw, newPitch, newDistance].every(Number.isFinite))
      throw new TypeError("setView requires finite yaw, pitch, and distance.");
    yaw = newYaw % TAU;
    pitch = clamp(newPitch, -1.48, 1.48);
    distance = clamp(newDistance, 0.65, 24);
    target[0] = 0; target[1] = 2.04; target[2] = 0;
  }

  function leg(dx, dy, side, knee, ankle) {
    const ax = -0.19 + side * dx;
    const ay = 0.98 + side * dy;
    const vx = ax + 0.55, vy = ay - 2.06;
    const len = Math.hypot(vx, vy);
    const bend = Math.sqrt(Math.max(0, 0.77 * 0.77 - len * len * 0.25));
    knee[0] = (-0.55 + ax) * 0.5 - vy * bend / len;
    knee[1] = (2.06 + ay) * 0.5 + vx * bend / len;
    knee[2] = 0.42 * side;
    ankle[0] = ax; ankle[1] = ay; ankle[2] = 0.40 * side;
  }

  function render(timeSeconds) {
    if (disposed || lost || !resources || gl.isContextLost()) return;
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    if (width < 1 || height < 1) return;
    const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const angle = (time * 0.95 + 0.55) % TAU;
    const dx = 0.275 * Math.cos(angle), dy = 0.275 * Math.sin(angle);
    leg(dx, dy, 1, kneeR, ankleR);
    leg(dx, dy, -1, kneeL, ankleL);
    basis();

    const { program, vao, uniforms: u } = resources;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.colorMask(true, true, true, true);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(u.uSize, width, height);
    gl.uniform3fv(u.uEye, eye);
    gl.uniform3fv(u.uRight, right);
    gl.uniform3fv(u.uUp, up);
    gl.uniform3fv(u.uForward, forward);
    gl.uniform2f(u.uCrank, dx, dy);
    gl.uniform3fv(u.uKneeR, kneeR);
    gl.uniform3fv(u.uKneeL, kneeL);
    gl.uniform3fv(u.uAnkleR, ankleR);
    gl.uniform3fv(u.uAnkleL, ankleL);
    gl.uniform1f(u.uSpin, (time * 1.45) % TAU);
    gl.uniform1f(u.uFlutter, Math.sin(time * 2.2));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  const saved = {
    tabindex: canvas.getAttribute("tabindex"),
    label: canvas.getAttribute("aria-label"),
    title: canvas.getAttribute("title"),
    touchAction: canvas.style.touchAction,
    cursor: canvas.style.cursor
  };
  if (canvas.tabIndex < 0) canvas.tabIndex = 0;
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";
  canvas.setAttribute("aria-label", "Interactive 3D pelican riding a bicycle");
  canvas.setAttribute("title", "Drag: orbit. Wheel or pinch: zoom at pointer. Shift-drag or right-drag: pan. Arrows: orbit. + / -: zoom. Double-click or Home: reset.");

  const listeners = [];
  const pointers = new Map();

  function listen(name, fn, options) {
    canvas.addEventListener(name, fn, options);
    listeners.push([name, fn, options]);
  }

  function pan(dx, dy) {
    basis();
    const r = canvas.getBoundingClientRect();
    const size = Math.max(1, Math.min(r.width || canvas.width, r.height || canvas.height));
    const scale = 0.78 * distance / size;
    for (let i = 0; i < 3; i++) target[i] += (-right[i] * dx + up[i] * dy) * scale;
  }

  function zoom(factor, clientX, clientY) {
    basis();
    const next = clamp(distance * factor, 0.65, 24);
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      const r = canvas.getBoundingClientRect();
      const size = Math.max(1, Math.min(r.width || canvas.width, r.height || canvas.height));
      const x = (2 * (clientX - r.left) - r.width) / size;
      const y = (r.height - 2 * (clientY - r.top)) / size;
      const shift = 0.39 * (distance - next);
      for (let i = 0; i < 3; i++) target[i] += (right[i] * x + up[i] * y) * shift;
    }
    distance = next;
  }

  listen("pointerdown", event => {
    if (disposed || event.button > 2) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    pointers.set(event.pointerId, {
      x: event.clientX, y: event.clientY,
      pan: event.button !== 0 || event.shiftKey
    });
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    canvas.style.cursor = "grabbing";
  }, { passive: false });

  listen("pointermove", event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer || disposed) return;
    event.preventDefault();

    if (pointers.size >= 2) {
      const pair = Array.from(pointers.values()).slice(0, 2);
      const oldX = (pair[0].x + pair[1].x) * 0.5;
      const oldY = (pair[0].y + pair[1].y) * 0.5;
      const oldSpan = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const newX = (pair[0].x + pair[1].x) * 0.5;
      const newY = (pair[0].y + pair[1].y) * 0.5;
      const newSpan = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      pan(newX - oldX, newY - oldY);
      if (oldSpan > 1 && newSpan > 1) zoom(oldSpan / newSpan, newX, newY);
    } else {
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (pointer.pan || event.shiftKey) {
        pan(dx, dy);
      } else {
        yaw = (yaw - dx * 0.007) % TAU;
        pitch = clamp(pitch + dy * 0.006, -1.48, 1.48);
      }
    }
  }, { passive: false });

  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    } catch (_) {}
    canvas.style.cursor = pointers.size ? "grabbing" : "grab";
    if (event.cancelable) event.preventDefault();
  }
  listen("pointerup", endPointer);
  listen("pointercancel", endPointer);
  listen("lostpointercapture", endPointer);

  listen("wheel", event => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(1, rect.height) : 1;
    zoom(Math.exp(clamp(event.deltaY * unit * 0.0012, -1, 1)), event.clientX, event.clientY);
  }, { passive: false });

  listen("keydown", event => {
    let handled = true;
    const step = event.shiftKey ? 0.15 : 0.075;
    switch (event.key) {
      case "ArrowLeft": yaw -= step; break;
      case "ArrowRight": yaw += step; break;
      case "ArrowUp": pitch = clamp(pitch + step, -1.48, 1.48); break;
      case "ArrowDown": pitch = clamp(pitch - step, -1.48, 1.48); break;
      case "+": case "=": zoom(0.88); break;
      case "-": case "_": zoom(1 / 0.88); break;
      case "Home": setView(0.46, 0.17, 7.5); break;
      default: handled = false;
    }
    if (handled) {
      yaw %= TAU;
      event.preventDefault();
    }
  });
  listen("contextmenu", event => event.preventDefault());
  listen("dblclick", event => {
    event.preventDefault();
    setView(0.46, 0.17, 7.5);
  });
  listen("webglcontextlost", event => {
    event.preventDefault();
    lost = true;
    resources = null;
  });
  listen("webglcontextrestored", () => {
    if (disposed) return;
    try { initialize(); } catch (_) { lost = true; }
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const [name, fn, options] of listeners) canvas.removeEventListener(name, fn, options);
    listeners.length = 0;
    for (const id of pointers.keys()) {
      try {
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      } catch (_) {}
    }
    pointers.clear();
    if (resources && !gl.isContextLost()) {
      gl.deleteVertexArray(resources.vao);
      gl.deleteProgram(resources.program);
    }
    resources = null;
    canvas.style.touchAction = saved.touchAction;
    canvas.style.cursor = saved.cursor;
    for (const [name, value] of [
      ["tabindex", saved.tabindex],
      ["aria-label", saved.label],
      ["title", saved.title]
    ]) {
      if (value === null) canvas.removeAttribute(name);
      else canvas.setAttribute(name, value);
    }
  }

  return {
    render,
    setView,
    getView() { return { yaw, pitch, distance }; },
    dispose
  };
}
