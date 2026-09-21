#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { importDotEnv, readConfig, deploy } from './deploy-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

try {
  importDotEnv(join(root, '.env'));
  const config = readConfig(process.env, root);
  await deploy(config, root);
  console.log(`Deployment per ${config.protocol.toUpperCase()} abgeschlossen.`);
} catch (error) {
  // Transportfehler werden bereits ohne Serverantworten/Zugangsdaten aufbereitet.
  console.error(error.message);
  process.exitCode = 1;
}
