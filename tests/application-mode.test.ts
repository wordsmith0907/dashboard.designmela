import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationMode } from '../src/lib/application-mode';
test('Mode defaults explicitly to demo and rejects invalid configuration', () => {
  assert.equal(applicationMode(undefined),'demo');
  assert.equal(applicationMode('demo'),'demo');
  assert.equal(applicationMode('connected'),'connected');
  assert.throws(() => applicationMode('conected'));
});
