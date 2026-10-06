import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const host = process.env.PBO_CONSOLE_HOST || '127.0.0.1';
const port = Number(process.env.PBO_CONSOLE_PORT || '8790');
const token = process.env.PBO_CONSOLE_TOKEN || '';
const dataRoot = process.env.PBO_DATA_DIR || path.resolve('runtime-data');
const novncUrl = process.env.PBO_NOVNC_PUBLIC_URL || 'http://127.0.0.1:6080/vnc.html?autoconnect=true&resize=scale';

const loopback = host === '127.0.0.1' || host === '::1' || host === 'localhost';
if (!loopback && !token) {
  throw new Error('PBO_CONSOLE_TOKEN is required when console binds beyond loopback');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function authorized(req: http.IncomingMessage): boolean {
  if (!token && loopback) return true;
  const url = new URL(req.url || '/', 'http://localhost');
  const queryToken = url.searchParams.get('token') || '';
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  return (queryToken && safeEqual(queryToken, token)) || (bearer && safeEqual(bearer, token));
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

function html(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src *; connect-src 'self'; img-src 'self' data:;"
  });
  res.end(body);
}

function safeTaskId(value: string): string {
  if (!/^TASK-[A-Za-z0-9_-]+$/.test(value)) throw new Error('INVALID_TASK_ID');
  return value;
}

function taskDir(): string {
  return path.join(dataRoot, 'state', 'tasks');
}

function auditDir(): string {
  return path.join(dataRoot, 'audit');
}

function readTasks(): unknown[] {
  fs.mkdirSync(taskDir(), { recursive: true });
  return fs.readdirSync(taskDir())
    .filter(name => name.endsWith('.json'))
    .flatMap(name => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(taskDir(), name), 'utf8'))];
      } catch {
        return [];
      }
    })
    .sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function readTask(taskId: string): unknown {
  const file = path.join(taskDir(), safeTaskId(taskId) + '.json');
  if (!fs.existsSync(file)) throw new Error('TASK_NOT_FOUND');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readAudit(taskId: string): unknown[] {
  const file = path.join(auditDir(), safeTaskId(taskId) + '.ndjson');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-100)
    .map(line => JSON.parse(line));
}

function dashboard(): string {
  const escapedNovnc = JSON.stringify(novncUrl);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Personal Browser Operator</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:#090b10;color:#f5f7fb}
header{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;border-bottom:1px solid #242832;background:#0d1016}
main{display:grid;grid-template-columns:minmax(0,1fr) 380px;height:calc(100vh - 64px)}
.viewport{padding:14px}.viewport iframe{width:100%;height:100%;border:1px solid #292e39;border-radius:14px;background:#050609}
.side{border-left:1px solid #242832;padding:16px;overflow:auto;background:#0d1016}
.card{border:1px solid #292e39;border-radius:12px;padding:14px;margin-bottom:12px;background:#11151d}
.muted{color:#9299a8}.pill{display:inline-block;padding:3px 8px;border-radius:999px;border:1px solid #343a48;font-size:12px}
button{background:#f5f7fb;color:#0a0c10;border:0;border-radius:9px;padding:9px 12px;font-weight:700;cursor:pointer}
select{width:100%;background:#0b0e13;color:#fff;border:1px solid #343a48;border-radius:8px;padding:9px}
pre{white-space:pre-wrap;word-break:break-word;font-size:12px;color:#c6ccda}
h1{font-size:16px;margin:0}h2{font-size:13px;margin:0 0 8px}
</style>
</head>
<body>
<header><div><h1>Personal Browser Operator</h1><span class="muted">Live takeover + durable task state</span></div><span id="status" class="pill">loading</span></header>
<main>
<section class="viewport"><iframe id="vnc" referrerpolicy="no-referrer"></iframe></section>
<aside class="side">
  <div class="card"><h2>Task</h2><select id="tasks"></select><div style="margin-top:9px"><button onclick="refresh()">Refresh</button></div></div>
  <div class="card"><h2>Current state</h2><pre id="taskState">No task selected.</pre></div>
  <div class="card"><h2>Audit trail</h2><pre id="audit">No events.</pre></div>
</aside>
</main>
<script>
const novnc = ${escapedNovnc};
document.getElementById('vnc').src = novnc;
const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
const qs = token ? '?token=' + encodeURIComponent(token) : '';

async function j(url){
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + (token ? 'token='+encodeURIComponent(token) : ''));
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
async function loadTasks(){
  const items = await j('/api/tasks');
  const select = document.getElementById('tasks');
  const prior = select.value;
  select.innerHTML = '';
  for(const t of items){
    const o=document.createElement('option');
    o.value=t.taskId;
    o.textContent=(t.status||'?')+' · '+t.goal;
    select.appendChild(o);
  }
  if(prior && items.some(x=>x.taskId===prior)) select.value=prior;
}
async function refresh(){
  try{
    await loadTasks();
    const id=document.getElementById('tasks').value;
    if(!id){document.getElementById('status').textContent='idle';return;}
    const [task,audit]=await Promise.all([j('/api/task/'+encodeURIComponent(id)),j('/api/audit/'+encodeURIComponent(id))]);
    document.getElementById('taskState').textContent=JSON.stringify(task,null,2);
    document.getElementById('audit').textContent=audit.map(x=>x.timestamp+'  '+x.eventType+'\n'+x.summary).join('\n\n');
    document.getElementById('status').textContent=task.status;
  }catch(e){document.getElementById('status').textContent='error';}
}
document.getElementById('tasks').addEventListener('change',refresh);
setInterval(refresh,3000);
refresh();
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (!authorized(req)) {
    res.setHeader('www-authenticate', 'Bearer');
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/health') {
    json(res, 200, { ok: true, service: 'pbo-console' });
    return;
  }

  if (pathname === '/' || pathname === '/console') {
    html(res, 200, dashboard());
    return;
  }

  if (pathname === '/api/tasks') {
    json(res, 200, readTasks());
    return;
  }

  if (pathname.startsWith('/api/task/')) {
    try {
      const taskId = decodeURIComponent(pathname.slice('/api/task/'.length));
      json(res, 200, readTask(taskId));
    } catch (error) {
      json(res, 404, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (pathname.startsWith('/api/audit/')) {
    try {
      const taskId = decodeURIComponent(pathname.slice('/api/audit/'.length));
      json(res, 200, readAudit(taskId));
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  json(res, 404, { error: 'not_found' });
});

server.listen(port, host, () => {
  process.stderr.write(`PBO console listening on http://${host}:${port}/console\n`);
});
