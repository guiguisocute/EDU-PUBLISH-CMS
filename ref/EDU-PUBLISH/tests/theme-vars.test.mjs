import test from 'node:test';
import assert from 'node:assert/strict';

import { applyHueVars } from '../lib/theme-vars.js';

function createStyle(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    setProperty(name, value) {
      store.set(name, value);
    },
    removeProperty(name) {
      store.delete(name);
    },
    getPropertyValue(name) {
      return store.get(name) ?? '';
    },
  };
}

test('dark mode clears stale light-only inline theme vars', () => {
  const style = createStyle();

  applyHueVars(style, 221, false);
  assert.equal(style.getPropertyValue('--foreground'), '221 47% 11%');
  assert.equal(style.getPropertyValue('--border'), '221 32% 91%');

  applyHueVars(style, 221, true);

  assert.equal(style.getPropertyValue('--primary'), '221 91% 60%');
  assert.equal(style.getPropertyValue('--foreground'), '');
  assert.equal(style.getPropertyValue('--border'), '');
  assert.equal(style.getPropertyValue('--muted-foreground'), '');
});
