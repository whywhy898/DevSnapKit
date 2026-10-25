import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = createTypeScriptLoader(root);
const free = ['canvas_text', 'brand_logo', 'qr_code', 'png_export', 'webp_export', 'jpeg_export', 'legacy_brand_badge'];
const pro = ['4k_export', 'batch_export', 'all_gradients'];
const policy = () => {
  assert.ok(fs.existsSync(path.join(root, 'shared/productCapabilities.ts')), 'shared product capability policy exists');
  return load('shared/productCapabilities.ts');
};

// The shared loader above exercises the policy. The Function and its security
// dependencies additionally need the Cloudflare runtime globals for these tests.
function loadFunction(relative) {
  let filename = path.resolve(root, relative);
  if (!path.extname(filename)) filename += '.ts';
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports, Response, TextEncoder, crypto: globalThis.crypto,
    require: name => loadFunction(path.resolve(path.dirname(filename), name)),
  });
  return mod.exports;
}
const secret = 'capability-policy-test-secret-at-least-32-characters';
async function verify(licenseKey, env = { DSK_SERVER_SECRET: secret }) {
  return loadFunction('functions/api/verify-license.ts').onRequestPost({
    request: new Request('https://qa.invalid/api/verify-license', {
      method: 'POST', body: JSON.stringify({ licenseKey }),
    }), env,
  });
}
async function signedKey(signingSecret = secret) {
  const { licenseCheck } = loadFunction('functions/lib/security.ts');
  return 'DSK-AAAA-BBBB-' + await licenseCheck(signingSecret, 'AAAA', 'BBBB');
}

test('shared policy declares the exact free and Pro capabilities with a stable version', () => {
  const capabilities = policy();
  assert.deepEqual(Array.from(capabilities.FREE_FEATURES), free);
  assert.deepEqual(Array.from(capabilities.PRO_FEATURES), pro);
  assert.equal(capabilities.CAPABILITY_POLICY_VERSION, 1);
});

test('all free capabilities are available before and after Pro unlock', () => {
  for (const feature of free) {
    assert.equal(policy().canUse(feature, false), true, feature);
    assert.equal(policy().canUse(feature, true), true, feature);
  }
});

test('4x export keeps its existing 4k_export API ID and Pro gates remain closed when locked', () => {
  for (const feature of pro) {
    assert.equal(policy().canUse(feature, false), false, feature);
    assert.equal(policy().canUse(feature, true), true, feature);
  }
});

test('custom_watermark is a free legacy alias while unknown and legal identifiers grant no capability', () => {
  for (const unlocked of [false, true]) {
    assert.equal(policy().canUse('custom_watermark', unlocked), true);
    for (const feature of ['commercial_rights', '4x_export', 'unknown', '__proto__', '']) {
      assert.equal(policy().canUse(feature, unlocked), false, feature);
    }
  }
});

test('authentic old-format license returns explicit free and Pro policy alongside legacy fields', async () => {
  const key = await signedKey();
  const res = await verify('  ' + key.toLowerCase() + '  ');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.valid, true);
  assert.equal(body.tier, 'pro_lifetime');
  assert.equal(body.licenseKey, key);
  assert.equal(body.serverVerified, true);
  assert.deepEqual(body.freeFeatures, free);
  assert.deepEqual(body.proFeatures, pro);
  assert.equal(body.capabilityPolicyVersion, 1);
  assert.deepEqual(new Set(body.unlockedFeatures), new Set([...free, ...pro, 'custom_watermark', 'commercial_rights']));
  assert.equal(body.unlockedFeatures.length, new Set(body.unlockedFeatures).size);
  assert.ok(body.unlockedFeatures.includes('webp_export'));
  assert.ok(body.unlockedFeatures.includes('custom_watermark'));
});

test('invalid or differently signed keys do not receive capability metadata', async () => {
  const otherKey = await signedKey('another-capability-test-secret-at-least-32-characters');
  for (const key of ['not-a-license', otherKey]) {
    const res = await verify(key);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, false);
    for (const field of ['unlockedFeatures', 'freeFeatures', 'proFeatures', 'capabilityPolicyVersion']) {
      assert.equal(body[field], undefined);
    }
  }
});

test('verification preserves missing-input and missing-secret rejection statuses', async () => {
  assert.equal((await verify(undefined)).status, 400);
  assert.equal((await verify('DSK-AAAA-BBBB-CCCC', {})).status, 503);
});
