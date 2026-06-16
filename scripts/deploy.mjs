#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio ?? 'inherit',
    env: options.env ?? process.env,
  });

  if (result.error) {
    fail(`${command} konnte nicht gestartet werden: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`${command} wurde mit Code ${result.status ?? 1} beendet.`);
  }

  return result;
}

function commandExists(command, args) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function importDotEnv(path = '.env') {
  if (!existsSync(path)) {
    return;
  }

  const raw = readFileSync(path, 'utf8');
  const lineBreak = String.fromCharCode(10);
  const carriageReturn = String.fromCharCode(13);

  for (const rawLine of raw.split(lineBreak)) {
    const line = rawLine.endsWith(carriageReturn) ? rawLine.slice(0, -1) : rawLine;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    const [, name, rawValue] = match;
    const trimmedValue = rawValue.trim();
    const quote = trimmedValue.at(0);
    const value =
      (quote === '"' || quote === "'") && trimmedValue.endsWith(quote)
        ? trimmedValue.slice(1, -1)
        : trimmedValue;

    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    fail(`${name} muss in .env, der Shell oder CI-Secrets gesetzt sein.`);
  }

  return value;
}

function resolveExistingKeyPath(value) {
  const candidates = [
    isAbsolute(value) ? value : resolve(value),
  ];

  if (!/[\\/]/.test(value)) {
    candidates.push(join(homedir(), '.ssh', value));
  }

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function resolveDeployKey(value) {
  if (!value?.trim()) {
    return null;
  }

  const existingPath = resolveExistingKeyPath(value.trim());

  if (!existingPath) {
    fail('DEPLOY_KEY muss ein vorhandener privater Schlüsselpfad oder ein Dateiname unter ~/.ssh sein.');
  }

  return existingPath;
}

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function validateTargetPart(name, value) {
  if (/[\s'":]/.test(value)) {
    fail(`${name} darf keine Leerzeichen, Anführungszeichen oder Doppelpunkte enthalten.`);
  }
}

function validateRemotePath(path) {
  if (/\s/.test(path)) {
    fail('DEPLOY_PATH darf keine Leerzeichen enthalten.');
  }

  if (path === '/' || path === '.' || path.length < 2) {
    fail('DEPLOY_PATH muss auf ein konkretes Webverzeichnis zeigen.');
  }
}

importDotEnv();

const deployUser = requireEnv('DEPLOY_USER');
const deployHost = requireEnv('DEPLOY_HOST');
const deployPath = requireEnv('DEPLOY_PATH').replace(/\/+$/, '');
const deployKey = process.env.DEPLOY_KEY;

validateTargetPart('DEPLOY_USER', deployUser);
validateTargetPart('DEPLOY_HOST', deployHost);
validateRemotePath(deployPath);

if (!commandExists('ssh', ['-V'])) {
  fail('OpenSSH ssh wurde nicht im PATH gefunden.');
}

if (!commandExists('scp', ['-V'])) {
  fail('OpenSSH scp wurde nicht im PATH gefunden.');
}

const keyPath = resolveDeployKey(deployKey);
const sshArgs = ['-o', 'BatchMode=yes'];

if (keyPath) {
  sshArgs.push('-o', 'IdentitiesOnly=yes', '-i', keyPath);
}

const target = `${deployUser}@${deployHost}`;
const remoteSpec = `${target}:${deployPath}/`;

process.env.ASTRO_TELEMETRY_DISABLED = '1';
run(npmCommand, ['run', 'build']);

if (!existsSync('dist')) {
  fail('Das Verzeichnis dist/ wurde nicht gefunden.');
}

const distEntries = readdirSync('dist').map((entry) => join('dist', entry));

if (distEntries.length === 0) {
  fail('Das Verzeichnis dist/ ist leer.');
}

const remotePath = shellQuote(deployPath);
run('ssh', [
  ...sshArgs,
  target,
  `mkdir -p ${remotePath} && find ${remotePath} -mindepth 1 -maxdepth 1 -exec rm -rf {} +`,
]);
run('scp', [...sshArgs, '-r', ...distEntries, remoteSpec]);

console.log(`Deployment nach ${deployHost}:${deployPath} abgeschlossen.`);
