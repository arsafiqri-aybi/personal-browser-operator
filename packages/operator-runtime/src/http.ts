import crypto from 'node:crypto';
import http from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createOperatorServer } from './factory.js';

const host = process.env.PBO_HOST || '127.0.0.1';
const port = Number(process.env.PBO_PORT || '8787');
const token = process.env.PBO_MCP_TOKEN || '';
const allowedHosts = new Set(
  (process.env.PBO_ALLOWED_HOSTS || 'localhost,127.0.0.1,[::1]')
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean)
);

const loopbackBind = host === '127.0.0.1' || host === '::1' || host === 'localhost';
if (!loopbackBind && !token) {
  throw new Error('PBO_MCP_TOKEN is required when binding beyond loopback');
}

function hostNameFromHeader(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL('http://' + value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function validHost(req: http.IncomingMessage): boolean {
  const hostname = hostNameFromHeader(req.headers.host);
  if (!hostname) return false;
  if (allowedHosts.has(hostname)) return true;
  if (hostname.includes(':') && allowedHosts.has('[' + hostname + ']')) return true;
  return false;
}

function validBearer(req: http.IncomingMessage): boolean {
  if (!token && loopbackBind) return true;
  const header = req.headers.authorization || '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const supplied = header.slice(prefix.length);
  const a = Buffer.from(supplied);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function json(res: http.ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

const handler = createMcpHandler(createOperatorServer);
const nodeHandler = toNodeHandler(handler);

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  if (pathname === '/health' && req.method === 'GET') {
    json(res, 200, {
      ok: true,
      service: 'personal-browser-operator',
      version: '0.3.0',
      transport: 'streamable-http'
    });
    return;
  }

  if (pathname !== '/mcp') {
    json(res, 404, { error: 'not_found' });
    return;
  }

  if (!validHost(req)) {
    json(res, 403, { error: 'host_not_allowed' });
    return;
  }

  if (!validBearer(req)) {
    res.setHeader('www-authenticate', 'Bearer');
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  void nodeHandler(req, res);
});

server.on('clientError', (_err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(port, host, () => {
  process.stderr.write(`Personal Browser Operator MCP listening on http://${host}:${port}/mcp\n`);
});
