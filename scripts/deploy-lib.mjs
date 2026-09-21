import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { Client } from 'basic-ftp';

export function importDotEnv(path, env = process.env) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name, raw] = match;
    const value = raw.trim();
    const quote = value[0];
    if (env[name] === undefined) {
      env[name] = (quote === '"' || quote === "'") && value.endsWith(quote)
        ? value.slice(1, -1) : value;
    }
  }
}

function required(env, name, trim = true) {
  const value = trim ? env[name]?.trim() : env[name];
  if (!value) throw new Error(`${name} muss in .env, der Shell oder CI-Secrets gesetzt sein.`);
  return value;
}

function choice(env, name, values) {
  const value = required(env, name);
  if (!values.includes(value)) throw new Error(`${name} muss ${values.join(', ')} sein.`);
  return value;
}

export function validateRemotePath(path) {
  if (!path || !path.replaceAll('/', '') || /[\x00-\x1f\x7f\\]/.test(path)
      || path.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('DEPLOY_PATH muss ein konkretes Webverzeichnis ohne . oder .. sein; das Wurzelverzeichnis ist nicht erlaubt.');
  }
}

export function readConfig(env, root = process.cwd()) {
  const protocol = choice(env, 'DEPLOY_PROTOCOL', ['ssh', 'ftp', 'ftps']);
  const host = required(env, 'DEPLOY_HOST');
  const user = required(env, 'DEPLOY_USER');
  const path = required(env, 'DEPLOY_PATH').replace(/\/+$/, '');
  const rawPort = required(env, 'DEPLOY_PORT');
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error('DEPLOY_PORT muss eine Ganzzahl zwischen 1 und 65535 sein.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(host)) {
    throw new Error('DEPLOY_HOST muss ein Hostname oder eine IPv4-Adresse ohne Protokoll oder Port sein.');
  }
  if (/[\x00-\x1f\x7f]/.test(user)) throw new Error('DEPLOY_USER darf keine Steuerzeichen enthalten.');
  validateRemotePath(path);
  const config = { protocol, host, user, path, port: Number(rawPort) };
  if (protocol !== 'ssh') {
    const password = required(env, 'DEPLOY_PASSWORD', false);
    if (/[\r\n\x00]/.test(password)) throw new Error('DEPLOY_PASSWORD darf keine Zeilenumbrüche oder NUL-Zeichen enthalten.');
    const mode = protocol === 'ftps'
      ? choice(env, 'DEPLOY_FTPS_MODE', ['explicit', 'implicit']) : null;
    return { ...config, password, secure: mode === 'implicit' ? 'implicit' : protocol === 'ftps' };
  }
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/.test(user)) {
    throw new Error('DEPLOY_USER enthält für SSH nicht unterstützte Zeichen.');
  }
  if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.startsWith('-')) {
    throw new Error('DEPLOY_PATH darf für SSH nur Buchstaben, Ziffern, _, ., / und - enthalten und nicht mit - beginnen.');
  }
  const auth = choice(env, 'DEPLOY_SSH_AUTH', ['key', 'agent']);
  let keyPath;
  if (auth === 'key') {
    const key = required(env, 'DEPLOY_KEY');
    const candidates = [isAbsolute(key) ? key : resolve(root, key)];
    if (!/[\\/]/.test(key)) candidates.push(join(homedir(), '.ssh', key));
    keyPath = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    if (!keyPath) throw new Error('DEPLOY_KEY muss ein vorhandener privater Schlüsselpfad oder ein Dateiname unter ~/.ssh sein.');
  }
  return { ...config, auth, keyPath };
}

function run(command, args, root) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  if (result.error || result.status !== 0) {
    throw new Error('Deployment-Befehl fehlgeschlagen; Build und OpenSSH-Installation prüfen.');
  }
}

function build(root) {
  // npm.cmd kann unter Windows nicht direkt mit spawnSync gestartet werden.
  // npm run deploy stellt den plattformunabhängigen Pfad zur npm-CLI bereit.
  if (!process.env.npm_execpath) throw new Error('Deployment bitte über npm run deploy starten.');
  run(process.execPath, [process.env.npm_execpath, 'run', 'build'], root);
}

function checkSsh() {
  for (const [command, args] of [['ssh', ['-V']], ['scp', []]]) {
    if (spawnSync(command, args, { stdio: 'ignore' }).error) {
      throw new Error(`OpenSSH ${command} wurde nicht im PATH gefunden.`);
    }
  }
}

export function uploadSsh(config, root, entries, execute = run) {
  // -F none verhindert zusätzliche Identitäten aus Benutzer-/Systemkonfigurationen.
  const options = ['-F', 'none', '-o', 'BatchMode=yes', '-o', 'PreferredAuthentications=publickey'];
  if (config.auth === 'key') {
    options.push('-o', 'IdentityAgent=none', '-o', 'IdentitiesOnly=yes', '-i', config.keyPath);
  } else {
    options.push('-o', 'IdentityFile=none', '-o', 'IdentitiesOnly=no');
  }
  const target = `${config.user}@${config.host}`;
  const remote = `'${config.path}'`; // readConfig lässt hier keine Shell-Sonderzeichen zu.
  execute('ssh', [...options, '-p', String(config.port), target,
    `mkdir -p ${remote} && cd ${remote} && test "$(pwd -P)" != / && find . -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +`], root);
  execute('scp', [...options, '-P', String(config.port), '-r', ...entries,
    `${target}:${config.path}/`], root);
}

export async function uploadFtp(config, root, makeClient = () => new Client()) {
  const client = makeClient();
  let phase = 'FTP-Verbindung/Anmeldung';
  try {
    await client.access({
      host: config.host, port: config.port, user: config.user,
      password: config.password, secure: config.secure,
      secureOptions: { rejectUnauthorized: true, servername: config.host },
    });
    phase = 'FTP-Zielverzeichnis';
    await client.ensureDir(config.path);
    validateRemotePath(await client.pwd());
    phase = 'Leeren des FTP-Zielverzeichnisses';
    await client.clearWorkingDir();
    phase = 'FTP-Upload';
    await client.uploadFromDir(join(root, 'dist'));
  } catch {
    // Serverantworten können Zugangsdaten enthalten; keine Rohfehler ausgeben.
    throw new Error(`${phase} fehlgeschlagen. Verbindung, TLS-Zertifikat, Zielpfad und Berechtigungen prüfen.`);
  } finally {
    client.close();
  }
}

export async function deploy(config, root, actions = {}) {
  if (config.protocol === 'ssh') (actions.checkSsh ?? checkSsh)();
  await (actions.build ?? build)(root);
  const dist = join(root, 'dist');
  if (!existsSync(dist) || !statSync(dist).isDirectory()) throw new Error('Das Verzeichnis dist/ wurde nicht gefunden.');
  const entries = readdirSync(dist).map((entry) => join(dist, entry));
  if (!entries.length) throw new Error('Das Verzeichnis dist/ ist leer.');
  if (config.protocol === 'ssh') {
    await (actions.uploadSsh ?? uploadSsh)(config, root, entries);
  } else {
    await (actions.uploadFtp ?? uploadFtp)(config, root);
  }
}
