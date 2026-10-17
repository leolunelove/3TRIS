import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const cache = resolve('node_modules/.cache');
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, '3tris-controller-'));
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck', '--outDir', out, 'src/lib/game/controller.ts']);
  writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}');
  const require = createRequire(import.meta.url);
  let now = 0, nextFrame = 0, paints = 0;
  const frames = new Map(), windowEvents = new Map(), documentEvents = new Map();
  const listeners = map => ({ addEventListener: (name, fn) => map.set(name, fn), removeEventListener: name => map.delete(name) });
  globalThis.window = { ...listeners(windowEvents), devicePixelRatio: 1 };
  globalThis.document = { ...listeners(documentEvents), hidden: false, documentElement: { clientWidth: 800 } };
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [] } });
  globalThis.performance = { now: () => now };
  globalThis.requestAnimationFrame = fn => { frames.set(++nextFrame, fn); return nextFrame; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.getComputedStyle = () => ({ paddingTop: '0', paddingBottom: '0', paddingLeft: '0', paddingRight: '0', columnGap: '0' });
  globalThis.fetch = async () => { throw new Error('Offline test'); };
  const { GameAudio } = require(join(out, 'audio.js'));
  for (const name of Object.getOwnPropertyNames(GameAudio.prototype)) {
    if (name !== 'constructor') GameAudio.prototype[name] = () => {};
  }
  const context = new Proxy({}, { get: (_, key) => key === 'fillRect' ? () => paints++ : key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} });
  const canvas = { style: {}, getContext: () => context };
  const stage = { parentElement: { clientWidth: 800, clientHeight: 600, querySelectorAll: () => [] } };
  const { createController } = require(join(out, 'controller.js'));
  const { useTris } = require(join(out, 'store.js'));
  const ctrl = createController({ canvas, stage });
  const advance = (count = 1) => {
    for (let i = 0; i < count; i++) {
      now += 1000 / 60;
      const pending = [...frames.values()]; frames.clear();
      for (const fn of pending) fn(now);
    }
  };
  advance();
  const idlePaints = paints;
  advance(120);
  assert.equal(paints, idlePaints, 'Ready screen must not repaint a static board');
  ctrl.start(); advance(12);
  assert.ok(paints > idlePaints, 'Playing must render');
  const next = useTris.getState().next;
  advance(20);
  assert.equal(useTris.getState().next, next, 'Clock updates must preserve unchanged next previews');
  ctrl.pause(); advance(60);
  const pausedPaints = paints, pausedTime = ctrl.engine.timeMs;
  advance(120);
  assert.equal(paints, pausedPaints, 'Paused screen must not repaint a static board');
  assert.equal(ctrl.engine.timeMs, pausedTime);
  ctrl.applySettings({ ...useTris.getState().settings, gridVisible: false }); advance();
  assert.ok(paints > pausedPaints, 'Settings must redraw even while paused');
  ctrl.resume(); advance();
  const hiddenTime = ctrl.engine.timeMs;
  document.hidden = true; documentEvents.get('visibilitychange')();
  assert.equal(frames.size, 0, 'Hidden tab must stop the frame loop');
  assert.equal(ctrl.engine.phase, 'paused');
  now += 60000;
  document.hidden = false; documentEvents.get('visibilitychange')(); advance();
  assert.equal(ctrl.engine.timeMs, hiddenTime, 'Returning must not advance the paused clock');
  ctrl.resume(); advance();
  assert.ok(ctrl.engine.timeMs > pausedTime);
  ctrl.quit(); advance(60);
  const quitPaints = paints; advance(120);
  assert.equal(paints, quitPaints, 'Quit must return to an idle board');
  ctrl.destroy(); assert.equal(frames.size, 0);
  assert.equal(windowEvents.size + documentEvents.size, 0);
  console.log('Passed: idle/paused rendering, live settings, stable previews, hidden-tab suspension, resume, quit and cleanup.');
} finally { rmSync(out, { recursive: true, force: true }); }
