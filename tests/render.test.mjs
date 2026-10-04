import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,Image} from '@napi-rs/canvas';
import {build} from 'esbuild';
import {layouts,geometry} from '../src/layout.mjs';
const bundled=await build({entryPoints:['src/canvas.ts'],bundle:true,write:false,format:'esm',platform:'browser'});
globalThis.Image=Image;
globalThis.document={createElement(tag){assert.equal(tag,'canvas');const c=createCanvas(1,1);c.toBlob=fn=>fn(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};
const {renderStrip,frameTemplate,canvasBlob}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const sample=createCanvas(100,100);sample.getContext('2d').fillStyle='#de3040';sample.getContext('2d').fillRect(0,0,100,100);
const src=sample.toDataURL('image/png');
test('All layouts export valid PNGs and frame templates leave photo openings transparent',async()=>{
 for(const l of layouts){const g=geometry(l),canvas=await renderStrip(l,Array(l.count).fill(src),{color:'#F6CE46',filter:'original',decoration:'none',frame:null,stickers:[]});
 assert.equal(canvas.width,g.width);assert.equal(canvas.height,g.height);
 const blob=await canvasBlob(canvas),bytes=new Uint8Array(await blob.arrayBuffer());assert.deepEqual(Array.from(bytes.slice(0,8)),[137,80,78,71,13,10,26,10]);
 const templ=frameTemplate(l);for(const s of g.slots){const cx=Math.round(s.x+s.w/2),cy=Math.round(s.y+s.h/2);assert.equal(templ.getContext('2d').getImageData(cx,cy,1,1).data[3],0);assert.equal(canvas.getContext('2d').getImageData(cx,cy,1,1).data[0],222);}
 assert.equal(templ.getContext('2d').getImageData(10,10,1,1).data[3],255);
 }
});
test('B&W filter has equal RGB channels; uploaded overlay and sticker are composited',async()=>{
 const l=layouts[0],g=geometry(l),s=g.slots[0],canvas=await renderStrip(l,Array(l.count).fill(src),{color:'#FFFFFF',filter:'bw',decoration:'none',frame:frameTemplate(l).toDataURL('image/png'),stickers:[{id:'one',src,x:50,y:90,size:10,rotation:0}]});
 const p=canvas.getContext('2d').getImageData(Math.round(s.x+s.w/2),Math.round(s.y+s.h/2),1,1).data;
 assert.equal(p[0],p[1]);assert.equal(p[1],p[2]);
 const st=canvas.getContext('2d').getImageData(Math.round(g.width*.5),Math.round(g.height*.9),1,1).data;assert.equal(st[0],222);
});
