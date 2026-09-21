import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { importDotEnv, readConfig, deploy, uploadFtp, uploadSsh } from './deploy-lib.mjs';

const base = {
  DEPLOY_PROTOCOL: 'ftp', DEPLOY_HOST: 'example.com', DEPLOY_PORT: '2121',
  DEPLOY_USER: 'web@example.com', DEPLOY_PATH: '/web/site', DEPLOY_PASSWORD: ' test $ # " secret ',
};
const sshEnv = { ...base, DEPLOY_PROTOCOL: 'ssh', DEPLOY_SSH_AUTH: 'agent' };

function temp(t) {
  const root = mkdtempSync(join(tmpdir(), 'website-deploy-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('all connection fields are required; no protocol or port defaults', () => {
  for (const name of Object.keys(base)) {
    const env = { ...base };
    delete env[name];
    assert.throws(() => readConfig(env), new RegExp(name));
  }
  for (const protocol of ['sftp', 'FTP', 'auto']) {
    assert.throws(() => readConfig({ ...base, DEPLOY_PROTOCOL: protocol }), /DEPLOY_PROTOCOL/);
  }
  for (const port of ['0', '65536', '-1', '21.5', '21foo', '1e3']) {
    assert.throws(() => readConfig({ ...base, DEPLOY_PORT: port }), /DEPLOY_PORT/);
  }
  assert.equal(readConfig(base).port, 2121);
});

test('reject unsafe paths and connection strings before any transport', () => {
  for (const path of ['', '/', '////', '.', './', '/./', '..', '/web/../site', '/web/./site', '/web\nsite', 'C:\\web']) {
    assert.throws(() => readConfig({ ...base, DEPLOY_PATH: path }), /DEPLOY_PATH/);
  }
  for (const host of ['-oProxyCommand=x', 'ftp://host', 'host:21', 'host\nother']) {
    assert.throws(() => readConfig({ ...base, DEPLOY_HOST: host }), /DEPLOY_HOST/);
  }
  for (const path of ['-delete', '/web/$(id)', '/web/"x"', '/web/x;y', '/web/*']) {
    assert.throws(() => readConfig({ ...sshEnv, DEPLOY_PATH: path }), /DEPLOY_PATH/);
  }
  assert.equal(readConfig({ ...base, DEPLOY_PATH: 'web/my site/' }).path, 'web/my site');
});

test('passwords preserve special characters and spaces; dotenv never overrides shell values', (t) => {
  const path = join(temp(t), '.env');
  writeFileSync(path, '# comment\r\nDEPLOY_USER=file\r\nDEPLOY_PORT=21\r\nDEPLOY_PASSWORD=\' test $ # " secret \'\r\n');
  /** @type {Record<string, string>} */
  const env = { DEPLOY_USER: 'shell', DEPLOY_PORT: '' };
  importDotEnv(path, env);
  assert.equal(env.DEPLOY_USER, 'shell');
  assert.equal(env.DEPLOY_PORT, '');
  assert.equal(env.DEPLOY_PASSWORD, base.DEPLOY_PASSWORD);
  assert.equal(readConfig({ ...base, ...env, DEPLOY_PORT: '21' }).password, base.DEPLOY_PASSWORD);
  for (const password of ['a\nb', 'a\rb', 'a\x00b']) {
    assert.throws(() => readConfig({ ...base, DEPLOY_PASSWORD: password }), /DEPLOY_PASSWORD/);
  }
});

test('FTPS mode and SSH authentication must be explicit; keys must exist', (t) => {
  assert.throws(() => readConfig({ ...base, DEPLOY_PROTOCOL: 'ftps' }), /DEPLOY_FTPS_MODE/);
  assert.throws(() => readConfig({ ...sshEnv, DEPLOY_SSH_AUTH: '' }), /DEPLOY_SSH_AUTH/);
  assert.throws(() => readConfig({ ...sshEnv, DEPLOY_SSH_AUTH: 'password' }), /DEPLOY_SSH_AUTH/);
  assert.throws(() => readConfig({ ...sshEnv, DEPLOY_SSH_AUTH: 'key' }), /DEPLOY_KEY/);
  const root = temp(t);
  assert.throws(() => readConfig({ ...sshEnv, DEPLOY_SSH_AUTH: 'key', DEPLOY_KEY: 'missing' }, root), /DEPLOY_KEY/);
  writeFileSync(join(root, 'test-key'), 'fake test fixture');
  assert.equal(readConfig({ ...sshEnv, DEPLOY_SSH_AUTH: 'key', DEPLOY_KEY: 'test-key' }, root).keyPath, join(root, 'test-key'));
});

function ftpMock(failure, pwd = '/web/site') {
  const calls = [];
  const client = {};
  for (const name of ['access', 'ensureDir', 'pwd', 'clearWorkingDir', 'uploadFromDir']) {
    client[name] = async (...args) => {
      calls.push({ name, args });
      if (name === failure) throw new Error(`server response with ${base.DEPLOY_PASSWORD}`);
      if (name === 'pwd') return pwd;
    };
  }
  client.close = () => calls.push({ name: 'close', args: [] });
  return { calls, client };
}

for (const [protocol, mode, secure] of [['ftp', undefined, false], ['ftps', 'explicit', true], ['ftps', 'implicit', 'implicit']]) {
  test(`${protocol} ${mode ?? ''}: authenticated target, cleanup, upload and close in order`, async (t) => {
    const root = temp(t);
    const { calls, client } = ftpMock();
    await uploadFtp(readConfig({ ...base, DEPLOY_PROTOCOL: protocol, DEPLOY_FTPS_MODE: mode }), root, () => client);
    assert.deepEqual(calls.map((call) => call.name), ['access', 'ensureDir', 'pwd', 'clearWorkingDir', 'uploadFromDir', 'close']);
    assert.deepEqual(calls[0].args[0], {
      host: 'example.com', port: 2121, user: base.DEPLOY_USER, password: base.DEPLOY_PASSWORD,
      secure, secureOptions: { rejectUnauthorized: true, servername: 'example.com' },
    });
    assert.equal(calls[1].args[0], '/web/site');
    assert.equal(calls[4].args[0], join(root, 'dist'));
  });
}

test('FTP failures stop subsequent operations, close the connection and hide credentials', async () => {
  const operations = ['access', 'ensureDir', 'pwd', 'clearWorkingDir', 'uploadFromDir'];
  for (const failure of operations) {
    const { calls, client } = ftpMock(failure);
    await assert.rejects(uploadFtp(readConfig(base), '/test', () => client), (error) => {
      assert.match(error.message, /fehlgeschlagen/);
      assert.ok(!error.message.includes(base.DEPLOY_PASSWORD));
      return true;
    });
    assert.deepEqual(calls.map((call) => call.name), [...operations.slice(0, operations.indexOf(failure) + 1), 'close']);
  }
});

test('FTPS certificate failure never retries with plain FTP', async () => {
  const { calls, client } = ftpMock('access');
  await assert.rejects(uploadFtp(readConfig({ ...base, DEPLOY_PROTOCOL: 'ftps', DEPLOY_FTPS_MODE: 'explicit' }), '/test', () => client));
  assert.deepEqual(calls.map((call) => call.name), ['access', 'close']);
  assert.equal(calls[0].args[0].secure, true);
});

test('FTP refuses a target resolving to the server root', async () => {
  const { calls, client } = ftpMock(undefined, '/');
  await assert.rejects(uploadFtp(readConfig(base), '/test', () => client), /Zielverzeichnis/);
  assert.deepEqual(calls.map((call) => call.name), ['access', 'ensureDir', 'pwd', 'close']);
});

test('SSH uses explicit ports and only the selected authentication; scp follows cleanup', () => {
  for (const auth of ['key', 'agent']) {
    const calls = [];
    uploadSsh({ ...readConfig(sshEnv), auth, keyPath: '/test/key with spaces' }, '/test', ['/test/dist/.htaccess', '/test/dist/index.html'], (...args) => calls.push(args));
    assert.deepEqual(calls.map((call) => call[0]), ['ssh', 'scp']);
    for (const [command, args] of calls) {
      assert.equal(args[args.indexOf(command === 'ssh' ? '-p' : '-P') + 1], '2121');
      assert.ok(args.includes('BatchMode=yes'));
      if (auth === 'key') {
        assert.ok(args.includes('IdentityAgent=none'));
        assert.equal(args[args.indexOf('-i') + 1], '/test/key with spaces');
      } else {
        assert.ok(args.includes('IdentityFile=none'));
        assert.ok(!args.includes('-i'));
      }
    }
    assert.match(calls[0][1].at(-1), /&& cd '\/web\/site' && test/);
    assert.ok(calls[1][1].includes('/test/dist/.htaccess'));
  }
  const calls = [];
  assert.throws(() => uploadSsh(readConfig(sshEnv), '/test', [], (command) => {
    calls.push(command);
    throw new Error('cleanup failed');
  }), /cleanup failed/);
  assert.deepEqual(calls, ['ssh']);
});

test('failed build, missing output and empty output never trigger upload', async (t) => {
  const root = temp(t);
  const unexpected = () => assert.fail('must not upload');
  await assert.rejects(deploy(readConfig(base), root, {
    build: () => { throw new Error('build failed'); }, uploadFtp: unexpected,
  }), /build failed/);
  await assert.rejects(deploy(readConfig(base), root, { build: () => {}, uploadFtp: unexpected }), /nicht gefunden/);
  mkdirSync(join(root, 'dist'));
  await assert.rejects(deploy(readConfig(base), root, { build: () => {}, uploadFtp: unexpected }), /leer/);
});

test('successful builds dispatch to the chosen transport including hidden entries', async (t) => {
  const root = temp(t);
  for (const env of [base, sshEnv]) {
    const events = [];
    await deploy(readConfig(env), root, {
      checkSsh: () => events.push('ssh-check'),
      build: () => {
        events.push('build');
        mkdirSync(join(root, 'dist', 'nested'), { recursive: true });
        writeFileSync(join(root, 'dist', '.htaccess'), 'test');
        writeFileSync(join(root, 'dist', 'nested', 'index.html'), 'test');
      },
      uploadFtp: () => events.push('ftp'),
      uploadSsh: (_config, _root, entries) => {
        events.push('ssh');
        assert.ok(entries.includes(join(root, 'dist', '.htaccess')));
        assert.ok(entries.includes(join(root, 'dist', 'nested')));
      },
    });
    assert.deepEqual(events, env === base ? ['build', 'ftp'] : ['ssh-check', 'build', 'ssh']);
  }
});

test('CLI exits unsuccessfully on invalid configuration without revealing values', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./deploy.mjs', import.meta.url))], {
    env: { ...process.env, DEPLOY_PROTOCOL: 'invalid-test-protocol' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEPLOY_PROTOCOL/);
  assert.ok(!result.stderr.includes('invalid-test-protocol'));
});
