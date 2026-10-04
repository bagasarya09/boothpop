import test from 'node:test';
import assert from 'node:assert/strict';
import {layouts,geometry} from '../src/layout.mjs';
test('Every photo slot fits its canvas with no overlaps',()=>{
 for(const l of layouts){const g=geometry(l);assert.equal(g.slots.length,l.count);assert.ok(Math.max(g.width,g.height)>=1800);
 for(const s of g.slots){assert.ok(s.x>=0&&s.y>=0);assert.ok(s.x+s.w<=g.width);assert.ok(s.y+s.h<=g.height-90);if(!l.printSize)assert.ok(Math.abs(s.w/s.h-4/3)<.01);}
 for(let i=0;i<g.slots.length;i++)for(let j=i+1;j<g.slots.length;j++){const a=g.slots[i],b=g.slots[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
 }
});

test('Print layouts preserve reference proportions',()=>{for(const l of layouts.filter(x=>x.printSize)){const g=geometry(l);assert.ok(Math.abs(g.width/g.height-l.cmW/l.cmH)<.002);}});
