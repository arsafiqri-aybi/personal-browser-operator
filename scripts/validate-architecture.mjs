import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import YAML from 'yaml';

const read = p => fs.readFileSync(p, 'utf8');

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseLock(text) {
  return Object.fromEntries(text.trim().split(/\r?\n/).filter(Boolean).map(line => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1)];
  }));
}

const genesis = JSON.parse(read('architecture/GENESIS.json'));
const lock = parseLock(read('ARCHITECTURE.lock'));
const genesisHash = sha(canonical(genesis));
if (genesisHash !== lock.genesis_sha256) {
  throw new Error(`GENESIS hash mismatch: ${genesisHash} != ${lock.genesis_sha256}`);
}

const ledgerDir = 'architecture/ledger';
const ledgerFiles = fs.readdirSync(ledgerDir)
  .filter(name => /^ARCH-\d+\.json$/.test(name))
  .sort();

if (ledgerFiles.length === 0) throw new Error('Architecture ledger is empty');

let previousHash = null;
let lastEntry = null;

for (const name of ledgerFiles) {
  const entry = JSON.parse(read(path.join(ledgerDir, name)));
  const expectedEntryHash = entry.entry_hash;
  const withoutHash = { ...entry };
  delete withoutHash.entry_hash;
  const actualEntryHash = sha(canonical(withoutHash));

  if (actualEntryHash !== expectedEntryHash) {
    throw new Error(`${name} entry hash mismatch`);
  }

  if (entry.previous_entry_hash !== previousHash) {
    throw new Error(`${name} previous_entry_hash does not match chain head`);
  }

  if (entry.artifact_hash_mode === 'raw_utf8') {
    for (const [artifactPath, expectedHash] of Object.entries(entry.artifact_hashes || {})) {
      if (!fs.existsSync(artifactPath)) throw new Error(`${name} missing artifact ${artifactPath}`);
      const actualHash = sha(read(artifactPath));
      if (actualHash !== expectedHash) {
        throw new Error(`${name} artifact hash mismatch for ${artifactPath}`);
      }
    }
  }

  previousHash = actualEntryHash;
  lastEntry = entry;
}

if (!lastEntry) throw new Error('Architecture ledger head missing');
if (lastEntry.entry_id !== lock.ledger_head || previousHash !== lock.ledger_head_sha256) {
  throw new Error('ARCHITECTURE.lock does not match actual ledger head');
}
if (lastEntry.architecture_version !== lock.architecture_version) {
  throw new Error('Architecture version mismatch between ledger head and lock');
}

const architecture = YAML.parse(read('architecture/architecture.yaml'));
if (architecture.architecture_version !== lock.architecture_version) {
  throw new Error('architecture.yaml version does not match lock');
}

const inv = YAML.parse(read('architecture/invariants.yaml'));
const ids = inv.invariants.map(x => x.id);
if (ids.length < 16 || new Set(ids).size !== ids.length) {
  throw new Error('Protected invariants missing or duplicated');
}

const graph = YAML.parse(read('architecture/dependency-graph.yaml')).nodes;
const visiting = new Set();
const visited = new Set();
function visit(node) {
  if (visiting.has(node)) throw new Error(`Dependency cycle at ${node}`);
  if (visited.has(node)) return;
  visiting.add(node);
  for (const dep of graph[node] || []) {
    if (!graph[dep]) throw new Error(`Unknown dependency ${dep} referenced by ${node}`);
    visit(dep);
  }
  visiting.delete(node);
  visited.add(node);
}
for (const node of Object.keys(graph)) visit(node);

console.log(JSON.stringify({
  ok: true,
  architectureVersion: lock.architecture_version,
  genesisVersion: genesis.architecture_version,
  genesisHash,
  ledgerEntries: ledgerFiles.length,
  ledgerHead: lock.ledger_head,
  ledgerHeadHash: previousHash,
  invariants: ids.length,
  modules: Object.keys(graph).length
}, null, 2));
