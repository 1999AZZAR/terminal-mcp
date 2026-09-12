import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVER_NAME,
  TOOL_SIDE_EFFECTS,
  isEnvelopeEnabled,
  wrapResult,
  wrapError,
  textResult,
} from '../build/envelope.js';

const ALL_TOOLS = ['execute_command', 'transfer_file', 'terminal_ls', 'terminal_grep', 'terminal_cat'];
const REQUIRED_KEYS = ['ok', 'summary', 'data', 'artifacts', 'provenance', 'warnings', 'sideEffects', 'execution', 'redaction'];

function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test('side-effect map covers every tool', () => {
  assert.deepEqual(new Set(Object.keys(TOOL_SIDE_EFFECTS)), new Set(ALL_TOOLS));
  assert.deepEqual(TOOL_SIDE_EFFECTS['execute_command'], ['command-execution']);
  assert.deepEqual(TOOL_SIDE_EFFECTS['transfer_file'], ['file-transfer']);
  for (const t of ['terminal_ls', 'terminal_grep', 'terminal_cat']) {
    assert.deepEqual(TOOL_SIDE_EFFECTS[t], [], `${t} must be side-effect free`);
  }
});

test('flag off by default', () => {
  withEnv({ HELA_ENVELOPE: undefined }, () => assert.equal(isEnvelopeEnabled(), false));
});

for (const tool of ALL_TOOLS) {
  test(`off-mode byte-identical legacy output: ${tool}`, () => {
    withEnv({ HELA_ENVELOPE: undefined }, () => {
      const payload = { command: 'echo hi', exitCode: 0, stdout: 'hi', stderr: '' };
      const got = textResult(tool, payload);
      assert.deepEqual(got, { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
    });
  });

  test(`on-mode envelope schema: ${tool}`, () => {
    withEnv({ HELA_ENVELOPE: 'true' }, () => {
      const payload = { command: 'echo hi', exitCode: 0 };
      const got = textResult(tool, payload);
      assert.equal(got.content.length, 1);
      assert.equal(got.content[0].type, 'text');
      const env = JSON.parse(got.content[0].text);
      for (const k of REQUIRED_KEYS) assert.ok(k in env, `${tool} envelope missing ${k}`);
      assert.equal(env.ok, true);
      assert.deepEqual(env.data, payload);
      assert.equal(env.execution.serverName, SERVER_NAME);
      assert.equal(env.execution.toolName, tool);
      assert.deepEqual(env.redaction, { applied: false, fields: [] });
    });
  });
}

test('on-mode error shape carries side effects', () => {
  withEnv({ HELA_ENVELOPE: 'true' }, () => {
    const err = wrapError('execute_command', 'boom');
    assert.equal(err.ok, false);
    assert.equal(err.data, null);
    assert.deepEqual(err.sideEffects, ['command-execution']);
    assert.ok(err.error.includes('boom'));
  });
});

test('run/step id propagation from env', () => {
  withEnv({ HELA_ENVELOPE: 'true', HELA_RUN_ID: 'r1', HELA_STEP_ID: 's2' }, () => {
    const env = JSON.parse(textResult('terminal_ls', {}).content[0].text);
    assert.equal(env.execution.run_id, 'r1');
    assert.equal(env.execution.step_id, 's2');
  });
});

test('wrapResult summary default', () => {
  assert.equal(wrapResult('terminal_cat', 'x').summary, 'terminal_cat ok');
});
