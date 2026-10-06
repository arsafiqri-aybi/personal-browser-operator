import http from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import {
  OAuthAccessError,
  OAuthJwtVerifier,
  bearerChallenge,
  constantTimeEqualSecret,
  extractBearer,
  oauthConfigFromEnv,
  protectedResourceMetadata,
  resourceMetadataUrl,
  type McpAuthMode
} from './auth.js';
import { createMobileOperatorServer } from './mobile-factory.js';

const host = process.env.PBO_MOBILE_HOST || process.env.PBO_HOST || '127.0.0.1';
const port = Number(process.env.PBO_MOBILE_PORT || '8790');
const token = process.env.PBO_MOBILE_MCP_TOKEN || process.env.PBO_MCP_TOKEN || '';
const allowedHosts = new Set(
  (process.env.PBO_ALLOWED_HOSTS || 'localhost,127.0.0.1,[::1]')
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean)
);

const loopbackBind = host === '127.0.0.1' || host === '::1' || host === 'localhost';
const requestedAuthMode = process.env.PBO_AUTH_MODE?.trim() as McpAuthMode | undefined;
const authMode: McpAuthMode =
  requestedAuthMode ||
  (token ? 'static-bearer' : loopbackBind ? 'loopback-none' : 'static-bearer');

if (!['loopback-none', 'static-bearer', 'oauth-jwt'].includes(authMode)) {
  throw new Error(`Unsupported PBO_AUTH_MODE: ${authMode}`);
}
if (authMode === 'loopback-none' && !loopbackBind) {
  throw new Error('loopback-none auth mode is allowed only on a loopback bind');
}
if (authMode === 'static-bearer' && !token) {
  throw new Error('PBO_MOBILE_MCP_TOKEN or PBO_MCP_TOKEN is required for static-bearer mode');
}

const oauthConfig = authMode === 'oauth-jwt' ? oauthConfigFromEnv() : null;
const oauthVerifier = oauthConfig ? new OAuthJwtVerifier(oauthConfig) : null;

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

function json(
  res: http.ServerResponse,
  status: number,
  value: unknown,
  headers: Record<string, string> = {}
): void {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

async function authorizeMcp(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  if (authMode === 'loopback-none') return true;
  const bearer = extractBearer(req.headers.authorization);

  if (authMode === 'static-bearer') {
    if (bearer && constantTimeEqualSecret(bearer, token)) return true;
    res.setHeader('www-authenticate', 'Bearer');
    json(res, 401, { error: 'unauthorized' });
    return false;
  }

  if (!oauthConfig || !oauthVerifier) throw new Error('OAuth verifier not initialized');
  if (!bearer) {
    res.setHeader('www-authenticate', bearerChallenge(oauthConfig));
    json(res, 401, { error: 'invalid_token' });
    return false;
  }

  try {
    await oauthVerifier.verify(bearer);
    return true;
  } catch (error) {
    const failure =
      error instanceof OAuthAccessError
        ? error
        : new OAuthAccessError('invalid_token', 401, 'Access token verification failed');
    res.setHeader('www-authenticate', bearerChallenge(oauthConfig, failure));
    json(res, failure.status, { error: failure.code });
    return false;
  }
}

const handler = createMcpHandler(createMobileOperatorServer);
const nodeHandler = toNodeHandler(handler);

const server = http.createServer((req, res) => {
  void (async () => {
    const pathname = (req.url || '/').split('?')[0];

    if (pathname === '/health' && req.method === 'GET') {
      json(res, 200, {
        ok: true,
        service: 'personal-mobile-operator',
        version: '0.1.0',
        transport: 'streamable-http',
        authMode
      });
      return;
    }

    if (oauthConfig && pathname === resourceMetadataUrl(oauthConfig).pathname && req.method === 'GET') {
      json(res, 200, protectedResourceMetadata(oauthConfig), { 'access-control-allow-origin': '*' });
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
    if (!(await authorizeMcp(req, res))) return;
    void nodeHandler(req, res);
  })().catch(error => {
    if (!res.headersSent) json(res, 500, { error: 'server_error' });
    else res.end();
    process.stderr.write(
      `Mobile MCP HTTP request failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
  });
});

server.on('clientError', (_err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(port, host, () => {
  process.stderr.write(
    `Personal Mobile Operator MCP listening on http://${host}:${port}/mcp auth=${authMode}\n`
  );
});
