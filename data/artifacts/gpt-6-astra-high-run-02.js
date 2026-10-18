export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance"
  });
  if (!gl) throw new Error("The pelican artwork requires WebGL2.");

  const vertexSource = `#version 300 es
  precision highp float;
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  precision highp int;
  out vec4 outColor;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uFocal;
  uniform vec3 uEye;
  uniform mat3 uBasis;

  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;
  const vec3 BB = vec3(-0.28, 0.68, 0.0);
  const vec3 SJ = vec3(-0.55, 1.42, 0.0);
  const vec3 HT = vec3(0.77, 1.43, 0.0);
  const vec3 HB = vec3(0.86, 1.16, 0.0);
  vec3 pedalR, pedalL, kneeR, kneeL;
  float phase;

  vec2 rotate2(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c*p.x-s*p.y, s*p.x+c*p.y);
  }
  float box3(vec3 p, vec3 b) {
    vec3 q = abs(p)-b;
    return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
  }
  float box2(vec2 p, vec2 b) {
    vec2 q = abs(p)-b;
    return length(max(q,0.0))+min(max(q.x,q.y),0.0);
  }
  float ell(vec3 p, vec3 r) {
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0 < 0.00001 ? -min(r.x,min(r.y,r.z)) : k0*(k0-1.0)/k1;
  }
  float seg(vec3 p, vec3 a, vec3 b, float r) {
    vec3 v = b-a, q = p-a;
    return length(q-v*clamp(dot(q,v)/dot(v,v),0.0,1.0))-r;
  }
  float taper(vec3 p, vec3 a, vec3 b, float r0, float r1) {
    vec3 v = b-a, q = p-a;
    float h = clamp(dot(q,v)/dot(v,v),0.0,1.0);
    return (length(q-v*h)-mix(r0,r1,h))*0.93;
  }
  float tor(vec3 p, float r, float thickness) {
    return length(vec2(length(p.xy)-r,p.z))-thickness;
  }
  float cylinderZ(vec3 p, float r, float h) {
    vec2 d = vec2(length(p.xy)-r,abs(p.z)-h);
    return min(max(d.x,d.y),0.0)+length(max(d,0.0));
  }
  float smoothMin(float a, float b, float k) {
    float h = clamp(0.5+0.5*(b-a)/k,0.0,1.0);
    return mix(b,a,h)-k*h*(1.0-h);
  }
  vec2 put(vec2 a, float d, float material) {
    return d<a.x ? vec2(d,material) : a;
  }
  vec3 wheelLocal(vec3 p) {
    return p-vec3(p.x<0.0 ? -1.14 : 1.14,0.68,0.0);
  }

  vec2 wheels(vec3 p) {
    vec3 q = wheelLocal(p);
    float r = length(q.xy);
    vec2 result = vec2(tor(q,0.610,0.066),2.0);
    result = put(result,tor(vec3(q.xy,abs(q.z)-0.049),0.606,0.023),4.0);
    result = put(result,tor(q,0.545,0.025),3.0);
    result = put(result,tor(q,0.570,0.012),2.0);

    float a = atan(q.y,q.x)-phase*2.2;
    a = mod(a+PI/16.0,TAU/16.0)-PI/16.0;
    vec3 spoke = vec3(r*cos(a),r*sin(a),abs(q.z));
    result = put(result,seg(spoke,vec3(0.065,0.0,0.054),
                           vec3(0.540,0.0,0.0),0.0085),3.0);
    result = put(result,cylinderZ(q,0.071,0.095),3.0);
    result = put(result,cylinderZ(q,0.036,0.119),13.0);

    float guard = box2(vec2(r-0.716,q.z),vec2(0.012,0.071))-0.009;
    guard = max(guard,-q.y-0.025);
    result = put(result,guard,1.0);
    return result;
  }

  vec2 bicycle(vec3 p) {
    float d = seg(p,BB,SJ,0.043);
    d = min(d,seg(p,SJ,HT,0.041));
    d = min(d,seg(p,BB,HB,0.049));
    d = min(d,seg(p,HB,HT,0.059));
    vec3 q = vec3(p.xy,abs(p.z));
    d = min(d,seg(q,vec3(-0.28,0.68,0.095),vec3(-1.14,0.68,0.105),0.027));
    d = min(d,seg(q,vec3(-0.55,1.42,0.035),vec3(-1.14,0.68,0.105),0.026));
    d = min(d,seg(q,vec3(0.86,1.16,0.054),vec3(1.14,0.68,0.115),0.033));
    vec2 result = vec2(d,1.0);

    result = put(result,seg(p,vec3(-0.55,1.40,0.0),vec3(-0.61,1.60,0.0),0.031),3.0);
    result = put(result,ell(p-vec3(-0.64,1.60,0.0),vec3(0.235,0.068,0.158)),5.0);
    result = put(result,ell(p-vec3(-0.43,1.59,0.0),vec3(0.135,0.044,0.069)),5.0);
    result = put(result,seg(p,vec3(-0.77,1.55,0.09),vec3(-0.44,1.54,0.06),0.014),3.0);
    result = put(result,seg(p,vec3(-0.77,1.55,-0.09),vec3(-0.44,1.54,-0.06),0.014),3.0);

    result = put(result,seg(p,vec3(0.80,1.35,0.0),vec3(0.64,1.83,0.0),0.029),3.0);
    result = put(result,seg(p,vec3(0.64,1.83,0.0),vec3(0.75,1.91,0.0),0.030),3.0);
    result = put(result,seg(p,vec3(0.75,1.91,-0.31),vec3(0.75,1.91,0.31),0.025),3.0);
    result = put(result,seg(q,vec3(0.75,1.91,0.29),vec3(0.62,1.98,0.47),0.039),5.0);
    result = put(result,seg(q,vec3(0.71,1.89,0.32),vec3(0.58,1.84,0.45),0.014),3.0);
    result = put(result,seg(q,vec3(0.66,1.86,0.34),vec3(0.96,1.67,0.17),0.009),2.0);
    result = put(result,seg(q,vec3(0.96,1.67,0.17),vec3(0.99,1.28,0.10),0.009),2.0);
    result = put(result,ell(p-vec3(0.75,1.972,0.20),vec3(0.066,0.042,0.066)),13.0);
    result = put(result,seg(p,vec3(0.78,1.975,0.24),vec3(0.81,1.989,0.27),0.012),3.0);

    result = put(result,seg(p,vec3(0.83,1.39,0.0),vec3(1.01,1.43,0.0),0.023),3.0);
    result = put(result,ell(p-vec3(1.01,1.43,0.0),vec3(0.115,0.088,0.088)),3.0);
    vec3 lamp = p-vec3(1.105,1.43,0.0);
    result = put(result,cylinderZ(lamp.yzx,0.065,0.014),15.0);

    float chain = taper(vec3(p.xy,0.0),vec3(-1.14,0.68,0.0),
                        vec3(-0.28,0.68,0.0),0.082,0.202)/0.93;
    result = put(result,length(vec2(chain,p.z-0.185))-0.013,14.0);
    result = put(result,tor(p-vec3(-1.14,0.68,0.185),0.076,0.016),13.0);
    return result;
  }

  vec2 torso(vec3 p) {
    vec3 body = p-vec3(-0.49,2.12,0.0);
    body.xy = rotate2(body.xy,0.18);
    float d = ell(body,vec3(0.59,0.64,0.39));
    d = smoothMin(d,taper(p,vec3(-0.13,2.36,0.0),vec3(0.14,2.73,0.0),0.28,0.155),0.16);
    d = smoothMin(d,taper(p,vec3(0.14,2.70,0.0),vec3(0.12,2.97,0.0),0.155,0.175),0.13);
    vec2 result = vec2(d,6.0);

    vec3 q = vec3(p.xy,abs(p.z));
    vec3 wing = q-vec3(-0.43,2.25,0.34);
    wing.xy = rotate2(wing.xy,0.42);
    float wd = ell(wing,vec3(0.46,0.25,0.125));
    wd = smoothMin(wd,taper(q,vec3(-0.18,2.04,0.40),
                           vec3(0.59,1.97,0.43),0.123,0.054),0.09);
    result = put(result,wd,16.0);
    for (int i=0;i<3;i++) {
      float f = float(i);
      vec3 feather = q-vec3(-0.55+f*0.086,2.235-f*0.055,0.442+f*0.012);
      feather.xy = rotate2(feather.xy,0.42);
      result = put(result,ell(feather,vec3(0.30,0.093,0.039)),6.0);
    }
    for (int i=0;i<2;i++) {
      float z = 0.423+float(i)*0.047;
      result = put(result,taper(q,vec3(0.47,1.988,z),
                               vec3(0.65,1.933,z+0.005),0.036,0.019),6.0);
    }
    for (int i=0;i<3;i++) {
      float z = float(i-1)*0.125;
      vec3 tail = p-vec3(-1.045,1.995,z);
      tail.xy = rotate2(tail.xy,0.50);
      result = put(result,ell(tail,vec3(0.375,0.097,0.079)),6.0);
      vec3 tip = p-vec3(-1.30,2.135,z);
      tip.xy = rotate2(tip.xy,0.50);
      result = put(result,ell(tip,vec3(0.115,0.069,0.070)),7.0);
    }
    return result;
  }

  vec2 head(vec3 p) {
    float d = ell(p-vec3(0.28,3.10,0.0),vec3(0.31,0.34,0.27));
    d = smoothMin(d,ell(p-vec3(0.36,2.955,0.0),vec3(0.23,0.18,0.237)),0.09);
    d = min(d,taper(p,vec3(0.11,3.35,0.0),vec3(-0.075,3.51,0.0),0.057,0.018));
    d = min(d,taper(p,vec3(0.06,3.34,0.025),vec3(-0.19,3.435,0.035),0.044,0.015));
    d = min(d,taper(p,vec3(0.18,3.37,-0.025),vec3(0.04,3.535,-0.027),0.040,0.012));
    vec2 result = vec2(d,6.0);
    vec3 q = vec3(p.xy,abs(p.z));
    result = put(result,ell(q-vec3(0.435,3.17,0.235),vec3(0.082,0.089,0.036)),8.0);
    result = put(result,length(q-vec3(0.445,3.176,0.258))-0.057,6.0);
    result = put(result,length(q-vec3(0.464,3.177,0.302))-0.032,11.0);
    result = put(result,length(q-vec3(0.470,3.190,0.327))-0.009,12.0);
    result = put(result,seg(q,vec3(0.374,3.247,0.235),
                           vec3(0.463,3.258,0.241),0.023),6.0);
    return result;
  }

  vec2 bill(vec3 p) {
    vec3 q = p-vec3(1.15,2.99,0.0);
    q.xy = rotate2(q.xy,0.12);
    float h = clamp((q.x+0.69)/1.38,0.0,1.0);
    float width = mix(0.171,0.013,h);
    float d = (box3(q,vec3(0.69,0.045,width))-0.017)*0.97;
    vec2 result = vec2(d,8.0);

    vec3 pouch = p-vec3(1.055,2.855,0.0);
    pouch.xy = rotate2(pouch.xy,0.12);
    float pd = ell(pouch,vec3(0.645,0.205,0.182));
    pd = max(pd,q.y+0.052);
    result = put(result,pd,9.0);
    float seam = box3(q+vec3(0.0,0.048,0.0),
                     vec3(0.685,0.005,max(width-0.005,0.008)))-0.010;
    result = put(result,seam,10.0);
    result = put(result,taper(p,vec3(1.824,2.906,0.0),
                             vec3(1.844,2.858,0.0),0.025,0.012),8.0);
    vec3 nostril = vec3(p.xy,abs(p.z))-vec3(0.663,3.075,0.164);
    result = put(result,ell(nostril,vec3(0.026,0.008,0.009)),5.0);
    return result;
  }

  vec3 solveKnee(vec3 hip, vec3 ankle) {
    vec2 v = ankle.xy-hip.xy;
    float l = length(v);
    float h = sqrt(max(0.635*0.635-l*l*0.25,0.004));
    return vec3((hip.xy+ankle.xy)*0.5+vec2(-v.y,v.x)*h/max(l,0.001),hip.z);
  }

  vec2 drive(vec3 p) {
    vec3 gear = p-vec3(-0.28,0.68,0.172);
    vec2 result = vec2(tor(gear,0.181,0.020),13.0);
    float a = atan(gear.y,gear.x)-phase;
    a = mod(a+PI/5.0,TAU/5.0)-PI/5.0;
    float r = length(gear.xy);
    result = put(result,seg(vec3(r*cos(a),r*sin(a),gear.z),
                           vec3(0.025,0.0,0.0),vec3(0.171,0.0,0.0),0.014),3.0);
    result = put(result,cylinderZ(p-BB,0.066,0.185),3.0);

    for (int i=0;i<2;i++) {
      float side = i==0 ? 1.0 : -1.0;
      vec3 ped = i==0 ? pedalR : pedalL;
      vec3 knee = i==0 ? kneeR : kneeL;
      vec3 hip = vec3(-0.48,1.66,side*0.265);
      vec3 ankle = ped+vec3(-0.043,0.115,0.0);
      vec3 crankStart = BB+vec3(0.0,0.0,side*0.208);
      vec3 crankEnd = vec3(ped.xy,side*0.208);
      result = put(result,seg(p,crankStart,crankEnd,0.025),3.0);
      result = put(result,seg(p,crankEnd,ped+vec3(0.0,0.0,side*0.072),0.019),3.0);
      result = put(result,box3(p-ped,vec3(0.119,0.023,0.078))-0.012,2.0);
      result = put(result,box3(p-ped-vec3(0.0,0.0,side*0.082),
                              vec3(0.066,0.012,0.006))-0.003,13.0);
      float leg = taper(p,hip,knee,0.073,0.055);
      leg = smoothMin(leg,taper(p,knee,ankle,0.054,0.034),0.033);
      result = put(result,leg,10.0);
      result = put(result,ell(p-ped-vec3(0.035,0.066,0.0),
                             vec3(0.163,0.052,0.094)),10.0);
      for (int j=0;j<3;j++) {
        float z = float(j-1)*0.052;
        result = put(result,taper(p,ped+vec3(0.00,0.070,z*0.45),
                                 ped+vec3(0.165-abs(z)*0.35,0.052,z),
                                 0.029,0.019),8.0);
      }
    }
    return result;
  }

  vec2 mapScene(vec3 p) {
    vec2 result = vec2(100.0,0.0);
    vec3 w = wheelLocal(p);
    float b = box3(w,vec3(0.747,0.747,0.139));
    if (b<result.x) {
      if (b>0.16) result=vec2(b,0.0);
      else result=wheels(p);
    }
    b = box3(p-vec3(-0.015,1.27,0.0),vec3(1.27,0.78,0.53));
    if (b<result.x) {
      if (b>0.16) result=vec2(b,0.0);
      else { vec2 h=bicycle(p); if(h.x<result.x) result=h; }
    }
    b = box3(p-vec3(-0.38,2.30,0.0),vec3(1.13,0.87,0.59));
    if (b<result.x) {
      if (b>0.16) result=vec2(b,0.0);
      else { vec2 h=torso(p); if(h.x<result.x) result=h; }
    }
    b = box3(p-vec3(0.21,3.16,0.0),vec3(0.50,0.43,0.35));
    if (b<result.x) {
      if (b>0.16) result=vec2(b,0.0);
      else { vec2 h=head(p); if(h.x<result.x) result=h; }
    }
    b = box3(p-vec3(1.12,2.94,0.0),vec3(0.78,0.32,0.215));
    if (b<result.x) {
      if (b>0.16) result=vec2(b,0.0);
      else { vec2 h=bill(p); if(h.x<result.x) result=h; }
    }
    b = box3(p-vec3(-0.20,1.05,0.0),vec3(0.80,0.75,0.41));
    if (b<result.x) {
      if (b>0.16) result=vec2(b,0.0);
      else { vec2 h=drive(p); if(h.x<result.x) result=h; }
    }
    return result;
  }

  float shadowScene(vec3 p) {
    vec3 q = p-vec3(-0.49,2.12,0.0);
    q.xy = rotate2(q.xy,0.18);
    float d = ell(q,vec3(0.59,0.64,0.39));
    d = min(d,ell(p-vec3(0.28,3.10,0.0),vec3(0.31,0.34,0.27)));
    d = min(d,taper(p,vec3(-0.13,2.36,0.0),vec3(0.13,2.97,0.0),0.24,0.17));
    q = p-vec3(1.055,2.855,0.0);
    q.xy = rotate2(q.xy,0.12);
    d = min(d,ell(q,vec3(0.645,0.205,0.182)));
    q = p-vec3(1.15,2.99,0.0);
    q.xy = rotate2(q.xy,0.12);
    d = min(d,box3(q,vec3(0.69,0.048,0.11))-0.014);
    d = min(d,tor(wheelLocal(p),0.610,0.066));
    d = min(d,seg(p,BB,SJ,0.043));
    d = min(d,seg(p,SJ,HT,0.041));
    d = min(d,seg(p,BB,HB,0.049));
    vec3 s = vec3(p.xy,abs(p.z));
    d = min(d,taper(s,vec3(-0.35,2.19,0.38),vec3(0.59,1.97,0.43),0.16,0.054));
    d = min(d,seg(p,kneeR,pedalR+vec3(-0.043,0.115,0.0),0.046));
    d = min(d,seg(p,kneeL,pedalL+vec3(-0.043,0.115,0.0),0.046));
    return d;
  }

  float softShadow(vec3 p, vec3 light) {
    float t=0.025, shade=1.0;
    for(int i=0;i<24;i++) {
      vec3 q=p+light*t;
      if(q.y>3.65 || t>5.0) break;
      float d=shadowScene(q);
      shade=min(shade,9.0*d/t);
      if(shade<0.025) return 0.0;
      t+=clamp(d,0.035,0.30);
    }
    return clamp(shade,0.0,1.0);
  }
  vec3 normalAt(vec3 p,float e) {
    vec2 k=vec2(1.0,-1.0);
    return normalize(
      k.xyy*mapScene(p+k.xyy*e).x+
      k.yyx*mapScene(p+k.yyx*e).x+
      k.yxy*mapScene(p+k.yxy*e).x+
      k.xxx*mapScene(p+k.xxx*e).x
    );
  }
  float ambientOcclusion(vec3 p,vec3 n) {
    float sum=0.0,weight=1.0;
    for(int i=0;i<3;i++) {
      float d=0.035+float(i)*0.065;
      sum+=(d-mapScene(p+n*d).x)*weight;
      weight*=0.5;
    }
    return clamp(1.0-3.0*sum,0.42,1.0);
  }

  vec3 surfaceColor(vec3 p,vec3 n,vec3 rd,float id) {
    vec3 base=vec3(0.055,0.36,0.32);
    float rough=0.32,metal=0.12;
    if(id>1.5 && id<2.5) {
      base=vec3(0.028,0.039,0.045); rough=0.78; metal=0.0;
      vec3 q=wheelLocal(p);
      base*=0.93+0.07*sin(atan(q.y,q.x)*92.0+p.z*65.0-phase*202.4);
    } else if(id<3.5 && id>2.5) {
      base=vec3(0.48,0.59,0.61); rough=0.22; metal=0.88;
    } else if(id<4.5 && id>3.5) {
      base=vec3(0.74,0.65,0.46); rough=0.72; metal=0.0;
    } else if(id<5.5 && id>4.5) {
      base=vec3(0.24,0.075,0.039); rough=0.55; metal=0.0;
      base*=0.96+0.04*sin(p.x*170.0)*sin(p.y*137.0+p.z*51.0);
    } else if(id<6.5 && id>5.5) {
      base=vec3(0.88,0.87,0.78); rough=0.67; metal=0.0;
      base*=0.988+0.012*sin(p.x*63.0+p.y*28.0)*sin(p.z*75.0-p.y*11.0);
    } else if(id<7.5 && id>6.5) {
      base=vec3(0.18,0.24,0.28); rough=0.75; metal=0.0;
    } else if(id<8.5 && id>7.5) {
      base=mix(vec3(0.96,0.56,0.105),vec3(0.93,0.32,0.065),clamp((p.x-1.2)*1.3,0.0,1.0));
      rough=0.39; metal=0.0;
    } else if(id<9.5 && id>8.5) {
      base=vec3(0.91,0.40,0.15); rough=0.62; metal=0.0;
      base*=0.95+0.05*cos(p.z*57.0+p.x*3.5);
    } else if(id<10.5 && id>9.5) {
      base=vec3(0.79,0.28,0.075); rough=0.48; metal=0.0;
    } else if(id<11.5 && id>10.5) {
      base=vec3(0.006,0.014,0.021); rough=0.12; metal=0.08;
    } else if(id<12.5 && id>11.5) {
      base=vec3(1.0); rough=0.18; metal=0.0;
    } else if(id<13.5 && id>12.5) {
      base=vec3(0.72,0.43,0.13); rough=0.27; metal=0.73;
    } else if(id<14.5 && id>13.5) {
      float link=step(0.0,sin(p.x*170.0+p.y*140.0+phase*18.0));
      base=mix(vec3(0.10,0.14,0.15),vec3(0.36,0.39,0.32),link);
      rough=0.38; metal=0.72;
    } else if(id<15.5 && id>14.5) {
      base=vec3(1.0,0.87,0.49); rough=0.22; metal=0.1;
    } else if(id>15.5) {
      base=vec3(0.73,0.77,0.73); rough=0.70; metal=0.0;
    }

    vec3 light=normalize(vec3(-0.55,0.92,0.85));
    vec3 fill=normalize(vec3(0.75,0.40,-0.70));
    vec3 view=-rd;
    float ao=ambientOcclusion(p,n);
    float shadow=softShadow(p+n*0.014,light);
    float nl=max(dot(n,light),0.0);
    vec3 ambient=mix(vec3(0.18,0.23,0.27),vec3(0.39,0.44,0.43),n.y*0.5+0.5);
    vec3 illumination=ambient+
      vec3(1.12,0.91,0.67)*nl*shadow+
      vec3(0.21,0.32,0.39)*max(dot(n,fill),0.0);
    vec3 color=base*illumination*ao;
    vec3 halfVector=normalize(light+view);
    float nh=max(dot(n,halfVector),0.0);
    float nv=max(dot(n,view),0.0);
    float exponent=mix(180.0,8.0,rough*rough);
    vec3 f0=mix(vec3(0.045),base,metal);
    vec3 fresnel=f0+(1.0-f0)*pow(1.0-max(dot(view,halfVector),0.0),5.0);
    color+=fresnel*pow(nh,exponent)*(0.7+1.8*(1.0-rough))*nl*shadow;
    color+=metal*base*mix(vec3(0.10,0.18,0.21),vec3(0.65,0.72,0.68),n.y*0.5+0.5)*0.45*ao;
    color+=vec3(0.21,0.31,0.34)*pow(1.0-nv,3.0)*0.24*ao;
    if(id>14.5 && id<15.5) color+=base*0.25;
    if(id>11.5 && id<12.5) color+=0.16;
    return color;
  }

  vec2 rayBox(vec3 ro,vec3 rd) {
    vec3 safe=vec3(rd.x<0.0?-1.0:1.0,rd.y<0.0?-1.0:1.0,rd.z<0.0?-1.0:1.0)
              /max(abs(rd),vec3(0.000001));
    vec3 a=(vec3(-1.91,-0.025,-0.65)-ro)*safe;
    vec3 b=(vec3(1.94,3.62,0.65)-ro)*safe;
    vec3 lo=min(a,b),hi=max(a,b);
    return vec2(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));
  }
  vec3 toneMap(vec3 x) {
    return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);
  }

  void main() {
    phase=uTime*1.15+0.55;
    vec2 crank=0.235*vec2(cos(phase),sin(phase));
    pedalR=vec3(BB.xy+crank,0.29);
    pedalL=vec3(BB.xy-crank,-0.29);
    kneeR=solveKnee(vec3(-0.48,1.66,0.265),pedalR+vec3(-0.043,0.115,0.0));
    kneeL=solveKnee(vec3(-0.48,1.66,-0.265),pedalL+vec3(-0.043,0.115,0.0));

    vec2 uv=(2.0*gl_FragCoord.xy-uResolution)/uResolution.y;
    vec3 rd=normalize(uBasis*vec3(uv,uFocal));
    float sky=clamp(rd.y*0.65+0.46,0.0,1.0);
    vec3 color=mix(vec3(0.76,0.81,0.72),vec3(0.31,0.49,0.56),sky);
    color+=vec3(0.13,0.095,0.035)*pow(max(dot(rd,normalize(vec3(-0.6,0.45,0.65))),0.0),6.0);

    float groundT=1000.0;
    if(rd.y<-0.0001 && uEye.y>-0.035) groundT=(-0.035-uEye.y)/rd.y;
    if(groundT>0.0 && groundT<80.0) {
      vec3 g=uEye+rd*groundT;
      float grain=sin(g.x*93.1+g.z*51.7)*sin(g.z*107.3-g.x*29.4);
      vec3 floorColor=vec3(0.59,0.69,0.64)*(1.0+grain*0.006);
      float shadow=1.0;
      if(length(g.xz-vec2(0.0,-0.25))<4.4) {
        shadow=softShadow(g+vec3(0.0,0.018,0.0),normalize(vec3(-0.55,0.92,0.85)));
        float contact=exp(-pow((abs(g.x)-1.14)/0.22,2.0)-pow(g.z/0.15,2.0));
        shadow*=1.0-contact*0.37;
      }
      floorColor*=0.53+0.47*shadow;
      float fog=1.0-exp(-groundT*0.019);
      color=mix(floorColor,color,fog);
    }

    vec2 bounds=rayBox(uEye,rd);
    float t=max(bounds.x,0.005);
    float endT=min(bounds.y,groundT);
    vec2 hit=vec2(0.0);
    bool found=false;
    if(endT>=t) {
      for(int i=0;i<116;i++) {
        vec3 p=uEye+rd*t;
        hit=mapScene(p);
        float epsilon=max(0.00032,t*0.00018);
        if(hit.x<epsilon) { found=true; break; }
        t+=max(hit.x*0.87,0.00020);
        if(t>endT) break;
      }
    }
    if(found) {
      vec3 p=uEye+rd*t;
      vec3 n=normalAt(p,max(0.00035,t*0.00010));
      color=surfaceColor(p,n,rd,hit.y);
      color=mix(color,vec3(0.60,0.72,0.71),1.0-exp(-t*0.006));
    }
    vec2 screen=gl_FragCoord.xy/uResolution*2.0-1.0;
    color*=1.0-0.045*dot(screen,screen);
    color=pow(toneMap(max(color,0.0)),vec3(1.0/2.2));
    outColor=vec4(color,1.0);
  }`;

  let resources = null;
  let disposed = false;
  let lost = false;
  let lastTime = 0;
  const defaultView = { yaw: 0.46, pitch: 0.14, distance: 5.7 };
  let yaw = defaultView.yaw;
  let pitch = defaultView.pitch;
  let distance = defaultView.distance;
  let target = [0.05, 1.75, 0];
  const pointers = new Map();
  const listeners = [];
  const original = {
    tabindex: canvas.getAttribute("tabindex"),
    title: canvas.getAttribute("title"),
    touchAction: canvas.style.touchAction,
    userSelect: canvas.style.userSelect,
    cursor: canvas.style.cursor
  };
  const help = "Drag to orbit · Scroll or pinch to zoom at the pointer · Shift-drag or two-finger drag to pan · Arrow keys orbit · + / − zoom · Home or double-click resets";

  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to allocate a WebGL shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "Unknown shader compiler error.";
      gl.deleteShader(shader);
      throw new Error("Pelican SDF shader compilation failed:\n" + log);
    }
    return shader;
  }

  function buildResources() {
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
        throw new Error("Pelican SDF shader linking failed:\n" + gl.getProgramInfoLog(program));
      }
      vao = gl.createVertexArray();
      if (!vao) throw new Error("Unable to allocate the pelican vertex array.");
      const uniforms = {};
      for (const name of ["uResolution", "uTime", "uFocal", "uEye", "uBasis"]) {
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      gl.detachShader(program, vs);
      gl.detachShader(program, fs);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return { program, vao, uniforms };
    } catch (error) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (vao) gl.deleteVertexArray(vao);
      if (program) gl.deleteProgram(program);
      throw error;
    }
  }

  resources = buildResources();

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function cameraBasis() {
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    return {
      right: [cy, 0, -sy],
      up: [-sy * sp, cp, -cy * sp],
      forward: [-sy * cp, -sp, -cy * cp],
      eye: [
        target[0] + distance * sy * cp,
        target[1] + distance * sp,
        target[2] + distance * cy * cp
      ]
    };
  }

  function render(timeSeconds) {
    if (disposed || lost || !resources || gl.isContextLost()) return;
    lastTime = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const width = canvas.width, height = canvas.height;
    if (width <= 0 || height <= 0) return;
    const c = cameraBasis();
    const u = resources.uniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.colorMask(true, true, true, true);
    gl.useProgram(resources.program);
    gl.bindVertexArray(resources.vao);
    gl.uniform2f(u.uResolution, width, height);
    gl.uniform1f(u.uTime, lastTime % (Math.PI * 2000));
    gl.uniform1f(u.uFocal, 2.5 * Math.min(1, width / height));
    gl.uniform3fv(u.uEye, c.eye);
    gl.uniformMatrix3fv(u.uBasis, false, [
      ...c.right, ...c.up, ...c.forward
    ]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setView(newYaw, newPitch, newDistance) {
    if (disposed) return;
    if (Number.isFinite(newYaw)) yaw = newYaw;
    if (Number.isFinite(newPitch)) pitch = clamp(newPitch, -1.45, 1.45);
    if (Number.isFinite(newDistance)) distance = clamp(newDistance, 0.65, 20);
    target = [0.05, 1.75, 0];
  }

  function getView() {
    return { yaw, pitch, distance };
  }

  function redraw() {
    render(lastTime);
  }

  function reset() {
    setView(defaultView.yaw, defaultView.pitch, defaultView.distance);
    redraw();
  }

  function boundTarget() {
    target[0] = clamp(target[0], -2.1, 2.3);
    target[1] = clamp(target[1], 0.08, 3.7);
    target[2] = clamp(target[2], -1.4, 1.4);
  }

  function pan(dx, dy) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !canvas.height) return;
    const aspect = canvas.width / canvas.height;
    const focal = 2.5 * Math.min(1, aspect);
    const c = cameraBasis();
    const sx = 2 * distance * aspect * dx / (rect.width * focal);
    const sy = 2 * distance * dy / (rect.height * focal);
    for (let i = 0; i < 3; i++) target[i] += -c.right[i] * sx + c.up[i] * sy;
    boundTarget();
  }

  function zoom(factor, clientX, clientY) {
    const next = clamp(distance * factor, 0.65, 20);
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height && canvas.height &&
        Number.isFinite(clientX) && Number.isFinite(clientY)) {
      const aspect = canvas.width / canvas.height;
      const focal = 2.5 * Math.min(1, aspect);
      const x = ((clientX - rect.left) / rect.width * 2 - 1) * aspect;
      const y = 1 - (clientY - rect.top) / rect.height * 2;
      const scale = (distance - next) / focal;
      const c = cameraBasis();
      for (let i = 0; i < 3; i++) target[i] += scale * (x * c.right[i] + y * c.up[i]);
      boundTarget();
    }
    distance = next;
  }

  function listen(type, handler, options) {
    canvas.addEventListener(type, handler, options);
    listeners.push([type, handler, options]);
  }

  function focus() {
    canvas.focus({ preventScroll: true });
  }

  function pointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    e.preventDefault();
    focus();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    canvas.style.cursor = "grabbing";
  }

  function pointerMove(e) {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    e.preventDefault();
    const before = Array.from(pointers.values());
    const oldCenter = before.length > 1
      ? [(before[0].x + before[1].x) / 2, (before[0].y + before[1].y) / 2]
      : null;
    const oldSeparation = before.length > 1
      ? Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y)
      : 0;
    const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: previous.button });

    if (pointers.size > 1) {
      const after = Array.from(pointers.values());
      const center = [(after[0].x + after[1].x) / 2, (after[0].y + after[1].y) / 2];
      const separation = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
      pan(center[0] - oldCenter[0], center[1] - oldCenter[1]);
      if (oldSeparation > 4 && separation > 4) {
        zoom(oldSeparation / separation, center[0], center[1]);
      }
    } else if (e.shiftKey || e.altKey || previous.button === 1 || previous.button === 2) {
      pan(dx, dy);
    } else {
      const rect = canvas.getBoundingClientRect();
      yaw -= dx * Math.PI * 2 / Math.max(rect.width, 1);
      pitch = clamp(pitch + dy * Math.PI / Math.max(rect.height, 1), -1.45, 1.45);
    }
    redraw();
  }

  function pointerEnd(e) {
    pointers.delete(e.pointerId);
    try {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (!pointers.size) canvas.style.cursor = "grab";
  }

  function wheel(e) {
    e.preventDefault();
    focus();
    const multiplier = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 300 : 1;
    zoom(Math.exp(clamp(e.deltaY * multiplier, -240, 240) * 0.0018), e.clientX, e.clientY);
    redraw();
  }

  function keyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const step = e.shiftKey ? 0.13 : 0.065;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft": yaw -= step; break;
      case "ArrowRight": yaw += step; break;
      case "ArrowUp": pitch = clamp(pitch + step, -1.45, 1.45); break;
      case "ArrowDown": pitch = clamp(pitch - step, -1.45, 1.45); break;
      case "+":
      case "=": zoom(0.88); break;
      case "-":
      case "_":
      case "−": zoom(1 / 0.88); break;
      case "Home":
        e.preventDefault();
        reset();
        return;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      redraw();
    }
  }

  function contextLost(e) {
    e.preventDefault();
    lost = true;
    resources = null;
  }

  function contextRestored() {
    if (disposed) return;
    try {
      resources = buildResources();
      lost = false;
      redraw();
    } catch (_) {
      lost = true;
      resources = null;
    }
  }

  canvas.tabIndex = 0;
  canvas.title = help;
  canvas.style.touchAction = "none";
  canvas.style.userSelect = "none";
  canvas.style.cursor = "grab";

  listen("pointerdown", pointerDown, { passive: false });
  listen("pointermove", pointerMove, { passive: false });
  listen("pointerup", pointerEnd);
  listen("pointercancel", pointerEnd);
  listen("lostpointercapture", pointerEnd);
  listen("wheel", wheel, { passive: false });
  listen("keydown", keyDown);
  listen("contextmenu", e => e.preventDefault());
  listen("dblclick", e => { e.preventDefault(); reset(); });
  listen("webglcontextlost", contextLost);
  listen("webglcontextrestored", contextRestored);

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const [type, handler, options] of listeners) {
      canvas.removeEventListener(type, handler, options);
    }
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
    if (original.tabindex === null) canvas.removeAttribute("tabindex");
    else canvas.setAttribute("tabindex", original.tabindex);
    if (original.title === null) canvas.removeAttribute("title");
    else canvas.setAttribute("title", original.title);
    canvas.style.touchAction = original.touchAction;
    canvas.style.userSelect = original.userSelect;
    canvas.style.cursor = original.cursor;
  }

  render(0);
  return { render, setView, getView, dispose };
}
