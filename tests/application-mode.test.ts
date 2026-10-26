import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationMode } from '../src/lib/application-mode';
test('Mode must be explicit and rejects missing or invalid configuration', () => {
  assert.throws(() => applicationMode(undefined));
  assert.equal(applicationMode('demo'),'demo');
  assert.equal(applicationMode('connected'),'connected');
  assert.throws(() => applicationMode('conected'));
});
