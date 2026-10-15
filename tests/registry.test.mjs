import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile(new URL('../data/atlas.json',import.meta.url),'utf8'));
const get=id=>data.positions.find(p=>p.id===id);
test('main open nodes remain unknown; local P never resolves an ancestor automatically',()=>{
 for(const id of ['W','T','A3','A3T','Q123','U3','C11','C12','J','Y7','T2','V50'])assert.equal(get(id).outcome,'U',id);
 assert.equal(get('Pstar20').outcome,'P');assert.equal(get('W25').outcome,'N');
});
test('two distinct A3 meanings are separate nodes with their correct parent',()=>{
 assert.ok(data.moves.some(m=>m.from==='W'&&m.to==='A3'));
 assert.ok(data.moves.some(m=>m.from==='T'&&m.to==='A3T'));
 assert.ok(!data.moves.some(m=>m.from==='T'&&m.to==='A3'));
});
test('the latest Pstar connection retains all three real game moves',()=>{
 for(const [from,to] of [['Y7','T2'],['T2','W25'],['W25','Pstar20']])assert.ok(data.moves.some(m=>m.from===from&&m.to===to));
 assert.ok(!data.moves.some(m=>m.from==='Y7'&&m.to==='Pstar20'));
});
test('P/N and conditional proof states are separate',()=>{
 for(const p of data.positions)assert.ok(['P','N','U'].includes(p.outcome));
 const dependencies=new Map(data.proofs.map(p=>[p.id,p.dependencies]));
 function visit(id,stack=[]){assert.ok(!stack.includes(id),`Proof dependency cycle: ${[...stack,id].join(' -> ')}`);for(const next of dependencies.get(id)||[])visit(next,[...stack,id]);}
 for(const id of dependencies.keys())visit(id);
});
