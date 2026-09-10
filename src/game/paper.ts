import type { Card } from './engine.js';
import { drawBack, drawFront } from './cards.js';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export const PAPER = { width: 300, height: 420, viewportWidth: 420, viewportHeight: 550 };
export interface PaperPoint { x:number; y:number; z:number; normal:number }
/** Cylindrical curl around an oblique fold line. Local coordinates mirror per corner. */
export function deformPaper(x:number,y:number,progress:number,corner:Corner,direction=.5):PaperPoint{
  const w=PAPER.width,h=PAPER.height,sx=corner.endsWith('r')?-1:1,sy=corner.startsWith('b')?-1:1;
  const qx=sx<0?w-x:x,qy=sy<0?h-y:y;
  const angle=.35+Math.max(0,Math.min(1,direction))*.88,nx=Math.cos(angle),ny=Math.sin(angle);
  const finish=Math.max(0,Math.min(1,(progress-.72)/.28)),turn=finish*finish*(3-2*finish);
  const bend=progress*(1-turn),radius=22+bend*20,reach=w*nx+h*ny,line=bend*(reach*.45+Math.PI*radius*.5);
  const t=Math.max(0,line-qx*nx-qy*ny),theta=Math.min(Math.PI,t/radius);
  const shift=t-radius*Math.sin(theta)+Math.max(0,t-Math.PI*radius),z=radius*(1-Math.cos(theta));
  const cx=x+sx*nx*shift-w/2,rotation=turn*Math.PI,cos=Math.cos(rotation),sin=Math.sin(rotation);
  return{x:w/2+cx*cos+sx*z*sin,y:y+sy*ny*shift,z:-sx*cx*sin+z*cos+150*sin,normal:Math.cos(theta)*cos-sx*nx*Math.sin(theta)*sin};
}
export function resistedProgress(raw:number,resistance:number):number{
  const p=Math.max(0,Math.min(1,raw));return p/(resistance+(1-resistance)*p);
}
export function springStep(position:number,velocity:number,target:number,seconds:number,stiffness:number):{position:number;velocity:number}{
  const dt=Math.min(1/30,Math.max(0,seconds)),damping=2*Math.sqrt(stiffness)*.82;
  const v=velocity+((target-position)*stiffness-velocity*damping)*dt;
  return{position:Math.max(0,Math.min(1,position+v*dt)),velocity:v};
}
export const PAPER_VERTEX=`
attribute vec2 a_uv;
uniform mediump float u_progress;
uniform vec2 u_corner;
uniform float u_direction;
uniform mediump float u_shadow;
varying mediump vec2 v_uv;
varying mediump float v_normal;
varying mediump float v_height;
void main(){
  vec2 size=vec2(300.,420.);vec2 p=a_uv*size;
  vec2 q=mix(p,size-p,u_corner);
  float angle=.35+u_direction*.88;vec2 n=vec2(cos(angle),sin(angle));
  float turn=smoothstep(.72,1.,u_progress);float bend=u_progress*(1.-turn);
  float r=22.+bend*20.;float reach=dot(size,n);
  float line=bend*(reach*.45+3.14159265*r*.5);
  float t=max(0.,line-dot(q,n));float theta=min(3.14159265,t/r);
  float shift=t-r*sin(theta)+max(0.,t-3.14159265*r);
  vec2 cornerSign=vec2(1.)-2.*u_corner;p+=cornerSign*n*shift;
  float z=r*(1.-cos(theta));
  float rotation=turn*3.14159265;float c=cos(rotation);float s=sin(rotation);float cx=p.x-150.;
  p.x=150.+cx*c+cornerSign.x*z*s;z=-cornerSign.x*cx*s+z*c+150.*s;
  v_normal=cos(theta)*c-cornerSign.x*n.x*sin(theta)*s;v_height=z;v_uv=a_uv;
  if(u_shadow>.5){p+=vec2(4.,6.)+z*vec2(.07,.10);z=-2.;}
  vec2 centered=p-size*.5;
  float perspective=1.-z/2400.;
  gl_Position=vec4(centered.x/210.,-centered.y/275.,-z/600.,perspective);
}`;
export const PAPER_FRAGMENT=`
precision mediump float;
uniform sampler2D u_front;
uniform sampler2D u_back;
uniform mediump float u_shadow;
uniform mediump float u_progress;
varying mediump vec2 v_uv;
varying mediump float v_normal;
varying mediump float v_height;
void main(){
  vec2 edge=min(v_uv,vec2(1.)-v_uv)*vec2(300.,420.);
  if(length(max(vec2(7.)-edge,0.))>7.)discard;
  if(u_shadow>.5){gl_FragColor=vec4(.005,.012,.015,.25/(1.+v_height*.025));return;}
  bool front=!gl_FrontFacing;
  vec4 tex=front?texture2D(u_front,vec2(1.-v_uv.x,v_uv.y)):texture2D(u_back,v_uv);
  float diffuse=.76+.24*abs(v_normal);float highlight=pow(1.-abs(v_normal),4.)*.075;
  float edgeLight=1.-smoothstep(.4,1.5,min(edge.x,edge.y));
  gl_FragColor=vec4(tex.rgb*diffuse+highlight+edgeLight*.045,1.);
}`;

function texture(card?:Card):HTMLCanvasElement{
  const canvas=document.createElement('canvas');canvas.width=300;canvas.height=420;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Card texture unavailable');
  if(card)drawFront(ctx,card,300,420);else drawBack(ctx,300,420);return canvas;
}
/** One retained GL context, one static 36×50 mesh, two textures and two draw calls.
 * The Canvas path reuses the same deformation, at lower tessellation. No perpetual RAF. */
export class PaperRenderer{
  private canvas:HTMLCanvasElement;
  private gl:WebGLRenderingContext|null=null;
  private ctx:CanvasRenderingContext2D|null=null;
  private program:WebGLProgram|null=null;
  private buffers:WebGLBuffer[]=[];
  private textures:WebGLTexture[]=[];
  private uniforms=new Map<string,WebGLUniformLocation|null>();
  private front:HTMLCanvasElement|null=null;
  private back:HTMLCanvasElement;
  private count=0;
  private last:{progress:number;corner:Corner;direction:number}={progress:0,corner:'br',direction:.5};
  mode:'webgl'|'canvas'='canvas';
  constructor(private host:HTMLElement){
    this.canvas=host.querySelector('canvas')!;this.back=texture();
    try{this.setupGL();}catch(error){console.warn('Paper GL unavailable; using Canvas',error);this.fallback();}
    this.resize();
  }
  private uniform(name:string):WebGLUniformLocation|null{return this.uniforms.get(name)??null;}
  private setupGL():void{
    const gl=this.canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'low-power',failIfMajorPerformanceCaveat:true});
    if(!gl)throw new Error('No WebGL');this.gl=gl;
    const compile=(type:number,code:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message??'Shader compile failed');}return shader;};
    const vertex=compile(gl.VERTEX_SHADER,PAPER_VERTEX),fragment=compile(gl.FRAGMENT_SHADER,PAPER_FRAGMENT),program=gl.createProgram()!;
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);this.program=program;
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)??'Shader link failed');
    gl.useProgram(program);
    for(const name of ['u_progress','u_corner','u_direction','u_shadow','u_front','u_back'])this.uniforms.set(name,gl.getUniformLocation(program,name));
    const cols=36,rows=50,vertices:number[]=[],indices:number[]=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)vertices.push(x/cols,y/rows);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
    const vb=gl.createBuffer()!,ib=gl.createBuffer()!;this.buffers=[vb,ib];
    gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);this.count=indices.length;
    const location=gl.getAttribLocation(program,'a_uv');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
    for(let unit=0;unit<2;unit++){const tex=gl.createTexture()!;this.textures.push(tex);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
    gl.uniform1i(this.uniform('u_front'),0);gl.uniform1i(this.uniform('u_back'),1);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    this.canvas.addEventListener('webglcontextlost',this.lost);this.mode='webgl';
  }
  private lost=(event:Event)=>{event.preventDefault();this.fallback();this.resize();this.render(this.last.progress,this.last.corner,this.last.direction);};
  private fallback():void{
    this.release();const replacement=document.createElement('canvas');replacement.id='peek-canvas';replacement.setAttribute('aria-hidden','true');this.canvas.replaceWith(replacement);this.canvas=replacement;this.ctx=replacement.getContext('2d');this.mode='canvas';
  }
  resize():void{
    const lowPower=navigator.hardwareConcurrency>0&&navigator.hardwareConcurrency<=4;
    const dpr=Math.min(lowPower?1.5:2,window.devicePixelRatio||1);
    this.canvas.width=Math.round(PAPER.viewportWidth*dpr);this.canvas.height=Math.round(PAPER.viewportHeight*dpr);
    this.gl?.viewport(0,0,this.canvas.width,this.canvas.height);
    this.ctx?.setTransform(dpr,0,0,dpr,0,0);
  }
  setCard(card:Card):void{
    this.front=texture(card);const gl=this.gl;
    if(gl)for(const [unit,source]of [this.front,this.back].entries()){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.textures[unit]!);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
  }
  render(progress:number,corner:Corner,direction=.5):void{
    this.last={progress,corner,direction};this.host.dataset.renderer=this.mode;
    const gl=this.gl;
    if(gl){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(this.uniform('u_progress'),progress);gl.uniform2f(this.uniform('u_corner'),corner.endsWith('r')?1:0,corner.startsWith('b')?1:0);gl.uniform1f(this.uniform('u_direction'),direction);
      gl.uniform1f(this.uniform('u_shadow'),1);gl.depthMask(false);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);gl.depthMask(true);gl.uniform1f(this.uniform('u_shadow'),0);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);
    }else this.drawCanvas(progress,corner,direction);
  }
  private drawCanvas(progress:number,corner:Corner,direction:number):void{
    const ctx=this.ctx;if(!ctx||!this.front)return;ctx.clearRect(0,0,420,550);
    if(progress<.001||progress>.999){ctx.drawImage(progress>.999?this.front:this.back,60,65,300,420);return;}
    const cols=12,rows=18,vertices:{x:number;y:number;z:number;u:number;v:number;normal:number}[]=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const p=deformPaper(x/cols*300,y/rows*420,progress,corner,direction),perspective=1-p.z/2400;vertices.push({...p,x:(p.x-150)/perspective+210,y:(p.y-210)/perspective+275,u:x/cols*300,v:y/rows*420});}
    const triangles:number[][]=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;triangles.push([a,b,a+1],[a+1,b,b+1]);}
    triangles.sort((a,b)=>a.reduce((sum,i)=>sum+vertices[i]!.z,0)-b.reduce((sum,i)=>sum+vertices[i]!.z,0));
    for(const ids of triangles){let [a,b,c]=ids.map(i=>vertices[i]!) as [typeof vertices[number],typeof vertices[number],typeof vertices[number]];
      const front=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0;
      if(front){a={...a,u:300-a.u};b={...b,u:300-b.u};c={...c,u:300-c.u};}
      const det=a.u*(b.v-c.v)+b.u*(c.v-a.v)+c.u*(a.v-b.v);if(Math.abs(det)<.001)continue;
      const matrix=(key:'x'|'y')=>[(a[key]*(b.v-c.v)+b[key]*(c.v-a.v)+c[key]*(a.v-b.v))/det,(a[key]*(c.u-b.u)+b[key]*(a.u-c.u)+c[key]*(b.u-a.u))/det,(a[key]*(b.u*c.v-c.u*b.v)+b[key]*(c.u*a.v-a.u*c.v)+c[key]*(a.u*b.v-b.u*a.v))/det];
      const mx=matrix('x'),my=matrix('y');ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();ctx.transform(mx[0]!,my[0]!,mx[1]!,my[1]!,mx[2]!,my[2]!);ctx.drawImage(front?this.front:this.back,0,0);ctx.fillStyle=`rgba(0,0,0,${(1-Math.abs((a.normal+b.normal+c.normal)/3))*.22})`;ctx.fillRect(0,0,300,420);ctx.restore();
    }
  }
  private release():void{const gl=this.gl;if(gl){for(const buffer of this.buffers)gl.deleteBuffer(buffer);for(const tex of this.textures)gl.deleteTexture(tex);if(this.program)gl.deleteProgram(this.program);}this.canvas.removeEventListener('webglcontextlost',this.lost);this.gl=null;this.program=null;this.buffers=[];this.textures=[];this.uniforms.clear();}
  dispose():void{this.release();this.front=null;}
}
