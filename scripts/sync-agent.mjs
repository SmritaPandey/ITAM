#!/usr/bin/env node
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(repoRoot, 'agent', 'qs-discovery-agent.js');
const destinations = [
  path.join(repoRoot, 'apps', 'api', 'agent', 'qs-discovery-agent.js'),
  path.join(repoRoot, 'agent', 'QS-Discovery-Agent.app', 'Contents', 'MacOS', 'qs-discovery-agent.js'),
  path.join(repoRoot, 'apps', 'api', 'agent', 'QS-Discovery-Agent.app', 'Contents', 'MacOS', 'qs-discovery-agent.js'),
];

for (const destination of destinations) {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log(`Synced ${path.relative(repoRoot, destination)}`);
}
