import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const nodeRequire=createRequire(import.meta.url);
// This workspace's lucide package marks its CJS entry as type:module. Evaluate
// that actual CJS bundle with its intended module bindings for SSR assertions.
const packages=new Map();
function dependency(name){
  if(name!=='lucide-react')return nodeRequire(name);
  if(packages.has(name))return packages.get(name);
  const mod={exports:{}};packages.set(name,mod.exports);
  vm.runInNewContext('(function(module,exports,require){'+fs.readFileSync(nodeRequire.resolve(name),'utf8')+'\n})(module,exports,require)',{module:mod,exports:mod.exports,require:nodeRequire});
  packages.set(name,mod.exports);return mod.exports;
}
export function createTypeScriptLoader(root) {
  const cache=new Map();
  const load=file=>{
    let resolved=path.resolve(root,file);
    if(!path.extname(resolved))resolved=['.ts','.tsx'].map(ext=>resolved+ext).find(p=>fs.existsSync(p))||resolved;
    if(resolved.endsWith('.css'))return {};
    if(cache.has(resolved))return cache.get(resolved).exports;
    const mod={exports:{}};cache.set(resolved,mod);
    const source=ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    vm.runInNewContext(source,{module:mod,exports:mod.exports,require:name=>name.startsWith('.')?load(path.resolve(path.dirname(resolved),name)):dependency(name),structuredClone,crypto:globalThis.crypto,console,URL,Math,Number,Set,Map,JSON,Intl});
    return mod.exports;
  };
  return load;
}
