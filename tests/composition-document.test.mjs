import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
const file=new URL('../src/composition/document.ts',import.meta.url);
const source=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
const module={exports:{}};
if(source)vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,structuredClone,Math,Number,Set,JSON});
const api=module.exports;
const plain=x=>JSON.parse(JSON.stringify(x));
test('independent layout has exactly two role placements and no duplicate image sources',()=>{
  assert.equal(typeof api.createIndependentComposition,'function','fixed two-slot composition is not implemented');
  const d=api.createIndependentComposition();
  assert.equal(d.mediaLayout,'independent'); assert.deepEqual(Object.keys(d.placements).sort(),['main','secondary']);
  assert.equal(d.detailVisible,false); assert.equal('images' in d,false); assert.equal('imageSrc' in d,false);
});
test('slot movement clamps rotated image bounds to the canvas unless bleed is explicitly enabled',()=>{
  assert.equal(typeof api.moveCompositionObject,'function','object move is not implemented');
  const d=api.createIndependentComposition(); d.placements.main.rotation=-3;
  const n=api.moveCompositionObject(d,'main',{centerX:3,centerY:-1},{width:1600,height:1200});
  const b=api.placementBounds(n.placements.main,{width:1600,height:1200});
  assert.ok(b.left>=-.01&&b.top>=-.01&&b.right<=1600.01&&b.bottom<=1200.01);
  const bleed=api.moveCompositionObject({...d,allowBleed:true},'main',{centerX:3,centerY:-1},{width:1600,height:1200});
  assert.equal(bleed.placements.main.centerX,3);
});
test('fixed screenshot slots cannot be duplicated but CTA copies get their own identity',()=>{
  assert.equal(typeof api.duplicateCompositionObject,'function','object duplication is not implemented');
  const d=api.createIndependentComposition();
  assert.throws(()=>api.duplicateCompositionObject(d,'main','third'),/fixed|slot/i);
  d.objects=[{id:'cta',kind:'button',name:'CTA',frame:{centerX:.2,centerY:.5,widthRatio:.2,heightRatio:.05,rotation:0},text:'Join',color:'#fff',fill:'#111',fontSize:20,radius:8,padding:12,autoWidth:false,arrow:true}];d.order.push('cta');
  const n=api.duplicateCompositionObject(d,'cta','copy');assert.equal(n.objects.length,2);assert.equal(n.objects[1].id,'copy');assert.notEqual(n.objects[1].frame.centerX,n.objects[0].frame.centerX);
  assert.equal(d.objects.length,1);
});
test('slot visibility and order are immutable, unknown object references are rejected',()=>{
  assert.equal(typeof api.toggleCompositionObject,'function','object visibility is not implemented');
  const d=api.createIndependentComposition(),n=api.toggleCompositionObject(d,'secondary');
  assert.equal(n.detailVisible,true);assert.equal(d.detailVisible,false);
  assert.throws(()=>api.reorderCompositionObject(d,'missing',1),/unknown/i);
  assert.deepEqual(plain(api.reorderCompositionObject(d,'main',1).order),['secondary','main']);
});
test('composition validation blocks invalid geometry rather than painting undefined or infinite styles',()=>{
  assert.equal(typeof api.validateComposition,'function','composition validation is not implemented');
  const d=api.createIndependentComposition();d.placements.main.widthRatio=Infinity;
  assert.throws(()=>api.validateComposition(d),/geometry|placement/i);
});
test('composition validation rejects missing fields, a third screenshot slot, invalid CTA and unknown references',()=>{
  for(const mutate of [d=>delete d.placements.main,d=>d.placements.third=d.placements.main,d=>delete d.placements.main.centerX,d=>d.order.push('unknown')]){
    const d=api.createIndependentComposition();mutate(d);assert.throws(()=>api.validateComposition(d),/geometry|placement|slot|order/i);
  }
  for(const [key,value] of [['fontSize',Infinity],['padding',NaN],['radius',-4]]){
    const d=api.createIndependentComposition();d.objects=[{id:'bad',kind:'button',name:'CTA',frame:{centerX:.5,centerY:.5,widthRatio:.2,heightRatio:.05,rotation:0},text:'Join',color:'#fff',fill:'#111',fontSize:20,radius:8,padding:12,autoWidth:false,arrow:true,[key]:value}];
    assert.throws(()=>api.validateComposition(d),/button|CTA|style/i);
  }
});
test('secondary preparation uses actual visibility and ignores a hidden or unreferenced slot',()=>{
  assert.equal(typeof api.secondaryRequired,'function','effective secondary visibility is not implemented');
  const d=api.createIndependentComposition();d.detailVisible=true;
  assert.equal(api.secondaryRequired(d,'single'),true);assert.equal(api.secondaryRequired({...d,hiddenIds:['secondary']},'single'),false);
  assert.equal(api.secondaryRequired({...d,order:['main']},'single'),false);
});
test('actual CTA bounds detect auto-width labels that escape the canvas',()=>{
  assert.equal(typeof api.boxOutsideCanvas,'function','actual object bounds validation is not implemented');
  assert.equal(api.boxOutsideCanvas({left:80,top:600,right:6469,bottom:664},{left:0,top:0,right:1600,bottom:1200}),true);
  assert.equal(api.boxOutsideCanvas({left:80,top:600,right:324,bottom:664},{left:0,top:0,right:1600,bottom:1200}),false);
});
test('no-bleed scaling caps an oversized rotated frame without losing its aspect ratio',()=>{
  const d=api.createIndependentComposition(),n=api.moveCompositionObject(d,'main',{widthRatio:2,rotation:45},{width:1600,height:1200});
  const b=api.placementBounds(n.placements.main,{width:1600,height:1200});
  assert.ok(b.left>=-.01&&b.top>=-.01&&b.right<=1600.01&&b.bottom<=1200.01,'rotated frame remains inside canvas');
  assert.ok(Math.abs(n.placements.main.widthRatio/n.placements.main.heightRatio-2/.7)<.0001);
});
test('graphic and text objects cannot share an identity in the global drawing order',()=>{
  const d=api.createIndependentComposition();d.objects=[{id:'title',kind:'shape',shape:'rect',name:'Panel',fill:'#fff',frame:d.placements.main}];d.order.push('title');
  assert.throws(()=>api.validateComposition(d,['title']),/identity|collision/i);
  assert.throws(()=>api.validateComposition(api.createIndependentComposition(),['main']),/identity|collision/i);
});
