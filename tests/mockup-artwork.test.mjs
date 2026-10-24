import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('extracted artwork retains its canvas root and original layer order', () => {
  const file = new URL('../src/MockupArtwork.tsx', import.meta.url);
  assert.ok(fs.existsSync(file), 'MockupArtwork component exists');
  const transpiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  // Structural element-tree check; browser/export suites run the real renderer.
  const localRequire = name => name === 'react' ? { ...require('react'), useMemo: factory => factory() } : name === './CanvasLayout' ? {
    FittedScene: function FittedScene() {}, DeviceComposition: function DeviceComposition() {},
  } : name === './text/CanvasTextLayerRenderer' ? { CanvasTextLayerRenderer: function CanvasTextLayerRenderer() {} } : require(name);
  new Function('require', 'module', 'exports', transpiled)(localRequire, module, module.exports);
  const root = module.exports.MockupArtwork({
    canvasLogicalSize: { width: 960, height: 720 }, gradient: { className: 'baseline-gradient' },
    textDocument: { version: 1, layers: [] },
    bgType: 'transparent', vfxNoise: true, vfxNoiseOpacity: 8, layoutMode: 'single',
    isProUnlocked: true, logoDataUrl: 'logo', logoPos: 'top-left', qrDataUrl: 'qr', qrPos: 'bottom-right',
    customBrandWatermark: 'Brand', padding: 88, effectivePaddingX: 88, effectivePaddingY: 66,
  });
  assert.equal(root.type, 'div');
  assert.equal(root.props.id, 'studio-canvas');
  assert.equal(root.props['data-canvas-root'], 'true');
  assert.equal(root.props.style.width, 960);
  const layers = root.props.children.filter(Boolean);
  assert.equal(layers[0].props['data-export-ignore'], 'true');
  assert.ok(layers[1].props.className.includes('mix-blend-overlay'));
  assert.equal(layers[2].type.name, 'FittedScene');
  assert.equal(layers[2].props.children.type.name, 'DeviceComposition');
  assert.equal(layers[3].props.alt, 'Brand Logo');
  assert.equal(layers[4].props.children.props.alt, 'QR Code');
  assert.equal(layers[5].props.children[1].props.children, 'Brand');
  assert.equal(layers[6].type.name, 'CanvasTextLayerRenderer');
});
