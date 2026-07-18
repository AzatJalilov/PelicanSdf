export function createPelicanSdf(c){const g=c.getContext('webgl2');if(!g)throw new Error('WebGL2');let y=0,p=0,d=8,x=0,lx,ly;c.tabIndex=0;c.style.cursor='grab';const md=e=>{x=1;lx=e.clientX;ly=e.clientY;c.style.cursor='grabbing'},mm=e=>{if(x){y+=(e.clientX-lx)*.01;p+=(e.clientY-ly)*.01;p=Math.max(-Math.PI/2,Math.min(Math.PI/2,p));lx=e.clientX;ly=e.clientY}},mu=()=>{x=0;c.style.cursor='grab'},mw=e=>{e.preventDefault();d*=1+e.deltaY*.001;d=Math.max(1.5,Math.min(40,d))},mk=e=>{const s=0.05;switch(e.key){case'ArrowUp':p+=s;break;case'ArrowDown':p-=s;break;case'ArrowLeft':y-=s;break;case'ArrowRight':y+=s;break;case'+':case'=':d/=1.12;break;case'-':d*=1.12;}p=Math.max(-Math.PI/2,Math.min(Math.PI/2,p))};c.addEventListener('mousedown',md);c.addEventListener('mousemove',mm);c.addEventListener('mouseup',mu);c.addEventListener('wheel',mw,{passive:!1});c.addEventListener('keydown',mk);const v='#version 300 es\nvoid main(){gl_Position=vec4(vec2(gl_VertexID&1,(gl_VertexID>>1)&1)*4.-1.,0,1);}',f=`#version 300 es
precision highp float;uniform vec3 camPos;uniform mat3 camRot;uniform vec2 res;out vec4 fragColor;
float sd(vec3 p,float r){return length(p)-r;}
float sb(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sc(vec3 p,float h,float r){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return length(max(d,0.))+min(max(d.x,d.y),0.);}
float st(vec3 p,float R,float r){vec2 q=vec2(length(p.xz)-R,p.y);return length(q)-r;}
float map(vec3 p){float res=1e9;vec3 pb=p-vec3(0,.6,0);
res=min(res,length(pb/vec3(.9,.55,1.3))-1.);
res=min(res,length((pb-vec3(.45,.35,1.1))/vec3(.38,.43,.43))-1.);
vec3 bk=pb-vec3(.75,.15,1.05);res=min(res,sc(bk-vec3(.4,0,0),.12,.14));
res=min(res,length((bk-vec3(1.35,-.05,0))/vec3(.18,.1,.09))-1.);
vec3 po=pb-vec3(.55,-.15,.85);res=min(res,length(po/vec3(.32,.42,.37))-1.);
res=min(res,length(pb-vec3(.65,.45,1.15))-.13);
res=min(res,length((pb-vec3(-1.1,.1,.4))/vec3(.35,1.25,.45))-1.);
res=min(res,length((pb-vec3(1.1,.1,.4))/vec3(.35,1.25,.45))-1.);
res=min(res,sc(pb-vec3(-.25,-.95,-.1),.6,.09));res=min(res,sc(pb-vec3(.25,-.95,-.1),.6,.09));
res=min(res,st(p-vec3(-1.6,-.4,0),.85,.16));res=min(res,st(p-vec3(1.6,-.4,0),.85,.16));
vec3 ft=p-vec3(-.1,.1,0);res=min(res,sc(ft,1.8,.12));
res=min(res,sc(p-vec3(0,.9,0),.25,.08));res=min(res,sc(p-vec3(-.25,.75,0),.08,.07));
res=min(res,sc(p-vec3(-1.6,.5,0),.35,.09));res=min(res,sc(p-vec3(-.1,-.15,0),.35,.08));
return res;}
vec3 march(vec3 ro,vec3 rd){float t=0.;for(int i=0;i<120;i++){float d=map(ro+rd*t);if(d<.0005)return ro+rd*t;t+=d*.75;if(t>150.)return vec3(0);}return vec3(0);}
vec3 norm(vec3 p){float e=.0005,d=map(p);return normalize(vec3(map(p+vec3(e,0,0))-d,map(p+vec3(0,e,0))-d,map(p+vec3(0,0,e))-d));}
void main(){vec2 uv=gl_FragCoord.xy/res;uv=uv*2.-1.;uv.x*=res.x/res.y;vec3 rd=normalize(camRot*vec3(uv,-1.5));vec3 hit=march(camPos,rd);
if(hit==vec3(0)){fragColor=vec4(.12,.18,.28,1.);return;}vec3 n=norm(hit);vec3 l=normalize(vec3(1.2,1.3,-.8));
float df=max(0.,dot(n,l))*.75+.25;vec3 col=vec3(1.)*df;
vec3 h=normalize(-rd+l);col+=pow(max(0.,dot(n,h)),32.)*.4;fragColor=vec4(col,1.);}`;const cs=(src,ty)=>{const s=g.createShader(ty);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s};const pr=g.createProgram();g.attachShader(pr,cs(v,g.VERTEX_SHADER));g.attachShader(pr,cs(f,g.FRAGMENT_SHADER));g.linkProgram(pr);if(!g.getProgramParameter(pr,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(pr));const uP=g.getUniformLocation(pr,'camPos'),uR=g.getUniformLocation(pr,'camRot'),uRes=g.getUniformLocation(pr,'res'),va=g.createVertexArray();g.bindVertexArray(va);return{render:t=>{g.viewport(0,0,c.width,c.height);g.useProgram(pr);g.bindVertexArray(va);const cy=Math.cos(y),sy=Math.sin(y),cp=Math.cos(p),sp=Math.sin(p),ca=[d*sy*cp,d*sp,d*cy*cp];g.uniform3f(uP,ca[0],ca[1],ca[2]);g.uniformMatrix3fv(uR,!1,[cy,0,sy,-sy*sp,cp,cy*sp,-sy*cp,-sp,cy*cp]);g.uniform2f(uRes,c.width,c.height);g.drawArrays(g.TRIANGLE_STRIP,0,4);},setView:(ny,np,nd)=>{y=ny;p=np;d=nd;},getView:()=>({yaw:y,pitch:p,distance:d}),dispose:()=>{c.removeEventListener('mousedown',md);c.removeEventListener('mousemove',mm);c.removeEventListener('mouseup',mu);c.removeEventListener('wheel',mw);c.removeEventListener('keydown',mk);g.deleteProgram(pr);g.deleteVertexArray(va);}}}
