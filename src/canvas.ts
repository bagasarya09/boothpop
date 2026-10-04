import { geometry } from './layout.mjs';
export type Layout={id:string;count:number;cols:number;label:string[];printSize?:string;cmW?:number;cmH?:number};
export type Sticker={id:string;src:string;x:number;y:number;size:number;rotation:number};
export type Options={color:string;filter:string;decoration:string;frame:string|null;stickers:Sticker[]};
export const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Image decode failed'));img.src=src;});
export function canvasBlob(canvas:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function filteredImage(img:HTMLImageElement,w:number,h:number,filter:string){
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d')!;
 const scale=Math.max(w/img.width,h/img.height);
 x.drawImage(img,(w-img.width*scale)/2,(h-img.height*scale)/2,img.width*scale,img.height*scale);
 if(filter!=='original'){const data=x.getImageData(0,0,w,h),p=data.data;
 for(let i=0;i<p.length;i+=4){const r=p[i],g=p[i+1],b=p[i+2];
 if(filter==='bw'){p[i]=p[i+1]=p[i+2]=.299*r+.587*g+.114*b;}
 else {p[i]=Math.min(255,.393*r+.769*g+.189*b);p[i+1]=Math.min(255,.349*r+.686*g+.168*b);p[i+2]=Math.min(255,.272*r+.534*g+.131*b);}
 }x.putImageData(data,0,0);}return c;
}
export async function renderStrip(layout:Layout,photos:string[],opts:Options){
 const g=geometry(layout),c=document.createElement('canvas');c.width=g.width;c.height=g.height;
 const x=c.getContext('2d')!;x.fillStyle=opts.color;x.fillRect(0,0,c.width,c.height);
 for(let i=0;i<g.slots.length;i++){const s=g.slots[i];if(photos[i]){const img=await loadImage(photos[i]);x.drawImage(filteredImage(img,Math.round(s.w),Math.round(s.h),opts.filter),s.x,s.y,s.w,s.h);}else{x.fillStyle='#e9e5dc';x.fillRect(s.x,s.y,s.w,s.h);}}
 if(opts.decoration!=='none'){x.strokeStyle='#111111';x.fillStyle=opts.decoration==='hearts'?'#F97CC4':'#F6CE46';x.lineWidth=3;
 for(let i=0;i<g.slots.length;i++){const s=g.slots[i],cx=i%2?s.x+s.w:s.x,cy=s.y+s.h;
 x.save();x.translate(cx,cy);x.beginPath();
 if(opts.decoration==='hearts'){x.moveTo(0,15);x.bezierCurveTo(-50,-15,-25,-50,0,-25);x.bezierCurveTo(25,-50,50,-15,0,15);}
 else {for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,r=k%2?14:32;k?x.lineTo(Math.cos(a)*r,Math.sin(a)*r):x.moveTo(Math.cos(a)*r,Math.sin(a)*r);}x.closePath();}
 x.fill();x.stroke();x.restore();}}
 x.fillStyle='#111111';x.font='bold '+Math.round(28*g.scale)+'px sans-serif';x.textAlign='center';x.fillText('BOOTHPOP  /  made of moments',c.width/2,c.height-48*g.scale);
 if(opts.frame){const img=await loadImage(opts.frame);x.drawImage(img,0,0,c.width,c.height);}
 for(const s of opts.stickers){const img=await loadImage(s.src),w=c.width*s.size/100,h=w*img.height/img.width;x.save();x.translate(c.width*s.x/100,c.height*s.y/100);x.rotate(s.rotation*Math.PI/180);x.drawImage(img,-w/2,-h/2,w,h);x.restore();}
 return c;
}
export function frameTemplate(layout:Layout,guide=false){
 const g=geometry(layout),c=document.createElement('canvas');c.width=g.width;c.height=g.height;const x=c.getContext('2d')!;
 x.fillStyle='#FAF8F3';x.fillRect(0,0,c.width,c.height);
 for(const s of g.slots)x.clearRect(s.x,s.y,s.w,s.h);
 if(guide){x.strokeStyle='#111';x.lineWidth=3;for(const s of g.slots){x.strokeRect(s.x,s.y,s.w,s.h);}x.fillStyle='#111';x.font='24px sans-serif';x.fillText('Keep photo openings transparent',48,c.height-48*g.scale);}
 return c;
}
