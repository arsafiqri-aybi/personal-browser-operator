import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type McpAuthMode = 'loopback-none' | 'static-bearer' | 'oauth-jwt';

export interface OAuthJwtConfig {
  publicBaseUrl: URL;
  resourceUrl: URL;
  issuer: string;
  audience: string;
  jwksUri: URL;
  requiredScope: string;
}

export interface VerifiedOAuthToken {
  subject: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
}

export class OAuthAccessError extends Error {
  constructor(
    public readonly code: 'invalid_token' | 'insufficient_scope',
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = 'OAuthAccessError';
  }
}

export function constantTimeEqualSecret(supplied: string, expected: string): boolean {
  if (!supplied || !expected) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function requireHttpsUrl(value: string, name: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS`);
  return url;
}

export function oauthConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OAuthJwtConfig {
  const publicBaseRaw = env.PBO_PUBLIC_BASE_URL;
  const issuerRaw = env.PBO_OAUTH_ISSUER;
  const jwksRaw = env.PBO_OAUTH_JWKS_URI;

  if (!publicBaseRaw) throw new Error('PBO_PUBLIC_BASE_URL is required for oauth-jwt mode');
  if (!issuerRaw) throw new Error('PBO_OAUTH_ISSUER is required for oauth-jwt mode');
  if (!jwksRaw) throw new Error('PBO_OAUTH_JWKS_URI is required for oauth-jwt mode');

  const publicBaseUrl = requireHttpsUrl(publicBaseRaw, 'PBO_PUBLIC_BASE_URL');
  const issuerUrl = requireHttpsUrl(issuerRaw, 'PBO_OAUTH_ISSUER');
  const jwksUri = requireHttpsUrl(jwksRaw, 'PBO_OAUTH_JWKS_URI');

  if (publicBaseUrl.pathname !== '/' || publicBaseUrl.search || publicBaseUrl.hash) {
    throw new Error('PBO_PUBLIC_BASE_URL must be an HTTPS origin without path, query, or fragment');
  }

  const resourceUrl = new URL('/mcp', publicBaseUrl);
  const audience = env.PBO_OAUTH_AUDIENCE || resourceUrl.toString();
  const requiredScope = env.PBO_OAUTH_SCOPE || 'pbo:mcp';

  if (!requiredScope.trim() || /\s/.test(requiredScope.trim())) {
    throw new Error('PBO_OAUTH_SCOPE must be one non-empty scope token');
  }

  return {
    publicBaseUrl,
    resourceUrl,
    issuer: issuerUrl.toString().replace(/\/$/, ''),
    audience,
    jwksUri,
    requiredScope: requiredScope.trim()
  };
}

export function protectedResourceMetadata(config: OAuthJwtConfig): Record<string, unknown> {
  return {
    resource: config.resourceUrl.toString(),
    authorization_servers: [config.issuer],
    scopes_supported: [config.requiredScope],
    bearer_methods_supported: ['header'],
    resource_name: 'Personal Browser Operator MCP'
  };
}

export function resourceMetadataUrl(config: OAuthJwtConfig): URL {
  return new URL('/.well-known/oauth-protected-resource/mcp', config.publicBaseUrl);
}

export function bearerChallenge(config: OAuthJwtConfig, error?: OAuthAccessError): string {
  const parts = [
    `Bearer resource_metadata="${resourceMetadataUrl(config).toString()}"`,
    `scope="${config.requiredScope}"`
  ];
  if (error) {
    parts.push(`error="${error.code}"`);
  }
  return parts.join(', ');
}

function tokenScopes(payload: JWTPayload): string[] {
  const values = new Set<string>();
  if (typeof payload.scope === 'string') {
    for (const scope of payload.scope.split(/\s+/).filter(Boolean)) values.add(scope);
  }
  const scp = payload.scp;
  if (Array.isArray(scp)) {
    for (const scope of scp) {
      if (typeof scope === 'string' && scope) values.add(scope);
    }
  } else if (typeof scp === 'string') {
    for (const scope of scp.split(/\s+/).filter(Boolean)) values.add(scope);
  }
  return [...values];
}

export class OAuthJwtVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: OAuthJwtConfig) {
    this.jwks = createRemoteJWKSet(config.jwksUri);
  }

  async verify(token: string): Promise<VerifiedOAuthToken> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        requiredClaims: ['exp', 'sub']
      });

      const expiresAt = payload.exp;
      const subject = payload.sub;
      if (typeof expiresAt !== 'number' || typeof subject !== 'string' || !subject) {
        throw new OAuthAccessError('invalid_token', 401, 'Required token claims are missing');
      }

      const scopes = tokenScopes(payload);
      if (!scopes.includes(this.config.requiredScope)) {
        throw new OAuthAccessError('insufficient_scope', 403, 'Required MCP scope is missing');
      }

      const clientId =
        typeof payload.azp === 'string' && payload.azp
          ? payload.azp
          : typeof payload.client_id === 'string' && payload.client_id
            ? payload.client_id
            : subject;

      return { subject, clientId, scopes, expiresAt };
    } catch (error) {
      if (error instanceof OAuthAccessError) throw error;
      throw new OAuthAccessError(
        'invalid_token',
        401,
        error instanceof Error ? error.message : 'Access token verification failed'
      );
    }
  }
}
