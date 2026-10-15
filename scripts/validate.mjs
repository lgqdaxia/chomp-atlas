import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {applyBite,equivalentBoxes,permuteBoxes,isPresent} from '../src/geometry.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const atlas=JSON.parse(await fs.readFile(path.join(root,'data/atlas.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(root,'data/proof-sources.json'),'utf8'));
const errors=[];const check=(ok,message)=>{if(!ok)errors.push(message);};
const positions=new Map(atlas.positions.map(p=>[p.id,p])),proofs=new Map(atlas.proofs.map(p=>[p.id,p]));
check(positions.size===atlas.positions.length,'Duplicate position IDs');check(proofs.size===atlas.proofs.length,'Duplicate proof IDs');
for(const p of atlas.positions){
 check(['P','N','U'].includes(p.outcome),`${p.id}: invalid outcome`);check(p.domain==='N3',`${p.id}: original-domain registry must use N3`);
 check(Array.isArray(p.boxes)&&p.boxes.length>0,`${p.id}: missing geometry`);check(isPresent([0,0,0],{boxes:p.boxes}),`${p.id}: poison must remain`);
 for(const id of p.proofs)check(proofs.has(id),`${p.id}: unknown proof ${id}`);
 if(p.outcome!=='U')check(p.proofs.some(id=>proofs.get(id)?.status==='proved'),`${p.id}: P/N requires a proved source`);
 for(const c of p.coverage||[]){if(c.target)check(positions.has(c.target),`${p.id}: coverage target ${c.target} not registered`);if(c.proof)check(proofs.has(c.proof),`${p.id}: coverage proof missing`);}
}
for(const e of atlas.moves){
 const from=positions.get(e.from),to=positions.get(e.to);check(!!from&&!!to,`${e.id}: dangling move`);check(proofs.has(e.proof),`${e.id}: move evidence missing`);if(!from||!to)continue;
 try{const successor=applyBite(from.boxes,e.point),mapped=permuteBoxes(successor,e.permutation||[0,1,2]);check(equivalentBoxes(mapped,to.boxes),`${e.id}: actual move geometry does not equal target`);}catch(error){errors.push(`${e.id}: ${error.message}`);}
 if(from.outcome==='P')check(to.outcome!=='P',`${e.id}: P cannot have P successor`);
}
for(const p of atlas.positions.filter(p=>p.outcome==='N'))check(atlas.moves.some(e=>e.from===p.id&&positions.get(e.to)?.outcome==='P'),`${p.id}: N needs a registered actual P witness`);
for(const p of atlas.proofs){for(const d of p.dependencies)check(proofs.has(d),`${p.id}: missing dependency ${d}`);try{const md=await fs.readFile(path.join(root,p.bodyFile),'utf8');check(!/(?<![A-Za-z])[A-Za-z]:[\\/]|file:\/\/|localhost|127\.0\.0\.1/.test(md),`${p.id}: local path in public proof`);}catch{errors.push(`${p.id}: missing body`);}}
for(const f of manifest.files){try{const buffer=await fs.readFile(path.join(root,f.file));check(buffer.length<=5*1024*1024,`${f.file}: exceeds curated file size`);check(crypto.createHash('sha256').update(buffer).digest('hex')===f.sha256,`${f.file}: mirror hash mismatch`);check(!path.isAbsolute(f.sourcePath)&&!f.sourcePath.includes('..'),`${f.file}: source path must be project-relative`);}catch{errors.push(`${f.file}: missing mirror`);}}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Registry validated: ${positions.size} positions, ${atlas.moves.length} exact moves, ${proofs.size} proofs, ${manifest.files.length} mirrored source files. This validates structure/geometry, not the truth of mathematical proofs.`);
