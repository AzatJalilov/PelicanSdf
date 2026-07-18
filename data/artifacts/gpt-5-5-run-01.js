export function createPelicanSdf(canvas){
const gl=canvas.getContext("webgl2",{antialias:false,depth:false,stencil:false,alpha:false,preserveDrawingBuffer:false});
if(!gl)throw new Error("WebGL2 is unavailable");
let lost=false,yaw=.58,pitch=.24,dist=4.2,drag=0,px=0,py=0,pid=null;
canvas.tabIndex=canvas.tabIndex>=0?canvas.tabIndex:0;
canvas.style.touchAction="none";
const vs=`#version 300 es
in vec2 p;out vec2 v;void main(){v=p;gl_Position=vec4(p,0,1);}`;
const fs=`#version 300 es
precision highp float;in vec2 v;out vec4 o;uniform vec2 R;uniform float T,Y,P,D;
#define MAXD 18.
#define EPS .0015
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float box(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sph(vec3 p,float r){return length(p)-r;}
float ell(vec3 p,vec3 r){return (length(p/r)-1.)*min(r.x,min(r.y,r.z));}
float cap(vec3 p,vec3 a,vec3 b,float r){vec3 q=p-a,c=b-a;float h=clamp(dot(q,c)/dot(c,c),0.,1.);return length(q-c*h)-r;}
float torZ(vec3 p,float R,float r){return length(vec2(length(p.xy)-R,p.z))-r;}
vec2 U(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 scene(vec3 p){
 vec2 m=vec2(99.,0.);float d;
 vec3 q=p;
 for(int i=0;i<2;i++){
  float x=i==0?-1.12:1.12;
  q=p-vec3(x,.55,0);
  m=U(m,vec2(torZ(q,.54,.045),1.));
  m=U(m,vec2(torZ(q,.43,.012),2.));
  m=U(m,vec2(sph(q,.055),2.));
  for(int k=0;k<10;k++){
   float a=6.2831853*(float(k)/10.)+T*.7;
   vec3 e=vec3(cos(a)*.43,sin(a)*.43,0.);
   m=U(m,vec2(cap(q,vec3(0),e,.006),2.));
  }
 }
 m=U(m,vec2(cap(p,vec3(-1.12,.55,0),vec3(-.25,1.05,0),.035),3.));
 m=U(m,vec2(cap(p,vec3(1.12,.55,0),vec3(-.25,1.05,0),.035),3.));
 m=U(m,vec2(cap(p,vec3(-1.12,.55,0),vec3(.25,.55,0),.035),3.));
 m=U(m,vec2(cap(p,vec3(.25,.55,0),vec3(-.25,1.05,0),.035),3.));
 m=U(m,vec2(cap(p,vec3(.25,.55,0),vec3(1.12,.55,0),.035),3.));
 m=U(m,vec2(cap(p,vec3(.25,.55,0),vec3(.58,1.23,0),.028),3.));
 m=U(m,vec2(cap(p,vec3(.58,1.23,0),vec3(.78,1.30,0),.026),3.));
 m=U(m,vec2(cap(p,vec3(-.28,1.05,0),vec3(-.48,1.22,0),.035),3.));
 q=p-vec3(-.55,1.25,0);m=U(m,vec2(box(q,vec3(.23,.045,.18)),4.));
 q=p-vec3(.25,.55,0);m=U(m,vec2(torZ(q,.17,.014),2.));
 m=U(m,vec2(cap(p,vec3(.25,.55,.16),vec3(.25,.55,.35),.018),5.));
 m=U(m,vec2(cap(p,vec3(.25,.55,-.16),vec3(.25,.55,-.35),.018),5.));
 m=U(m,vec2(cap(p,vec3(-.28,1.16,.10),vec3(.22,.68,.13),.035),6.));
 m=U(m,vec2(cap(p,vec3(-.10,1.15,-.10),vec3(.28,.47,-.16),.035),6.));
 m=U(m,vec2(cap(p,vec3(.22,.68,.13),vec3(.25,.55,.31),.032),6.));
 m=U(m,vec2(cap(p,vec3(.28,.47,-.16),vec3(.25,.55,-.31),.032),6.));
 q=p-vec3(-.18,1.33,0);m=U(m,vec2(ell(q,vec3(.43,.31,.25)),7.));
 q=p-vec3(-.22,1.33,.23);m=U(m,vec2(ell(q,vec3(.34,.20,.06)),8.));
 q=p-vec3(-.22,1.33,-.23);m=U(m,vec2(ell(q,vec3(.34,.20,.06)),8.));
 m=U(m,vec2(cap(p,vec3(.13,1.50,0),vec3(.43,1.73,0),.13),7.));
 q=p-vec3(.55,1.79,0);m=U(m,vec2(ell(q,vec3(.20,.17,.16)),7.));
 q=p-vec3(.96,1.78,0);m=U(m,vec2(ell(q,vec3(.47,.07,.09)),9.));
 q=p-vec3(.86,1.68,0);m=U(m,vec2(ell(q,vec3(.30,.12,.075)),10.));
 m=U(m,vec2(cap(p,vec3(.63,1.79,.13),vec3(.66,1.80,.18),.025),11.));
 m=U(m,vec2(cap(p,vec3(.63,1.79,-.13),vec3(.66,1.80,-.18),.025),11.));
 q=p-vec3(-.55,1.48,0);q.xy*=rot(-.35);m=U(m,vec2(ell(q,vec3(.24,.08,.19)),12.));
 m=U(m,vec2(cap(p,vec3(.80,1.31,0),vec3(1.00,1.50,.18),.035),6.));
 m=U(m,vec2(cap(p,vec3(.80,1.31,0),vec3(1.00,1.50,-.18),.035),6.));
 m=U(m,vec2(p.y+.025,13.));
 return m;
}
vec3 norm(vec3 p){vec2 e=vec2(EPS,0);return normalize(vec3(scene(p+e.xyy).x-scene(p-e.xyy).x,scene(p+e.yxy).x-scene(p-e.yxy).x,scene(p+e.yyx).x-scene(p-e.yyx).x));}
vec3 matc(float id){
 if(id<1.5)return vec3(.015,.014,.012);
 if(id<2.5)return vec3(.78,.82,.82);
 if(id<3.5)return vec3(.10,.42,.55);
 if(id<4.5)return vec3(.10,.08,.06);
 if(id<5.5)return vec3(.9,.55,.08);
 if(id<6.5)return vec3(.95,.46,.05);
 if(id<7.5)return vec3(.92,.90,.82);
 if(id<8.5)return vec3(.72,.74,.70);
 if(id<9.5)return vec3(.96,.55,.08);
 if(id<10.5)return vec3(1.,.72,.18);
 if(id<11.5)return vec3(.02,.018,.012);
 if(id<12.5)return vec3(.78,.80,.78);
 return vec3(.35,.48,.38);
}
float soft(vec3 ro,vec3 rd,float k){float r=1.,t=.04;for(int i=0;i<36;i++){float h=scene(ro+rd*t).x;r=min(r,k*h/t);t+=clamp(h,.02,.16);if(r<.05||t>6.)break;}return clamp(r,0.,1.);}
void main(){
 vec2 uv=(v*R-vec2(R.x,R.y))/R.y;
 vec3 ta=vec3(0.,1.05,0.),ro=ta+vec3(sin(Y)*cos(P),sin(P),cos(Y)*cos(P))*D;
 vec3 ww=normalize(ta-ro),uu=normalize(cross(vec3(0,1,0),ww)),vv=cross(ww,uu);
 vec3 rd=normalize(uu*uv.x+vv*uv.y+ww*1.55);
 vec3 col=mix(vec3(.70,.86,.96),vec3(.92,.96,.98),max(rd.y,0.));
 float t=0.,id=0.,hit=0.;
 for(int i=0;i<118;i++){vec3 pos=ro+rd*t;vec2 h=scene(pos);if(h.x<EPS){hit=1.;id=h.y;break;}t+=h.x*.82;if(t>MAXD)break;}
 if(hit>0.){
  vec3 pos=ro+rd*t,n=norm(pos),ld=normalize(vec3(-.45,.85,.38));
  float dif=max(dot(n,ld),0.),sha=soft(pos+n*.01,ld,9.),rim=pow(max(0.,1.+dot(n,rd)),2.);
  vec3 base=matc(id);
  col=base*(.28+.72*dif*sha)+vec3(.75,.86,1.)*rim*.18;
  float fog=exp(-.035*t*t);col=mix(vec3(.70,.86,.96),col,fog);
 }
 col=pow(col,vec3(.4545));o=vec4(col,1);
}`;
function sh(t,s){let x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error("Shader compilation failed: "+gl.getShaderInfoLog(x));return x}
const pr=gl.createProgram(),a=sh(gl.VERTEX_SHADER,vs),b=sh(gl.FRAGMENT_SHADER,fs);
gl.attachShader(pr,a);gl.attachShader(pr,b);gl.linkProgram(pr);
if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error("Shader link failed: "+gl.getProgramInfoLog(pr));
const buf=gl.createBuffer(),vao=gl.createVertexArray();
gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const loc=gl.getAttribLocation(pr,"p");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const uR=gl.getUniformLocation(pr,"R"),uT=gl.getUniformLocation(pr,"T"),uY=gl.getUniformLocation(pr,"Y"),uP=gl.getUniformLocation(pr,"P"),uD=gl.getUniformLocation(pr,"D");
function clamp(){pitch=Math.max(-1.25,Math.min(1.25,pitch));dist=Math.max(1.15,Math.min(9,dist))}
function down(e){canvas.focus();drag=1;pid=e.pointerId;px=e.clientX;py=e.clientY;try{canvas.setPointerCapture(pid)}catch(_){}e.preventDefault()}
function move(e){if(!drag||e.pointerId!==pid)return;let dx=e.clientX-px,dy=e.clientY-py;px=e.clientX;py=e.clientY;yaw-=dx*.008;pitch-=dy*.008;clamp();e.preventDefault()}
function up(e){if(e.pointerId===pid){drag=0;try{canvas.releasePointerCapture(pid)}catch(_){}}}
function wh(e){dist*=Math.exp(e.deltaY*.001);clamp();e.preventDefault()}
function key(e){let k=e.key;if(k==="ArrowLeft")yaw+=.08;else if(k==="ArrowRight")yaw-=.08;else if(k==="ArrowUp")pitch+=.08;else if(k==="ArrowDown")pitch-=.08;else if(k==="+"||k==="=")dist*=.9;else if(k==="-"||k==="_")dist*=1.1;else return;clamp();e.preventDefault()}
function loss(e){lost=true;e.preventDefault()}function rest(){lost=false}
canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);canvas.addEventListener("wheel",wh,{passive:false});canvas.addEventListener("keydown",key);canvas.addEventListener("webglcontextlost",loss,false);canvas.addEventListener("webglcontextrestored",rest,false);
return{render(timeSeconds){if(lost)return;gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(pr);gl.bindVertexArray(vao);gl.uniform2f(uR,canvas.width,canvas.height);gl.uniform1f(uT,+timeSeconds||0);gl.uniform1f(uY,yaw);gl.uniform1f(uP,pitch);gl.uniform1f(uD,dist);gl.drawArrays(gl.TRIANGLES,0,3)},setView(y,p,d){yaw=+y||0;pitch=+p||0;dist=+d||4;clamp()},getView(){return{yaw,pitch,distance:dist}},dispose(){canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);canvas.removeEventListener("wheel",wh);canvas.removeEventListener("keydown",key);canvas.removeEventListener("webglcontextlost",loss);canvas.removeEventListener("webglcontextrestored",rest);if(!lost){gl.deleteBuffer(buf);gl.deleteVertexArray(vao);gl.deleteShader(a);gl.deleteShader(b);gl.deleteProgram(pr)}}}
}

