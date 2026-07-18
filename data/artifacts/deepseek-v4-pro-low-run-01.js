export function createPelicanSdf(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
    if (!gl) throw new Error('WebGL2 not supported');
    let lost = false;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { lost = false; });

    const vs = `#version 300 es
out vec2 vUv;
void main(){
    float x=-1.0+float((gl_VertexID&1)<<2);
    float y=-1.0+float((gl_VertexID&2)<<1);
    gl_Position=vec4(x,y,0,1);
    vUv=vec2((x+1.)*.5,(y+1.)*.5);
}`;
    const fs = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_cam;
out vec4 fragColor;
float gMat;

float sdS(vec3 p,float r){return length(p)-r;}
float sdC(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdT(vec3 p,vec2 t){float q=length(p.xz)-t.x;return length(vec2(q,p.y))-t.y;}
float sdE(vec3 p,vec3 r){return(length(p/r)-1.)*min(min(r.x,r.y),r.z);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
vec3 rotX(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x,c*v.y-s*v.z,s*v.y+c*v.z);}

float map(vec3 p){
    float d=1e10;
    // ground
    float dp=p.y+0.002;
    if(dp<d){d=dp;gMat=1.;}
    // bike constants
    float wR=0.4,wB=0.6;
    vec3 rH=vec3(0.,wR,-wB);
    vec3 fH=vec3(0.,wR,wB);
    vec3 seatPos=vec3(0.,0.9,-0.35);
    vec3 bbPos=vec3(0.,0.35,-0.1);
    vec3 hTop=vec3(0.,0.8,0.55);
    vec3 hBtm=vec3(0.,0.4,0.55);
    // wheels
    vec3 pr=p-rH,pf=p-fH;
    float dt=sdT(pr,vec2(wR-0.05,0.06));
    if(dt<d){d=dt;gMat=3.;}
    dt=sdT(pr,vec2(wR-0.05,0.02));
    if(dt<d){d=dt;gMat=2.;}
    dt=sdT(pf,vec2(wR-0.05,0.06));
    if(dt<d){d=dt;gMat=3.;}
    dt=sdT(pf,vec2(wR-0.05,0.02));
    if(dt<d){d=dt;gMat=2.;}
    // frame tubes
    float dC=sdC(p,bbPos,seatPos,0.03); if(dC<d){d=dC;gMat=2.;}
    dC=sdC(p,bbPos,hBtm,0.03); if(dC<d){d=dC;gMat=2.;}
    dC=sdC(p,seatPos,hTop,0.03); if(dC<d){d=dC;gMat=2.;}
    dC=sdC(p,bbPos,rH,0.03); if(dC<d){d=dC;gMat=2.;}
    dC=sdC(p,rH,seatPos,0.03); if(dC<d){d=dC;gMat=2.;}
    dC=sdC(p,hBtm,fH,0.03); if(dC<d){d=dC;gMat=2.;}
    // handlebar
    dC=sdC(p,hTop,vec3(0.,0.92,0.5),0.03); if(dC<d){d=dC;gMat=2.;}
    dC=sdC(p,vec3(-0.18,0.92,0.5),vec3(0.18,0.92,0.5),0.03); if(dC<d){d=dC;gMat=2.;}
    dC=sdC(p,vec3(-0.18,0.92,0.5),vec3(-0.25,0.88,0.4),0.03); if(dC<d){d=dC;gMat=2.;}
    dC=sdC(p,vec3(0.18,0.92,0.5),vec3(0.25,0.88,0.4),0.03); if(dC<d){d=dC;gMat=2.;}
    // seat
    float dB=sdE(p-(seatPos+vec3(0.,0.04,0.)),vec3(0.12,0.05,0.15)); if(dB<d){d=dB;gMat=4.;}
    // pedals / crank
    float crankA=u_time*3.;
    vec3 rArm=rotX(vec3(0.,-0.1,0.),crankA);
    vec3 lArm=rotX(vec3(0.,-0.1,0.),crankA);
    vec3 rPedBase=bbPos+vec3(0.12,0.,0.)+rArm;
    vec3 lPedBase=bbPos-vec3(0.12,0.,0.)+lArm;
    dC=sdC(p,bbPos+vec3(0.12,0.,0.),rPedBase,0.025); if(dC<d){d=dC;gMat=2.;}
    dC=sdC(p,bbPos-vec3(0.12,0.,0.),lPedBase,0.025); if(dC<d){d=dC;gMat=2.;}
    dB=sdE(p-rPedBase,vec3(0.05,0.02,0.09)); if(dB<d){d=dB;gMat=4.;}
    dB=sdE(p-lPedBase,vec3(0.05,0.02,0.09)); if(dB<d){d=dB;gMat=4.;}

    // pelican
    vec3 pelPos=vec3(0.,1.25,-0.35);
    float lean=0.35;
    vec3 pl=rotX(p-pelPos,-lean);
    // body
    float body=sdE(pl-vec3(0.,0.2,0.),vec3(0.25,0.3,0.35));
    if(body<d){d=body;gMat=5.;}
    // head
    float head=sdS(pl-vec3(0.,0.4,0.35),0.15);
    if(head<d){d=head;gMat=5.;}
    // beak
    float beak=sdC(pl,vec3(0.,0.35,0.35),vec3(0.,0.2,0.65),0.055);
    if(beak<d){d=beak;gMat=6.;}
    // throat pouch
    float pouch=sdE(pl-vec3(0.,0.15,0.45),vec3(0.13,0.09,0.18));
    if(pouch<d){d=pouch;gMat=6.;}
    // right eye
    float eye=sdS(pl-vec3(0.06,0.46,0.35),0.04);
    if(eye<d){d=eye;gMat=7.;}
    // left eye
    eye=sdS(pl-vec3(-0.06,0.46,0.35),0.04);
    if(eye<d){d=eye;gMat=7.;}
    // wings
    float wing=sdE(pl-vec3(0.3,0.2,0.05),vec3(0.1,0.1,0.25));
    if(wing<d){d=wing;gMat=5.;}
    wing=sdE(pl-vec3(-0.3,0.2,0.05),vec3(0.1,0.1,0.25));
    if(wing<d){d=wing;gMat=5.;}
    // legs
    vec3 localHipR=vec3(0.06,-0.1,0.);
    vec3 hipR=pelPos+rotX(localHipR,lean);
    float legR=sdC(p,hipR,rPedBase,0.03);
    if(legR<d){d=legR;gMat=5.;}
    vec3 localHipL=vec3(-0.06,-0.1,0.);
    vec3 hipL=pelPos+rotX(localHipL,lean);
    legR=sdC(p,hipL,lPedBase,0.03);
    if(legR<d){d=legR;gMat=5.;}
    // feet (small boxes on pedals)
    float footR=sdE(p-(rPedBase+vec3(0.,0.03,0.)),vec3(0.04,0.03,0.08));
    if(footR<d){d=footR;gMat=5.;}
    footR=sdE(p-(lPedBase+vec3(0.,0.03,0.)),vec3(0.04,0.03,0.08));
    if(footR<d){d=footR;gMat=5.;}
    return d;
}
vec3 getNormal(vec3 p){vec2 e=vec2(0.001,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
void main(){
    vec2 uv=gl_FragCoord.xy/u_res;
    vec2 p=(2.*gl_FragCoord.xy-u_res)/u_res.y;
    vec3 fwd=normalize(-u_cam);
    vec3 right=normalize(cross(vec3(0,1,0),fwd));
    vec3 up=cross(fwd,right);
    float fov=1./tan(radians(25.));
    vec3 rd=normalize(p.x*right+p.y*up+fwd*fov);
    vec3 ro=u_cam;
    float t=0.;
    bool hit=false;
    for(int i=0;i<120;i++){
        vec3 pos=ro+rd*t;
        float d=map(pos);
        if(d<0.001){hit=true;break;}
        t+=d;
        if(t>30.)break;
    }
    vec3 col=vec3(0.8,0.85,1.)*0.4;
    if(hit){
        vec3 pos=ro+rd*t;
        vec3 n=getNormal(pos);
        vec3 ld=normalize(vec3(0.8,1.,0.6));
        float diff=clamp(dot(n,ld),0.,1.);
        float amb=0.15;
        float spec=pow(clamp(dot(reflect(rd,n),ld),0.,1.),32.)*0.5;
        // soft shadow
        float sh=1.;
        for(int j=1;j<12;j++){
            vec3 sp=pos+n*0.01+ld*float(j)*0.05;
            float sd=map(sp);
            sh=min(sh,15.*sd/float(j));
        }
        sh=clamp(sh,0.,1.);
        vec3 base;
        float m=gMat;
        if(m==1.) base=vec3(0.25,0.35,0.25);
        else if(m==2.) base=vec3(0.4,0.4,0.45);
        else if(m==3.) base=vec3(0.1,0.08,0.08);
        else if(m==4.) base=vec3(0.2,0.15,0.1);
        else if(m==5.) base=vec3(0.95,0.9,0.8);
        else if(m==6.) base=vec3(0.9,0.7,0.3);
        else if(m==7.) base=vec3(0.1,0.1,0.1);
        else base=vec3(0.5);
        float ao=clamp(1.-t*0.08,0.,1.);
        col=base*(amb+diff*sh)*ao+spec*sh*vec3(1.);
    }else{
        col=mix(col,vec3(0.5,0.7,1.),clamp(rd.y*2.,0.,1.));
    }
    fragColor=vec4(col,1.);
}`;

    function compileShader(type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(sh);
            gl.deleteShader(sh);
            throw new Error(`Shader compile error: ${log}`);
        }
        return sh;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Program link error');
    gl.useProgram(prog);
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uCam = gl.getUniformLocation(prog, 'u_cam');
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let yaw = 0.7, pitch = 0.35, distance = 6.0;
    let pointerDown = false, lastX, lastY;
    let activePointers = new Map();
    let pinchStartDist = null;

    const onPointerDown = e => {
        canvas.focus();
        e.preventDefault();
        if (e.pointerType === 'mouse') {
            if (e.button === 0) { pointerDown = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); }
        } else {
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (activePointers.size === 2) {
                const it = activePointers.values();
                const a = it.next().value, b = it.next().value;
                const dx = a.x - b.x, dy = a.y - b.y;
                pinchStartDist = Math.sqrt(dx*dx + dy*dy);
            }
        }
    };
    const onPointerMove = e => {
        if (pointerDown && e.pointerType === 'mouse') {
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            yaw += dx * 0.005;
            pitch += dy * 0.005;
            pitch = Math.max(-Math.PI/2+0.001, Math.min(Math.PI/2-0.001, pitch));
            lastX = e.clientX; lastY = e.clientY;
        } else if (activePointers.size > 0) {
            const old = activePointers.get(e.pointerId);
            if (old) {
                activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (activePointers.size === 1) {
                    const dx = e.clientX - lastX, dy = e.clientY - lastY;
                    yaw += dx * 0.005;
                    pitch += dy * 0.005;
                    pitch = Math.max(-Math.PI/2+0.001, Math.min(Math.PI/2-0.001, pitch));
                    lastX = e.clientX; lastY = e.clientY;
                } else if (activePointers.size === 2 && pinchStartDist !== null) {
                    const it = activePointers.values();
                    const a = it.next().value, b = it.next().value;
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const curDist = Math.sqrt(dx*dx + dy*dy);
                    distance *= pinchStartDist / curDist;
                    distance = Math.max(2.0, Math.min(15.0, distance));
                    pinchStartDist = curDist;
                }
            }
        }
    };
    const onPointerUp = e => {
        if (e.pointerType === 'mouse') {
            pointerDown = false; canvas.releasePointerCapture(e.pointerId);
        } else {
            activePointers.delete(e.pointerId);
            if (activePointers.size < 2) pinchStartDist = null;
        }
    };
    const onPointerCancel = e => {
        if (e.pointerType === 'mouse') pointerDown = false;
        activePointers.delete(e.pointerId);
        if (activePointers.size < 2) pinchStartDist = null;
    };
    const onWheel = e => {
        e.preventDefault();
        distance *= Math.exp(-e.deltaY * 0.001);
        distance = Math.max(2.0, Math.min(15.0, distance));
    };
    const onKeyDown = e => {
        switch(e.key) {
            case 'ArrowLeft': yaw -= 0.05; break;
            case 'ArrowRight': yaw += 0.05; break;
            case 'ArrowUp': pitch += 0.05; break;
            case 'ArrowDown': pitch -= 0.05; break;
            case '+': case '=': distance = Math.max(2.0, distance - 0.5); break;
            case '-': case '_': distance = Math.min(15.0, distance + 0.5); break;
        }
        pitch = Math.max(-Math.PI/2+0.001, Math.min(Math.PI/2-0.001, pitch));
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('keydown', onKeyDown);
    canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';

    function render(time) {
        if (lost || gl.isContextLost()) return;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, time);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cx = distance * cp * cy;
        const cy_ = distance * sp;
        const cz = distance * cp * sy;
        gl.uniform3f(uCam, cx, cy_, cz);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function setView(y, p, d) {
        yaw = y; pitch = p; distance = d;
        pitch = Math.max(-Math.PI/2+0.001, Math.min(Math.PI/2-0.001, pitch));
        distance = Math.max(2.0, Math.min(15.0, distance));
    }
    function getView() {
        return { yaw, pitch, distance };
    }
    function dispose() {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerCancel);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('keydown', onKeyDown);
        gl.deleteProgram(prog);
        gl.deleteVertexArray(vao);
    }

    return { render, setView, getView, dispose };
}
