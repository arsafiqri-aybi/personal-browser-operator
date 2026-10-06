import fs from 'node:fs';
import crypto from 'node:crypto';
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

const ledgerPath = `architecture/ledger/${lock.ledger_head}.json`;
const ledger = JSON.parse(read(ledgerPath));
const expectedEntryHash = ledger.entry_hash;
const withoutHash = { ...ledger };
delete withoutHash.entry_hash;
const actualEntryHash = sha(canonical(withoutHash));
if (actualEntryHash !== expectedEntryHash || actualEntryHash !== lock.ledger_head_sha256) {
  throw new Error('Architecture ledger head hash mismatch');
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
  architectureVersion: genesis.architecture_version,
  genesisHash,
  ledgerHead: lock.ledger_head,
  ledgerHeadHash: actualEntryHash,
  invariants: ids.length,
  modules: Object.keys(graph).length
}, null, 2));
