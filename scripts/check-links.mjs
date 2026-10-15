import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const errors=[];let count=0,htmlCount=0;
async function walk(dir){const files=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(full));else files.push(full);}return files;}
for(const file of await walk(root)){
 if(!file.endsWith('.html'))continue;htmlCount++;
 const html=await fs.readFile(file,'utf8'),base=html.match(/name="site-base" content="([^"]+)"/)?.[1]||'/';
 for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
  let target=match[1].replaceAll('&amp;','&');if(/^(https?:|mailto:|data:|#)/.test(target))continue;
  if(/^[A-Za-z]:[\\/]|file:|localhost/.test(target)){errors.push(`${path.relative(root,file)}: local URL ${target}`);continue;}
  target=decodeURIComponent(target.split(/[?#]/)[0]);if(!target)continue;
  let resolved;if(target.startsWith('/')){if(!target.startsWith(base)){errors.push(`${path.relative(root,file)}: URL escapes repository base ${target}`);continue;}resolved=path.join(root,target.slice(base.length));}else resolved=path.resolve(path.dirname(file),target);
  if(resolved!==root&&!resolved.startsWith(root+path.sep)){errors.push(`${file}: escaping target`);continue;}
  try{const stat=await fs.stat(resolved);if(stat.isDirectory())await fs.access(path.join(resolved,'index.html'));count++;}catch{errors.push(`${path.relative(root,file)}: missing target ${target}`);}
 }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Checked ${count} internal links/assets across ${htmlCount} HTML pages. External destinations and source theorem correctness are outside this check.`);
