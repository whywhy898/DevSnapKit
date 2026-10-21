import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup({ load = async () => [], embed = async () => '', fetchResource = async () => ({ ok: true, blob: async () => new Blob(['AAAA']) }), onRecovery = () => {}, check = () => true } = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/export/prepareArtworkExport.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  class Reader { readAsDataURL() { this.result='data:font/ttf;base64,AAAA';this.onload(); } }
  class Face { constructor(family,source,descriptors){onRecovery({family,source,descriptors});}async load(){return this;} }
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ getFontEmbedCSS: embed }), fetch: fetchResource, FileReader:Reader, FontFace:Face, document: { createElement:()=>({style:{}}), fonts: { load, add:()=>{}, ready: Promise.resolve(), check } } });
  return module.exports;
}

test('failed font load names its family, weight/style and retry action', async () => {
  const prep = setup({ load: async () => { throw new Error('A network error occurred'); } });
  await assert.rejects(prep.artworkFontCSS({}, ['italic 600 16px "Poster Gelasio"']), error => /Poster Gelasio/.test(error.message) && /italic 600/.test(error.message) && /try again|retry/i.test(error.message));
});

test('a permanently rejected owned CSS FontFace is replaced on the next preparation without reloading', async () => {
  const recovered=[];let originalAttempts=0;
  const prep=setup({load:async()=>{originalAttempts++;throw new Error('Permanent CSS font error');},onRecovery:face=>recovered.push(face),check:()=>false});
  const used=['italic 600 16px "Poster Gelasio"'];
  await assert.rejects(prep.artworkFontCSS({},used),/italic 600.*Poster Gelasio.*try again/i);
  assert.match(await prep.artworkFontCSS({},used),/data:/);
  assert.equal(originalAttempts,1,'Retry never awaits the permanently rejected CSS face again');
  assert.equal(recovered.length,1);assert.equal(recovered[0].family,'Poster Gelasio');
  assert.equal(recovered[0].descriptors.style,'italic');assert.equal(recovered[0].descriptors.weight,'400 700');
  await prep.artworkFontCSS({},used);assert.equal(recovered.length,1,'Recovered face is reused');
});

test('failed font embedding names used identities, clears cache and permits a real retry', async () => {
  let attempts = 0;
  const prep = setup({ embed: async () => { if (++attempts === 1) throw new Error('fetch failed'); return '@font-face{font-family:"Poster Gelasio";font-style:italic;font-weight:400 700;src:url(data:font/ttf;base64,AAAA)}'; } });
  const used = ['italic 600 16px "Poster Gelasio"'];
  await assert.rejects(prep.artworkFontCSS({}, used), error => /Poster Gelasio/.test(error.message) && /italic 600/.test(error.message) && /try again|retry/i.test(error.message));
  assert.match(await prep.artworkFontCSS({}, used), /data:/);
  assert.equal(attempts, 2);
});

test('one failed owned face blocks partial CSS then retries its resource in the same document', async () => {
  let italicAttempts=0;
  const prep=setup({fetchResource:async url=>{if(url.includes('Gelasio-Italic')&&++italicAttempts===1)throw new Error('network');return {ok:true,blob:async()=>new Blob(['AAAA'])};}});
  const used=['normal 600 16px "Poster Manrope"','italic 600 16px "Poster Gelasio"'];
  await assert.rejects(prep.artworkFontCSS({},used),/italic 600.*Poster Gelasio.*try again/i);
  const css=await prep.artworkFontCSS({},used);
  assert.equal(italicAttempts,2,'Failed resource promise is removed, successful face remains reusable');
  assert.match(css,/font-family:"Poster Manrope";font-style:normal;font-weight:200 800;src:url\("data:/);
  assert.match(css,/font-family:"Poster Gelasio";font-style:italic;font-weight:400 700;src:url\("data:/);
});
