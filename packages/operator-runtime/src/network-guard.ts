import dns from 'node:dns/promises';
import net from 'node:net';

const cache = new Map<string, { blocked: boolean; expiresAt: number }>();
const ttlMs = 30_000;

function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b, c, d] = parts;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return false;

  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('ff')) return true;
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIPv4(normalized.slice('::ffff:'.length));
  }
  return false;
}

function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  return version === 4 ? isPrivateIPv4(address) : version === 6 ? isPrivateIPv6(address) : false;
}

function normalizeHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  if (lower.startsWith('[') && lower.endsWith(']')) return lower.slice(1, -1);
  return lower;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('UNSUPPORTED_URL_PROTOCOL');

  if (process.env.PBO_ALLOW_PRIVATE_NETWORKS === 'true') return url;

  const host = normalizeHostname(url.hostname);
  if (host === 'localhost' || host.endsWith('.local')) {
    throw new Error('PRIVATE_NETWORK_NAVIGATION_DENIED');
  }

  if (net.isIP(host) && isPrivateAddress(host)) {
    throw new Error('PRIVATE_NETWORK_NAVIGATION_DENIED');
  }

  const cached = cache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.blocked) throw new Error('PRIVATE_NETWORK_NAVIGATION_DENIED');
    return url;
  }

  const resolved = await dns.lookup(host, { all: true, verbatim: true });
  if (resolved.length === 0) throw new Error('DNS_RESOLUTION_EMPTY');

  const blocked = resolved.some(record => isPrivateAddress(record.address));
  cache.set(host, { blocked, expiresAt: Date.now() + ttlMs });

  if (blocked) throw new Error('PRIVATE_NETWORK_NAVIGATION_DENIED');
  return url;
}

export function clearNetworkGuardCache(): void {
  cache.clear();
}
