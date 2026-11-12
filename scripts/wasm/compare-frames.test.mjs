import test from 'node:test';
import assert from 'node:assert/strict';
import {compareFrames} from './compare-frames.mjs';
function frame(value=0){return {width:1,height:1,rgba:new Uint8Array([0,0,0,255]),arrays:Object.fromEntries(['outer','core','shell','bone','metal','attenuation'].map(k=>[k,new Float64Array([value])])),invalidCount:0,invalidRays:[]};}
test('identical complete frame passes',()=>assert.equal(compareFrames(frame(),frame()).ok,true));
test('pixel difference fails despite raw equality',()=>{const b=frame();b.rgba[0]=1;assert.equal(compareFrames(frame(),b).ok,false);});
test('declared absolute tolerance boundary passes',()=>assert.equal(compareFrames(frame(0),frame(1e-9)).ok,true));
test('beyond declared tolerance fails',()=>assert.equal(compareFrames(frame(0),frame(1.0001e-9)).ok,false));
test('invalid decision change fails',()=>{const b=frame();b.invalidCount=1;b.invalidRays=[{row:0,col:0}];assert.equal(compareFrames(frame(),b).ok,false);});
test('nonfinite mismatch fails',()=>assert.equal(compareFrames(frame(0),frame(NaN)).ok,false));
test('matching invalid NaNs pass',()=>{const a=frame(NaN),b=frame(NaN);for(const f of [a,b]){f.invalidCount=1;f.invalidRays=[{row:0,col:0}];f.rgba=new Uint8Array([255,0,255,255]);}assert.equal(compareFrames(a,b).ok,true);});
test('missing raw channel fails',()=>{const b=frame();delete b.arrays.metal;assert.equal(compareFrames(frame(),b).ok,false);});
test('shape difference fails',()=>{const b=frame();b.width=2;assert.equal(compareFrames(frame(),b).ok,false);});
