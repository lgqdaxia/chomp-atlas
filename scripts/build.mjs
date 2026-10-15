import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from 'marked';
import katex from 'katex';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(project,'dist');
const atlas=JSON.parse(await fs.readFile(path.join(project,'data/atlas.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(project,'data/proof-sources.json'),'utf8'));
let base=process.env.PAGES_BASE||'/';if(!base.startsWith('/'))base='/'+base;if(!base.endsWith('/'))base+='/';
const siteOrigin=process.env.SITE_ORIGIN||'https://lgqdaxia.github.io';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=s=>base+s.replace(/^\//,'');
const links=new Map();
for(const p of atlas.proofs)links.set(p.bodyFile,`proofs/${p.id}/`);
for(const name of ['rules','about','contributing','finite-results'])links.set(`content/pages/${name}.md`,`${name}/`);
for(const f of manifest.files){const file=f.file;links.set(file,file.endsWith('.md')?`sources/${path.basename(file,'.md')}/`:`downloads/${file.replace(/^content\//,'')}`);}
let frontmatter;
function renderMarkdown(text,source){
  let title='';text=text.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/,(_,front)=>{title=(front.match(/^title:\s*(.+)$/m)?.[1]||'').replace(/^["']|["']$/g,'');return '';});frontmatter=title;
  const math=[];
  text=text.replace(/\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\(([^]*?)\\\)/g,(_,display,dollars,inline)=>{const value=display??dollars??inline;const i=math.length;math.push(katex.renderToString(value,{displayMode:inline===undefined,throwOnError:false,trust:false,output:'htmlAndMathml'}));return `KATEXPLACEHOLDER${i}END`;});
  const renderer=new marked.Renderer();
  renderer.html=({text})=>esc(text);
  renderer.link=({href:target,title,tokens})=>{
    let url=target||'',label=marked.Parser.parseInline(tokens,{renderer});
    if(/^https?:\/\//.test(url))return `<a href="${esc(url)}" rel="noopener">${label}</a>`;
    if(url.startsWith('#'))return `<a href="${esc(url)}">${label}</a>`;
    if(url.startsWith('/')&&!/^[A-Za-z]:/.test(url)){url=href(url);}
    else{
      const [raw,fragment]=url.split('#');
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(source),decodeURIComponent(raw)));
      if(links.has(resolved))url=href(links.get(resolved))+(fragment?'#'+fragment:'');
      else return `<span>${label} <small class="muted">（原稿引用，本版未收录）</small></span>`;
    }
    return `<a href="${esc(url)}"${title?` title="${esc(title)}"`:''}>${label}</a>`;
  };
  renderer.image=({text,href:target})=>`<span>${esc(text||'原稿图示')}（参见原始材料）</span>`;
  let html=marked.parse(text,{renderer,gfm:true});
  html=html.replace(/KATEXPLACEHOLDER(\d+)END/g,(_,n)=>math[Number(n)]);
  return html;
}
function header(page){return `<a class="skip" href="#main">跳到正文</a><header class="site-header"><div class="container header-row"><a class="brand" href="${base}"><span class="brand-mark" aria-hidden="true">${'<i></i>'.repeat(9)}</span><span class="brand-name">Chomp Atlas<span>局面 · 咬法 · 证明</span></span></a><nav class="nav" aria-label="主导航">${[['explore','探索图谱'],['proofs','证明库'],['questions','开放问题'],['history','研究快照']].map(([id,label])=>`<a href="${href(id+'/')}"${page===id||(page==='position'&&id==='explore')||(page==='proof'&&id==='proofs')?' aria-current="page"':''}>${label}</a>`).join('')}<a class="github-link" href="https://github.com/lgqdaxia/chomp-atlas" rel="noopener">GitHub ↗</a></nav></div></header>`;}
function footer(){return `<footer class="site-footer"><div class="container footer-row"><div>Gaoqiang Liu · Chomp Atlas<br>本版审定快照 ${esc(atlas.meta.snapshotDate)} · W 仍未判定</div><div><a href="${href('rules/')}">规则与记号</a><a href="${href('about/')}">关于项目</a><a href="${href('contributing/')}">参与贡献</a><a href="${href('finite-results/')}">有限三行成果</a></div></div></footer>`;}
const json=JSON.stringify(atlas).replace(/</g,'\\u003c');
let pages=0;const routes=[];
async function writePage(route,{title,description=atlas.meta.description,page='article',id='',body='',aside=''}){
 const out=path.join(dist,route,'index.html');await fs.mkdir(path.dirname(out),{recursive:true});
 const canonical=siteOrigin+href(route?route+'/':'');
 const content=body?`<div class="article-layout"><article class="prose">${body}</article><aside class="article-aside">${aside||`<h3>继续探索</h3><a href="${href('explore/')}">从 W 出发 →</a><a href="${href('proofs/')}">全部证明 →</a><a href="${href('rules/')}">规则与范围 →</a>`}</aside></div>`:`<div id="app"><div class="loading">正在载入局面图谱…</div></div><noscript><div class="noscript">交互探索需要 JavaScript。可阅读<a href="${href('rules/')}">规则</a>和<a href="${href('about/')}">项目说明</a>；各证明页面正文支持直接阅读。</div></noscript>`;
 const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="site-base" content="${base}"><title>${esc(title)} · Chomp Atlas</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#1d343d"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${esc(title)} · Chomp Atlas"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><link rel="icon" type="image/svg+xml" href="${href('assets/favicon.svg')}"><link rel="stylesheet" href="${href('assets/style.css')}"></head><body data-page="${page}" data-id="${esc(id)}">${header(page)}<main id="main" class="container">${content}</main>${footer()}<script id="atlas-data" type="application/json">${json}</script><script type="module" src="${href('assets/app.js')}"></script></body></html>`;
 await fs.writeFile(out,html);pages++;routes.push(route);
}
await fs.mkdir(dist,{recursive:true});
await fs.mkdir(path.join(dist,'assets'),{recursive:true});
for(const name of ['style.css','app.js','geometry.js'])await fs.copyFile(path.join(project,'src',name),path.join(dist,'assets',name));
await fs.cp(path.join(project,'node_modules/katex/dist'),path.join(dist,'assets/katex'),{recursive:true});
await fs.writeFile(path.join(dist,'assets/atlas.json'),JSON.stringify(atlas,null,2));
await fs.writeFile(path.join(dist,'assets/proof-sources.json'),JSON.stringify(manifest,null,2));
await fs.writeFile(path.join(dist,'assets/favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="9" fill="#1d343d"/><path d="M10 10h8v8h-8zm10 0h8v8h-8zm10 0h8v8h-8zM10 20h8v8h-8zm0 10h8v8h-8z" fill="#f7f6f1"/><path d="M20 20h8v8h-8z" fill="#bb593b"/></svg>');
await writePage('',{title:'从 W 出发的局面与证明图谱',page:'home'});
for(const [route,title] of [['explore','探索图谱'],['proofs','证明库'],['questions','开放问题'],['history','研究快照']])await writePage(route,{title,page:route});
for(const p of atlas.positions)await writePage(`positions/${p.id.toLowerCase()}`,{title:p.name,description:p.summary,page:'position',id:p.id});
for(const name of ['rules','about','contributing','finite-results']){
 const source=`content/pages/${name}.md`,raw=await fs.readFile(path.join(project,source),'utf8'),body=renderMarkdown(raw,source),title=frontmatter||name;
 await writePage(name,{title,body});
}
for(const p of atlas.proofs){
 const raw=await fs.readFile(path.join(project,p.bodyFile),'utf8');let body=renderMarkdown(raw,p.bodyFile);
 body=`<div class="proof-topline"><div class="eyebrow">Proof / ${esc(p.status)}</div><p class="muted small">${esc(p.scope)} · ${esc(p.date||atlas.meta.snapshotDate)}</p></div>`+body;
 const deps=p.dependencies.map(id=>{const q=atlas.proofs.find(p=>p.id===id);return q?`<a href="${href('proofs/'+id+'/')}">${esc(q.title)} →</a>`:'';}).join('');
 const evidence=(p.evidence||[]).map(e=>`<a href="${e.file?href(links.get(e.file)||'downloads/'+e.file.replace(/^content\//,'')):esc(e.url)}">${esc(e.label)} ↗</a>`).join('');
 await writePage(`proofs/${p.id}`,{title:p.title,description:p.summary,page:'proof',id:p.id,body,aside:`<h3>相关局面</h3>${atlas.positions.filter(q=>q.proofs.includes(p.id)).map(q=>`<a href="${href('positions/'+q.id.toLowerCase()+'/')}">${esc(q.name)} →</a>`).join('')}<h3 style="margin-top:22px">本证明依赖</h3>${deps||'<p class="muted">依赖范围见正文。</p>'}<h3 style="margin-top:22px">原稿与核验</h3>${evidence}`});
}
for(const f of manifest.files){
 const source=path.join(project,f.file),target=path.join(dist,'downloads',f.file.replace(/^content\//,''));await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);
 if(f.file.endsWith('.md')){const raw=await fs.readFile(source,'utf8');await writePage(`sources/${path.basename(f.file,'.md')}`,{title:path.basename(f.file,'.md'),body:`<div class="proof-topline"><div class="eyebrow">Source archive / 原稿镜像</div><p class="small muted">公开镜像保留数学内容；原项目路径与版本哈希见来源清单。</p><a href="${href('downloads/'+f.file.replace(/^content\//,''))}" download>下载 Markdown 原稿</a></div>`+renderMarkdown(raw,f.file)});}
}
await fs.writeFile(path.join(dist,'.nojekyll'),'');
await fs.copyFile(path.join(dist,'index.html'),path.join(dist,'404.html'));
await fs.writeFile(path.join(dist,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${siteOrigin}${href('sitemap.xml')}\n`);
await fs.writeFile(path.join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route=>`<url><loc>${siteOrigin}${href(route?route+'/':'')}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${pages} pages; ${atlas.positions.length} positions, ${atlas.moves.length} moves, ${atlas.proofs.length} proof entries; base ${base}`);
