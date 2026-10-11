import test from 'node:test';
import assert from 'node:assert/strict';
import {pixelAt,markPoint,measuredDistance} from '../femur-lesson/calipers.mjs';
test('pointer coordinates respect CSS scaling and pixel centres',()=>{assert.deepEqual(pixelAt({left:10,top:20,width:512,height:512},266,276,256),[127.5,127.5]);assert.deepEqual(pixelAt({left:10,top:20,width:512,height:512},11,21,256),[0,0]);});
test('pointer marks stay inside the image',()=>{assert.deepEqual(pixelAt({left:0,top:0,width:100,height:100},-5,200,256),[0,255]);});
test('third mark begins a new pair without mutating existing marks',()=>{const points=[[1,2],[3,4]];assert.deepEqual(markPoint(points,[6,7]),[[6,7]]);assert.deepEqual(points,[[1,2],[3,4]]);assert.deepEqual(markPoint([[1,2]],[3,4]),[[1,2],[3,4]]);});
test('two-point distance uses the same endpoint-specific correction as the model proxy',()=>{
  const calibration={tip:1.5,apex:1.5,centre:127.5};
  assert.ok(Math.abs(measuredDistance([[127.5,127.5],[130.5,131.5]],1.25,calibration)-5*1.25/1.5)<1e-12);
  assert.equal(measuredDistance([[0,0]],1.25,calibration),null);
  const a=[127.5+3*1.5,127.5-4*1.5],b=[127.5+6*2,127.5-8*2];
  assert.equal(measuredDistance([a,b],1,{tip:1.5,apex:2,centre:127.5}),5);
});
test('invalid calibration and nonfinite marks fail closed',()=>{for(const [points,pixelMm,calibration] of [[[[0,0],[3,4]],0,{tip:1,apex:1,centre:0}],[[[0,0],[3,4]],1,{tip:0,apex:1,centre:0}],[[[NaN,0],[3,4]],1,{tip:1,apex:1,centre:0}]])assert.throws(()=>measuredDistance(points,pixelMm,calibration));});
