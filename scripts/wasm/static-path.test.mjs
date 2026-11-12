import test from 'node:test';
import assert from 'node:assert/strict';
import {staticPath} from './static-path.mjs';
test('directory URLs with trailing slash serve legitimate child paths',()=>assert.equal(staticPath('/sample/demo/','/benchmark.html'),'/sample/demo/benchmark.html'));
test('normal directory roots serve child paths',()=>assert.equal(staticPath('/sample/demo','/worker.mjs'),'/sample/demo/worker.mjs'));
test('parent traversal is rejected',()=>assert.equal(staticPath('/sample/demo/','/../../private'),null));
test('sibling prefix is rejected',()=>assert.equal(staticPath('/sample/demo','/../demo-other/private'),null));
test('an allowlisted route cannot traverse to another file inside the root',()=>assert.equal(staticPath('/sample/demo','/demo/../.git'),null));
