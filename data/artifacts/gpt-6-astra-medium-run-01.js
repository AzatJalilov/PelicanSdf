export function createPelicanSdf(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false
  });
  if (!gl) throw new Error("This artwork requires WebGL2.");

  const vertexSource = `#version 300 es
  precision highp float;
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  out vec4 fragColor;
  uniform vec2 uResolution;
  uniform vec3 uView;
  uniform float uTime;

  const float PI = 3.14159265359;
  const vec3 TARGET = vec3(0.18, 1.67, 0.0);

  float capsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p-a, ba = b-a;
    return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0))-r;
  }
  float ellipsoid(vec3 p, vec3 r) {
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0*(k0-1.0)/max(k1,0.00001);
  }
  float box(vec3 p, vec3 b) {
    vec3 q = abs(p)-b;
    return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
  }
  float roundedBox(vec3 p, vec3 b, float r) {
    return box(p,b)-r;
  }
  float ring(vec3 p, float radius, float tube) {
    return length(vec2(length(p.xy)-radius,p.z))-tube;
  }
  float smoothMin(float a,float b,float k) {
    float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);
    return mix(b,a,h)-k*h*(1.0-h);
  }
  vec2 choose(vec2 a, float d, float id) {
    return d<a.x ? vec2(d,id) : a;
  }
  vec3 rotateZ(vec3 p,float a) {
    float c=cos(a),s=sin(a);
    return vec3(c*p.x+s*p.y,-s*p.x+c*p.y,p.z);
  }
  float tapered(vec3 p, vec3 a, vec3 b, float ra, float rb) {
    vec3 ba=b-a,pa=p-a;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    return (length(pa-ba*h)-mix(ra,rb,h))*0.88;
  }
  float segment2(vec2 p,vec2 a,vec2 b) {
    vec2 ba=b-a;
    return length(p-a-ba*clamp(dot(p-a,ba)/dot(ba,ba),0.0,1.0));
  }

  vec2 scene(vec3 p) {
    vec2 res=vec2(100.0,0.0);
    float phase=uTime*1.5;

    // Wheels lie in the bicycle's XY plane; its right side is +Z.
    for(int i=0;i<2;i++) {
      float x=i==0 ? -1.20 : 1.23;
      vec3 q=p-vec3(x,0.69,0.0);
      if(box(q,vec3(0.72,0.72,0.13))<res.x) {
        float radial=length(q.xy);
        float tire=ring(q,0.631,0.059);
        res=choose(res,tire,1.0);
        res=choose(res,ring(q,0.574,0.021),3.0);
        res=choose(res,ring(vec3(q.xy,abs(q.z)-0.042),0.624,0.006),2.0);
        res=choose(res,capsule(q,vec3(0,0,-0.105),vec3(0,0,0.105),0.052),3.0);
        float angle=atan(q.y,q.x)+phase*0.47;
        float sector=2.0*PI/12.0;
        angle=mod(angle+sector*0.5,sector)-sector*0.5;
        vec3 sp=vec3(radial*cos(angle),radial*sin(angle),q.z);
        res=choose(res,capsule(sp,vec3(0.055,0,0),vec3(0.56,0,0),0.0085),3.0);
        // A little brass valve makes the rims feel like real wheels.
        vec3 valve=rotateZ(q,-phase*0.47);
        res=choose(res,capsule(valve,vec3(0,0.515,0),vec3(0,0.56,0),0.014),4.0);
      }
    }

    if(box(p-vec3(0.0,1.10,0),vec3(1.35,0.85,0.59))<res.x) {
      vec3 rear=vec3(-1.20,0.69,0);
      vec3 seat=vec3(-0.46,1.47,0);
      vec3 crank=vec3(-0.16,0.70,0);
      vec3 head=vec3(0.92,1.48,0);

      float frame=capsule(p,seat,crank,0.041);
      frame=min(frame,capsule(p,seat,head,0.043));
      frame=min(frame,capsule(p,crank,head,0.046));
      frame=min(frame,capsule(p,vec3(0.90,1.39,0),vec3(0.96,1.60,0),0.058));
      for(int s=-1;s<=1;s+=2) {
        float z=float(s);
        frame=min(frame,capsule(p,vec3(-1.20,0.69,z*0.09),seat+vec3(0,0,z*0.045),0.027));
        frame=min(frame,capsule(p,vec3(-1.20,0.69,z*0.09),crank+vec3(0,0,z*0.07),0.029));
        frame=min(frame,capsule(p,vec3(1.23,0.69,z*0.085),vec3(0.94,1.49,z*0.07),0.034));
      }
      res=choose(res,frame,5.0);
      res=choose(res,capsule(p,vec3(-0.46,1.45,0),vec3(-0.52,1.64,0),0.030),3.0);
      res=choose(res,ellipsoid(p-vec3(-0.55,1.63,0),vec3(0.25,0.070,0.17)),6.0);
      res=choose(res,ellipsoid(p-vec3(-0.55,1.60,0),vec3(0.24,0.035,0.16)),4.0);

      float stem=capsule(p,vec3(0.94,1.53,0),vec3(0.84,1.82,0),0.029);
      stem=min(stem,capsule(p,vec3(0.84,1.82,-0.43),vec3(0.84,1.82,0.43),0.027));
      for(int s=-1;s<=1;s+=2) {
        float z=float(s);
        stem=min(stem,capsule(p,vec3(0.84,1.82,z*0.43),vec3(0.65,1.84,z*0.48),0.025));
        res=choose(res,capsule(p,vec3(0.64,1.84,z*0.48),vec3(0.76,1.83,z*0.45),0.043),6.0);
      }
      res=choose(res,stem,3.0);
      res=choose(res,ellipsoid(p-vec3(0.84,1.875,0.24),vec3(0.063,0.043,0.063)),4.0);
      res=choose(res,capsule(p,vec3(0.88,1.88,0.24),vec3(0.92,1.89,0.24),0.012),1.0);

      // Headlamp, with its cream lens pointing along +X.
      res=choose(res,ellipsoid(p-vec3(1.015,1.49,0),vec3(0.10,0.083,0.083)),4.0);
      res=choose(res,ellipsoid(p-vec3(1.085,1.49,0),vec3(0.027,0.064,0.064)),10.0);

      // Chain, chainring, axle and opposed crank arms.
      float chainDistance=segment2(p.xy,rear.xy,crank.xy);
      float chain=length(vec2(chainDistance-0.112,p.z-0.13))-0.012;
      res=choose(res,chain,1.0);
      res=choose(res,ring(p-(crank+vec3(0,0,0.13)),0.123,0.018),4.0);
      res=choose(res,ring(p-vec3(-1.20,0.69,0.13),0.089,0.014),3.0);
      res=choose(res,capsule(p,crank-vec3(0,0,0.24),crank+vec3(0,0,0.24),0.041),3.0);
      for(int s=-1;s<=1;s+=2) {
        float side=float(s);
        vec3 pedal=crank+vec3(0.28*cos(phase)*side,0.28*sin(phase)*side,side*0.30);
        vec3 base=crank+vec3(0,0,side*0.20);
        res=choose(res,capsule(p,base,vec3(pedal.xy,side*0.20),0.025),3.0);
        res=choose(res,capsule(p,vec3(pedal.xy,side*0.18),vec3(pedal.xy,side*0.39),0.025),3.0);
        res=choose(res,roundedBox(p-pedal,vec3(0.115,0.021,0.093),0.013),1.0);
        res=choose(res,roundedBox(p-(pedal+vec3(0.0,0,side*0.104)),vec3(0.068,0.012,0.005),0.003),7.0);
      }
    }

    if(box(p-vec3(0.28,2.30,0),vec3(1.85,1.00,0.64))<res.x) {
      // Plump body, a tapering tail, and a smoothly joined upright neck.
      float bird=ellipsoid(rotateZ(p-vec3(-0.48,2.03,0),-0.15),vec3(0.65,0.53,0.39));
      bird=smoothMin(bird,ellipsoid(rotateZ(p-vec3(-0.02,2.32,0),-0.27),vec3(0.25,0.44,0.25)),0.16);
      bird=smoothMin(bird,ellipsoid(rotateZ(p-vec3(0.17,2.64,0),-0.42),vec3(0.205,0.38,0.21)),0.13);
      bird=smoothMin(bird,ellipsoid(p-vec3(0.46,2.91,0),vec3(0.345,0.275,0.255)),0.12);
      bird=smoothMin(bird,ellipsoid(rotateZ(p-vec3(-1.03,1.99,0),-0.25),vec3(0.38,0.14,0.23)),0.08);
      res=choose(res,bird,8.0);

      // Swept tail feather tips.
      for(int i=0;i<3;i++) {
        float z=float(i-1)*0.105;
        res=choose(res,capsule(p,vec3(-1.00,2.00,z),vec3(-1.30,2.10,z*0.70),0.047),9.0);
      }

      // Golden throat pouch suspended below the long bill.
      vec3 pouch=rotateZ(p-vec3(1.06,2.675,0),0.16);
      res=choose(res,ellipsoid(pouch,vec3(0.56,0.235,0.178)),11.0);
      vec3 bill=p;
      bill.y=(p.y-2.825)/0.47;
      float upper=tapered(bill,vec3(0.63,0,0),vec3(1.96,-0.105,0),0.185,0.014)*0.47;
      res=choose(res,upper,7.0);
      res=choose(res,capsule(p,vec3(0.74,2.783,0.157),vec3(1.94,2.767,0.012),0.010),6.0);
      res=choose(res,capsule(p,vec3(0.74,2.783,-0.157),vec3(1.94,2.767,-0.012),0.010),6.0);
      res=choose(res,ellipsoid(p-vec3(1.94,2.753,0),vec3(0.035,0.043,0.025)),7.0);

      for(int s=-1;s<=1;s+=2) {
        float side=float(s);
        // Both eyes are actual volumes on opposite sides of the head.
        res=choose(res,ellipsoid(p-vec3(0.57,2.980,side*0.229),vec3(0.083,0.088,0.036)),11.0);
        res=choose(res,ellipsoid(p-vec3(0.58,2.988,side*0.254),vec3(0.055,0.060,0.024)),1.0);
        res=choose(res,ellipsoid(p-vec3(0.598,3.010,side*0.275),vec3(0.016,0.019,0.008)),10.0);
        res=choose(res,capsule(p,vec3(0.51,3.078,side*0.226),vec3(0.61,3.081,side*0.223),0.018),8.0);
        res=choose(res,ellipsoid(p-vec3(0.91,2.859,side*0.132),vec3(0.034,0.012,0.009)),6.0);

        // Wings sweep forward into the handlebar grips.
        vec3 wing=rotateZ(p-vec3(-0.28,2.12,side*0.36),-0.25);
        res=choose(res,ellipsoid(wing,vec3(0.53,0.255,0.135)),9.0);
        res=choose(res,ellipsoid(rotateZ(p-vec3(-0.34,2.18,side*0.405),-0.28),vec3(0.43,0.19,0.092)),8.0);
        for(int i=0;i<4;i++) {
          float f=float(i);
          vec3 a=vec3(-0.08+0.025*f,2.12-0.055*f,side*(0.43+0.009*f));
          vec3 b=vec3(0.71-0.045*f,1.865-0.009*f,side*(0.47+0.017*f));
          res=choose(res,tapered(p,a,b,0.052,0.025),i==0?8.0:9.0);
        }
        res=choose(res,ellipsoid(p-vec3(0.68,1.87,side*0.48),vec3(0.11,0.047,0.068)),9.0);
      }
      // A small, swept crest.
      res=choose(res,capsule(p,vec3(0.27,3.105,0),vec3(0.08,3.18,0),0.034),8.0);
      res=choose(res,capsule(p,vec3(0.31,3.12,0.055),vec3(0.15,3.205,0.06),0.025),8.0);
    }

    if(box(p-vec3(-0.25,1.20,0),vec3(0.64,0.69,0.53))<res.x) {
      for(int s=-1;s<=1;s+=2) {
        float side=float(s);
        vec3 pedal=vec3(-0.16+0.28*cos(phase)*side,0.70+0.28*sin(phase)*side,side*0.30);
        vec3 hip=vec3(-0.48,1.77,side*0.22);
        vec3 knee=vec3(-0.02+0.06*cos(phase)*side,1.25+0.055*sin(phase)*side,side*0.34);
        vec3 ankle=pedal+vec3(-0.045,0.105,0);
        res=choose(res,tapered(p,hip,knee,0.095,0.048),11.0);
        res=choose(res,tapered(p,knee,ankle,0.047,0.034),7.0);
        res=choose(res,ellipsoid(p-knee,vec3(0.054,0.060,0.054)),7.0);
        res=choose(res,ellipsoid(p-(pedal+vec3(0.025,0.067,0)),vec3(0.155,0.041,0.095)),7.0);
        for(int i=0;i<3;i++) {
          float offset=float(i-1)*0.055;
          res=choose(res,capsule(p,ankle, pedal+vec3(0.15,0.053,offset),0.021),7.0);
        }
      }
    }
    return res;
  }

  vec3 normalAt(vec3 p,float e) {
    vec2 h=vec2(e,-e);
    return normalize(
      h.xyy*scene(p+h.xyy).x+
      h.yyx*scene(p+h.yyx).x+
      h.yxy*scene(p+h.yxy).x+
      h.xxx*scene(p+h.xxx).x
    );
  }

  vec2 bounds(vec3 ro,vec3 rd) {
    vec3 inv=1.0/(rd+vec3(0.0000001));
    vec3 a=(vec3(-1.95,-0.025,-0.70)-ro)*inv;
    vec3 b=(vec3(2.08,3.29,0.70)-ro)*inv;
    vec3 lo=min(a,b), hi=max(a,b);
    return vec2(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));
  }

  float shadow(vec3 p,vec3 light) {
    vec2 range=bounds(p,light);
    float t=max(0.025,range.x), end=min(5.0,range.y);
    float result=1.0;
    for(int i=0;i<28;i++) {
      if(t>end) break;
      float d=scene(p+light*t).x;
      result=min(result,12.0*d/t);
      if(d<0.0015) return 0.12;
      t+=clamp(d,0.018,0.23);
    }
    return mix(0.12,1.0,clamp(result,0.0,1.0));
  }

  float ambientOcclusion(vec3 p,vec3 n) {
    float a=0.0;
    a+=(0.045-scene(p+n*0.045).x)*1.8;
    a+=(0.13-scene(p+n*0.13).x)*0.75;
    a+=(0.29-scene(p+n*0.29).x)*0.35;
    return clamp(1.0-a*1.8,0.35,1.0);
  }

  vec3 material(float id,vec3 p,out float roughness,out float metal) {
    roughness=0.48; metal=0.0;
    if(id<1.5) { roughness=0.65; return vec3(0.025,0.043,0.057); }
    if(id<2.5) { roughness=0.7; return vec3(0.70,0.64,0.48); }
    if(id<3.5) { roughness=0.24; metal=0.75; return vec3(0.56,0.68,0.70); }
    if(id<4.5) { roughness=0.28; metal=0.65; return vec3(0.83,0.49,0.16); }
    if(id<5.5) { roughness=0.27; metal=0.28; return vec3(0.025,0.43,0.40); }
    if(id<6.5) { roughness=0.64; return vec3(0.28,0.068,0.043); }
    if(id<7.5) { roughness=0.38; return vec3(1.0,0.405,0.065); }
    if(id<8.5) {
      roughness=0.71;
      float warm=smoothstep(1.6,3.2,p.y);
      return mix(vec3(0.80,0.84,0.79),vec3(0.98,0.94,0.79),warm);
    }
    if(id<9.5) { roughness=0.74; return vec3(0.13,0.19,0.24); }
    if(id<10.5) { roughness=0.25; return vec3(1.0,0.98,0.85); }
    roughness=0.62;
    return vec3(0.97,0.65,0.20);
  }

  vec3 illuminate(vec3 p,vec3 n,vec3 rd,vec3 albedo,float rough,float metal,float ao,float sh) {
    vec3 light=normalize(vec3(-3.0,6.0,4.0));
    vec3 halfV=normalize(light-rd);
    float nl=max(dot(n,light),0.0);
    float nv=max(dot(n,-rd),0.001);
    float nh=max(dot(n,halfV),0.0);
    float vh=max(dot(-rd,halfV),0.0);
    float a=max(0.045,rough*rough);
    float a2=a*a;
    float den=nh*nh*(a2-1.0)+1.0;
    float distribution=a2/(PI*den*den);
    float k=(rough+1.0)*(rough+1.0)/8.0;
    float geometry=(nl/(nl*(1.0-k)+k))*(nv/(nv*(1.0-k)+k));
    vec3 f0=mix(vec3(0.04),albedo,metal);
    vec3 fresnel=f0+(1.0-f0)*pow(1.0-vh,5.0);
    vec3 spec=distribution*geometry*fresnel/max(4.0*nl*nv,0.001);
    vec3 ambient=mix(vec3(0.29,0.32,0.30),vec3(0.65,0.77,0.85),n.y*0.5+0.5);
    vec3 color=albedo*ambient*0.53*ao;
    color+=(albedo*(1.0-metal)*0.83+spec*1.8)*nl*sh*vec3(1.16,1.04,0.86);
    float rim=pow(1.0-nv,3.0);
    color+=albedo*0.14*rim*ao;
    float fill=max(dot(n,normalize(vec3(2.0,2.2,-4.0))),0.0);
    color+=albedo*vec3(0.28,0.39,0.48)*fill*ao;
    color+=f0*pow(max(dot(reflect(rd,n),normalize(vec3(-1,3,2))),0.0),16.0)*0.25*ao;
    return color;
  }

  void main() {
    vec2 uv=(2.0*gl_FragCoord.xy-uResolution)/uResolution.y;
    float yaw=uView.x, pitch=uView.y;
    vec3 offset=vec3(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch));
    vec3 ro=TARGET+offset*uView.z;
    vec3 forward=normalize(TARGET-ro);
    vec3 right=normalize(cross(forward,vec3(0,1,0)));
    vec3 up=cross(right,forward);
    vec3 rd=normalize(forward*2.12+right*uv.x+up*uv.y);

    vec3 color=mix(vec3(0.76,0.85,0.82),vec3(0.46,0.66,0.72),smoothstep(-0.30,0.85,rd.y));
    float floorT=1e5;
    if(rd.y< -0.0001) {
      float ft=(-0.025-ro.y)/rd.y;
      if(ft>0.0) floorT=ft;
    }

    vec2 interval=bounds(ro,rd);
    float t=max(interval.x,0.025);
    float end=min(interval.y,floorT);
    bool hit=false;
    vec2 surface=vec2(0.0);
    float eps=0.001;
    if(end>t) {
      for(int i=0;i<144;i++) {
        surface=scene(ro+rd*t);
        eps=max(0.00065,t*0.00019);
        if(surface.x<eps) { hit=true; break; }
        t+=max(surface.x*0.85,eps*0.4);
        if(t>end) break;
      }
    }
    vec3 light=normalize(vec3(-3.0,6.0,4.0));
    if(hit) {
      vec3 p=ro+rd*t;
      vec3 n=normalAt(p,max(0.0006,eps*0.85));
      float rough,metal;
      vec3 albedo=material(surface.y,p,rough,metal);
      float ao=ambientOcclusion(p,n);
      float sh=shadow(p+n*0.008,light);
      color=illuminate(p,n,rd,albedo,rough,metal,ao,sh);
      color=mix(color,vec3(0.66,0.78,0.77),1.0-exp(-0.012*t));
    } else if(floorT<1e4) {
      vec3 p=ro+rd*floorT;
      float sh=shadow(p+vec3(0,0.005,0),light);
      float contact=exp(-pow(p.x/1.68,2.0)-pow(p.z/0.52,2.0))*0.16;
      vec3 floorColor=vec3(0.68,0.77,0.68);
      // A quiet oval studio plinth, painted into the floor.
      float oval=length(p.xz/vec2(2.50,1.20));
      float edge=1.0-smoothstep(0.985,1.005,oval);
      floorColor=mix(floorColor,vec3(0.82,0.79,0.63),edge*0.58);
      float border=(1.0-smoothstep(0.006,0.016,abs(oval-1.0)));
      floorColor=mix(floorColor,vec3(0.55,0.65,0.58),border*0.22);
      color=floorColor*(0.50+0.50*sh)*(1.0-contact);
      color=mix(color,vec3(0.71,0.81,0.79),1.0-exp(-floorT*0.022));
    }

    color*=1.07;
    color=(color*(2.51*color+0.03))/(color*(2.43*color+0.59)+0.14);
    color=pow(clamp(color,0.0,1.0),vec3(1.0/2.2));
    float vignette=1.0-0.045*dot(uv,uv)/(1.0+dot(uv,uv));
    fragColor=vec4(color*vignette,1.0);
  }`;

  let program = null;
  let vao = null;
  let uniforms = null;
  let lost = false;
  let disposed = false;
  let view = { yaw: 0.48, pitch: 0.16, distance: 6.8 };

  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to allocate a WebGL shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("Pelican SDF shader compilation failed: " + log);
    }
    return shader;
  }

  function initialize() {
    let vs = null;
    let fs = null;
    let nextProgram = null;
    try {
      vs = compile(gl.VERTEX_SHADER, vertexSource);
      fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
      nextProgram = gl.createProgram();
      if (!nextProgram) throw new Error("Unable to allocate a WebGL program.");
      gl.attachShader(nextProgram, vs);
      gl.attachShader(nextProgram, fs);
      gl.linkProgram(nextProgram);
      if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
        throw new Error("Pelican SDF shader linking failed: " + gl.getProgramInfoLog(nextProgram));
      }
      program = nextProgram;
      vao = gl.createVertexArray();
      uniforms = {
        resolution: gl.getUniformLocation(program, "uResolution"),
        view: gl.getUniformLocation(program, "uView"),
        time: gl.getUniformLocation(program, "uTime")
      };
    } catch (error) {
      if (nextProgram) gl.deleteProgram(nextProgram);
      program = null;
      throw error;
    } finally {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
    }
  }
  initialize();

  const previousTabIndex = canvas.getAttribute("tabindex");
  const previousTouchAction = canvas.style.touchAction;
  canvas.tabIndex = 0;
  canvas.style.touchAction = "none";
  const pointers = new Map();
  const listeners = [];

  function listen(type, fn, options) {
    canvas.addEventListener(type, fn, options);
    listeners.push([type, fn, options]);
  }
  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }
  function wrapYaw(yaw) {
    return ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  }
  function zoom(factor) {
    view.distance = clamp(view.distance * factor, 0.85, 16);
  }
  function gesture() {
    const values = Array.from(pointers.values());
    if (!values.length) return null;
    if (values.length === 1) return { x: values[0].x, y: values[0].y, span: 0 };
    const a = values[0], b = values[1];
    return {
      x: (a.x + b.x) * 0.5,
      y: (a.y + b.y) * 0.5,
      span: Math.hypot(a.x - b.x, a.y - b.y)
    };
  }

  listen("pointerdown", event => {
    if (disposed || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
  }, { passive: false });

  listen("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    const before = gesture();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = gesture();
    view.yaw = wrapYaw(view.yaw - (after.x - before.x) * 0.008);
    view.pitch = clamp(view.pitch + (after.y - before.y) * 0.006, -1.40, 1.40);
    if (before.span > 4 && after.span > 4) zoom(before.span / after.span);
  }, { passive: false });

  function release(event) {
    pointers.delete(event.pointerId);
    try {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    } catch (_) {}
  }
  listen("pointerup", release);
  listen("pointercancel", release);
  listen("lostpointercapture", event => pointers.delete(event.pointerId));

  listen("wheel", event => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 480 : 1;
    zoom(Math.exp(clamp(event.deltaY * unit * 0.001, -0.5, 0.5)));
  }, { passive: false });

  listen("keydown", event => {
    const step = event.shiftKey ? 0.16 : 0.065;
    let handled = true;
    switch (event.key) {
      case "ArrowLeft": view.yaw = wrapYaw(view.yaw + step); break;
      case "ArrowRight": view.yaw = wrapYaw(view.yaw - step); break;
      case "ArrowUp": view.pitch = clamp(view.pitch + step, -1.40, 1.40); break;
      case "ArrowDown": view.pitch = clamp(view.pitch - step, -1.40, 1.40); break;
      case "+":
      case "=": zoom(0.90); break;
      case "-":
      case "_": zoom(1 / 0.90); break;
      default: handled = false;
    }
    if (handled) event.preventDefault();
  }, { passive: false });

  listen("webglcontextlost", event => {
    event.preventDefault();
    lost = true;
    pointers.clear();
  });

  listen("webglcontextrestored", () => {
    if (disposed) return;
    try {
      initialize();
      lost = false;
    } catch (_) {
      lost = true;
    }
  });

  return {
    render(timeSeconds) {
      if (disposed || lost || gl.isContextLost() || !program) return;
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      if (width < 1 || height < 1) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.colorMask(true, true, true, true);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform3f(uniforms.view, view.yaw, view.pitch, view.distance);
      const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
      gl.uniform1f(uniforms.time, time % (Math.PI * 2 / 1.5));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    setView(yaw, pitch, distance) {
      if (disposed) return;
      if (Number.isFinite(yaw)) view.yaw = wrapYaw(yaw);
      if (Number.isFinite(pitch)) view.pitch = clamp(pitch, -1.40, 1.40);
      if (Number.isFinite(distance)) view.distance = clamp(distance, 0.85, 16);
    },

    getView() {
      return { yaw: view.yaw, pitch: view.pitch, distance: view.distance };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [type, listener, options] of listeners) {
        canvas.removeEventListener(type, listener, options);
      }
      for (const id of pointers.keys()) {
        try {
          if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
        } catch (_) {}
      }
      pointers.clear();
      canvas.style.touchAction = previousTouchAction;
      if (previousTabIndex === null) canvas.removeAttribute("tabindex");
      else canvas.setAttribute("tabindex", previousTabIndex);
      if (!gl.isContextLost()) {
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
      }
      vao = null;
      program = null;
      uniforms = null;
    }
  };
}
