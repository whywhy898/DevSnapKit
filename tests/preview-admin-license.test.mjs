import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=path.resolve(import.meta.dirname,'..'),cache=new Map();
function load(file){const p=path.resolve(root,file);if(cache.has(p))return cache.get(p).exports;const m={exports:{}};cache.set(p,m);const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','module','exports','crypto',js)(name=>name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(p),name+'.ts'))):require(name),m,m.exports,webcrypto);return m.exports;}
const handler=load('functions/api/verify-license.ts').onRequestPost;
const key='DSK-BOSS-2026-PRO1',secret='qa-preview-license-signing-secret-long-enough';
const post=(url,licenseKey=key,env={},headers={})=>handler({request:new Request(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({licenseKey})}),env});
test('existing branch admin key unlocks only the selected HTTPS preview through real server verification',async()=>{
 const r=await post('https://mockup-templates-v1.devsnapkit.pages.dev/api/verify-license',' dsk-boss-2026-pro1 ');assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');const data=await r.json();assert.equal(data.valid,true);assert.equal(data.serverVerified,true);assert.equal(data.tier,'pro_lifetime');assert.equal(data.licenseKey,key);assert.ok(data.proFeatures.includes('premium_templates'));assert.ok(data.capabilityPolicyVersion);
});
for(const url of ['https://devsnapkit.com/api/verify-license','https://devsnapkit.pages.dev/api/verify-license','https://other.devsnapkit.pages.dev/api/verify-license','https://mockup-templates-v1.devsnapkit.pages.dev.evil.example/api/verify-license','http://mockup-templates-v1.devsnapkit.pages.dev/api/verify-license'])test('fixed admin key does not bypass verification on '+new URL(url).origin,async()=>{const r=await post(url,key,{DSK_SERVER_SECRET:secret},{Origin:'https://mockup-templates-v1.devsnapkit.pages.dev','X-Forwarded-Host':'mockup-templates-v1.devsnapkit.pages.dev'});assert.equal((await r.json()).valid,false);});
test('preview exception cannot authorize a different key or weaken normal signature verification',async()=>{const r=await post('https://mockup-templates-v1.devsnapkit.pages.dev/api/verify-license','DSK-BOSS-2026-PRO2',{DSK_SERVER_SECRET:secret});assert.equal((await r.json()).valid,false);const missing=await post('https://devsnapkit.com/api/verify-license');assert.equal(missing.status,503);});
test('client still requests server verification for the fixed-format preview key',async()=>{const api=load('src/license.ts');const original=globalThis.fetch;let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'/api/verify-license');assert.equal(JSON.parse(options.body).licenseKey,key);return new Response(JSON.stringify({valid:false,error:'Denied by actual server'}));};try{assert.equal((await api.verifyLicenseWithServer(key)).valid,false);assert.equal(calls,1);}finally{globalThis.fetch=original;}});
