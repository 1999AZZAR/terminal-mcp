import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { 
  CommandExecutor, 
  SecurityError, 
  ValidationError 
} from '../build/executor.js';

test('CommandExecutor: local echo command execution', async () => {
  const executor = new CommandExecutor();
  const res = await executor.executeCommand('echo "test-hello-world"');
  assert.equal(res.exitCode, 0);
  assert.ok(res.stdout.includes('test-hello-world'));
  await executor.disconnect();
});

test('CommandExecutor: non-zero exit code capture', async () => {
  const executor = new CommandExecutor();
  const res = await executor.executeCommand('sh -c "exit 42"');
  assert.equal(res.exitCode, 42);
  await executor.disconnect();
});

test('CommandExecutor: timeout handling returns exitCode 124', async () => {
  const executor = new CommandExecutor();
  const res = await executor.executeCommand('sleep 2', { timeout: 300 });
  assert.equal(res.exitCode, 124);
  assert.ok(res.stderr.includes('timed out'));
  await executor.disconnect();
});

test('CommandExecutor: large output (>1MB) does not crash exec maxBuffer', async () => {
  const executor = new CommandExecutor();
  // 1.5MB stdout
  const res = await executor.executeCommand('node -e "process.stdout.write(\'A\'.repeat(1500000))"');
  assert.equal(res.exitCode, 0);
  assert.ok(res.stdout.length >= 1500000);
  await executor.disconnect();
});

test('CommandExecutor: standalone cd and pwd session persistence', async () => {
  const executor = new CommandExecutor();
  const sessionName = 'cd-test-session';

  const cdRes = await executor.executeCommand('cd /tmp', { session: sessionName });
  assert.equal(cdRes.exitCode, 0);
  assert.equal(cdRes.workingDirectory, '/tmp');

  const pwdRes = await executor.executeCommand('pwd', { session: sessionName });
  assert.equal(pwdRes.exitCode, 0);
  assert.equal(pwdRes.stdout.trim(), '/tmp');
  assert.equal(pwdRes.workingDirectory, '/tmp');

  await executor.disconnect();
});

test('CommandExecutor: validation errors on empty or invalid inputs', () => {
  const executor = new CommandExecutor();
  assert.throws(() => executor.validateCommand(''), ValidationError);
  assert.throws(() => executor.validateSessionName(''), ValidationError);
  assert.throws(() => executor.validateSessionName('invalid name with spaces!'), ValidationError);
});

test('CommandExecutor: dangerous command blocking', () => {
  const executor = new CommandExecutor();

  // Root rm
  assert.throws(() => executor.validateCommand('rm -rf /'), SecurityError);
  assert.throws(() => executor.validateCommand('rm -rf /*'), SecurityError);
  assert.throws(() => executor.validateCommand('rm -rf / --no-preserve-root'), SecurityError);
  assert.throws(() => executor.validateCommand('rm -rf ~'), SecurityError);
  assert.throws(() => executor.validateCommand('rm -rf ~/'), SecurityError);
  assert.throws(() => executor.validateCommand('chmod 777 /'), SecurityError);
  assert.throws(() => executor.validateCommand('chmod -R 777 /'), SecurityError);
  assert.throws(() => executor.validateCommand('chown -R root /'), SecurityError);

  // Safe commands that must NOT be blocked
  assert.doesNotThrow(() => executor.validateCommand('rm -rf /tmp/my-safe-dir'));
  assert.doesNotThrow(() => executor.validateCommand('rm /tmp/foo.txt'));
  assert.doesNotThrow(() => executor.validateCommand('chmod 777 /tmp/script.sh'));
  assert.doesNotThrow(() => executor.validateCommand('chown azzar /home/azzar/test'));
});

test('CommandExecutor: path traversal detection vs safe double-dot filenames', async () => {
  const executor = new CommandExecutor();
  const tmpDir = os.tmpdir();
  const srcFile = path.join(tmpDir, `test-dot..file-${Date.now()}.txt`);
  const dstFile = path.join(tmpDir, `test-dot..file-copy-${Date.now()}.txt`);

  fs.writeFileSync(srcFile, 'hello double dot');

  try {
    // Path with .. as segment must be rejected
    await assert.rejects(
      async () => executor.copyFileLocal({ source: '../etc/passwd', destination: dstFile }),
      SecurityError
    );

    // Filename containing .. substring must succeed
    const copyRes = await executor.copyFileLocal({ source: srcFile, destination: dstFile });
    assert.equal(copyRes.success, true);
    assert.equal(fs.readFileSync(dstFile, 'utf8'), 'hello double dot');
  } finally {
    try { fs.unlinkSync(srcFile); } catch (_err) { /* ignore cleanup error */ }
    try { fs.unlinkSync(dstFile); } catch (_err) { /* ignore cleanup error */ }
    await executor.disconnect();
  }
});
