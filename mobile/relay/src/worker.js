function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function bearer(request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function safeDeviceId(value) {
  if (!value || !/^[A-Za-z0-9._-]{1,80}$/.test(value)) {
    throw new Error("INVALID_DEVICE_ID");
  }
  return value;
}

function room(env, deviceId) {
  const id = env.MOBILE_DEVICE_ROOM.idFromName(deviceId);
  return env.MOBILE_DEVICE_ROOM.get(id);
}

export class MobileDeviceRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.pending = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      if ((request.headers.get("upgrade") || "").toLowerCase() !== "websocket") {
        return json({ error: "websocket_required" }, 426);
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, ["device"]);
      server.serializeAttachment({
        role: "device",
        connectedAt: new Date().toISOString()
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/status" && request.method === "GET") {
      const sockets = this.ctx.getWebSockets("device").filter(
        ws => ws.readyState === WebSocket.OPEN
      );
      return json({
        connected: sockets.length > 0,
        connections: sockets.length
      });
    }

    if (url.pathname === "/command" && request.method === "POST") {
      const sockets = this.ctx.getWebSockets("device").filter(
        ws => ws.readyState === WebSocket.OPEN
      );
      if (sockets.length === 0) {
        return json({ error: "device_offline" }, 409);
      }

      const command = await request.json();
      const requestId = crypto.randomUUID();
      const envelope = {
        requestId,
        ...command,
        issuedAt: new Date().toISOString()
      };

      const response = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId);
          reject(new Error("DEVICE_RESPONSE_TIMEOUT"));
        }, 20000);

        this.pending.set(requestId, value => {
          clearTimeout(timer);
          resolve(value);
        });

        try {
          sockets[0].send(JSON.stringify(envelope));
        } catch (error) {
          clearTimeout(timer);
          this.pending.delete(requestId);
          reject(error);
        }
      }).catch(error => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }));

      return json(response, response && response.ok === false ? 502 : 200);
    }

    return json({ error: "not_found" }, 404);
  }

  async webSocketMessage(_ws, message) {
    let parsed;
    try {
      parsed = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    const requestId = parsed && parsed.requestId;
    if (!requestId) return;

    const resolve = this.pending.get(requestId);
    if (!resolve) return;
    this.pending.delete(requestId);
    resolve(parsed);
  }

  async webSocketClose(ws, code, reason) {
    try {
      ws.close(code, reason);
    } catch {
      // The runtime may already have completed the close handshake.
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "personal-mobile-relay",
        transport: "durable-object-websocket"
      });
    }

    const match = url.pathname.match(/^\/v1\/device\/([^/]+)\/(connect|status|command)$/);
    if (!match) return json({ error: "not_found" }, 404);

    let deviceId;
    try {
      deviceId = safeDeviceId(decodeURIComponent(match[1]));
    } catch {
      return json({ error: "invalid_device_id" }, 400);
    }

    if (env.DEVICE_ID && env.DEVICE_ID !== deviceId) {
      return json({ error: "device_not_allowed" }, 403);
    }

    const operation = match[2];
    if (operation === "connect") {
      if (!env.DEVICE_TOKEN || bearer(request) !== env.DEVICE_TOKEN) {
        return json({ error: "unauthorized_device" }, 401);
      }
      return room(env, deviceId).fetch(new Request("https://room/connect", request));
    }

    if (!env.CONTROL_TOKEN || bearer(request) !== env.CONTROL_TOKEN) {
      return json({ error: "unauthorized_control" }, 401);
    }

    if (operation === "status") {
      return room(env, deviceId).fetch(new Request("https://room/status", { method: "GET" }));
    }

    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const body = await request.text();
    return room(env, deviceId).fetch(new Request("https://room/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    }));
  }
};
