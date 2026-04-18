const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const cors = require("cors");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const DATA_DIR = path.join(process.cwd(), "shadowpanel-data");
const SERVERS_DIR = path.join(DATA_DIR, "servers");
const DB_FILE = path.join(DATA_DIR, "servers.json");
const DEFAULT_PORT = process.env.PORT ? Number(process.env.PORT) : 20202;

const processes = new Map();
const consoleBuffers = new Map();
const statusMap = new Map();

function nowIso() {
  return new Date().toISOString();
}

function safeName(name) {
  return String(name || "server").trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "server";
}

function ensureBuffer(id) {
  if (!consoleBuffers.has(id)) consoleBuffers.set(id, []);
  return consoleBuffers.get(id);
}

function pushConsole(id, line) {
  const msg = `[${new Date().toLocaleTimeString()}] ${line}`;
  const buffer = ensureBuffer(id);
  buffer.push(msg);
  while (buffer.length > 500) buffer.shift();
  broadcast({ type: "console", serverId: id, line: msg });
}

function broadcast(payload) {
  const text = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(text);
  }
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function loadServers() {
  await ensureDir(DATA_DIR);
  await ensureDir(SERVERS_DIR);
  try {
    const raw = await fsp.readFile(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    const initial = [{
      id: "srv-test",
      name: "test",
      type: "PocketMine-MP",
      status: "offline",
      players: 0,
      maxPlayers: 20,
      ramMb: 0,
      port: 19132,
      autoRestart: true,
      workingDir: path.join(SERVERS_DIR, "test", "data"),
      phpBinary: "./bin/php7/bin/php",
      phpIniDir: path.join(SERVERS_DIR, "test", "data", "bin", "php7", "bin"),
      pharPath: path.join(SERVERS_DIR, "test", "data", "PocketMine-MP.phar"),
    }];
    await saveServers(initial);
    return initial;
  }
}

async function saveServers(servers) {
  await ensureDir(DATA_DIR);
  await fsp.writeFile(DB_FILE, JSON.stringify(servers, null, 2));
}

async function getServers() {
  return loadServers();
}

async function findServer(id) {
  const servers = await getServers();
  return servers.find((s) => s.id === id) || null;
}

async function updateServer(id, updater) {
  const servers = await getServers();
  const index = servers.findIndex((s) => s.id === id);
  if (index < 0) return null;
  const next = { ...servers[index], ...updater(servers[index]) };
  servers[index] = next;
  await saveServers(servers);
  return next;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).map((entry) => {
    const full = path.join(dir, entry.name);
    return {
      name: entry.name,
      type: entry.isDirectory() ? "dir" : "file",
      size: entry.isDirectory() ? "pasta" : (() => {
        try {
          return `${Math.max(1, Math.round(fs.statSync(full).size / 1024))} KB`;
        } catch {
          return "?";
        }
      })(),
    };
  });
}

async function createServer(data) {
  const servers = await getServers();
  const name = safeName(data.name);
  const type = data.type || "PocketMine-MP";
  const serverRoot = path.join(SERVERS_DIR, name);
  const workingDir = path.join(serverRoot, "data");
  await ensureDir(workingDir);
  await ensureDir(path.join(workingDir, "bin", "php7", "bin"));
  const created = {
    id: `srv-${Math.random().toString(36).slice(2, 10)}`,
    name,
    type,
    status: "offline",
    players: 0,
    maxPlayers: Number(data.maxPlayers || (type === "PocketMine-MP" ? 20 : 100)),
    ramMb: 0,
    port: Number(data.port || (type === "PocketMine-MP" ? 19132 : 25565)),
    autoRestart: Boolean(data.autoRestart),
    workingDir,
    phpBinary: "./bin/php7/bin/php",
    phpIniDir: path.join(workingDir, "bin", "php7", "bin"),
    pharPath: path.join(workingDir, "PocketMine-MP.phar"),
  };
  servers.unshift(created);
  await saveServers(servers);
  pushConsole(created.id, `[PANEL] Servidor ${created.name} criado.`);
  return created;
}

function shellForServer(serverDef) {
  if (serverDef.type === "PocketMine-MP") {
    return {
      command: "./bin/php7/bin/php",
      args: ["./PocketMine-MP.phar"],
      env: {
        HOME: serverDef.workingDir,
        PWD: serverDef.workingDir,
        TMPDIR: path.join(serverDef.workingDir, "tmp"),
        PHPRC: serverDef.phpIniDir,
        PHP_INI_SCAN_DIR: serverDef.phpIniDir,
      },
    };
  }
  if (serverDef.type === "Java") {
    return {
      command: "java",
      args: ["-Xmx2G", "-jar", path.join(serverDef.workingDir, "server.jar")],
      env: { HOME: serverDef.workingDir, PWD: serverDef.workingDir },
    };
  }
  return {
    command: "sh",
    args: ["-lc", "echo 'Bedrock backend placeholder'; sleep 1"],
    env: { HOME: serverDef.workingDir, PWD: serverDef.workingDir },
  };
}

async function markStatus(id, status, ramMb = undefined) {
  statusMap.set(id, status);
  await updateServer(id, (srv) => ({ status, ramMb: ramMb === undefined ? srv.ramMb : ramMb }));
  broadcast({ type: "status", serverId: id, status });
}

async function startServer(id) {
  const serverDef = await findServer(id);
  if (!serverDef) throw new Error("Servidor não encontrado");
  if (processes.has(id)) throw new Error("Servidor já está em execução");

  await ensureDir(serverDef.workingDir);
  await ensureDir(path.join(serverDef.workingDir, "tmp"));

  const { command, args, env } = shellForServer(serverDef);
  pushConsole(id, `[PANEL] Iniciando ${serverDef.name}...`);
  pushConsole(id, `[PANEL] Comando real: ${command} ${args.join(" ")}`);

  const child = spawn(command, args, {
    cwd: serverDef.workingDir,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  processes.set(id, child);
  await markStatus(id, "starting", 64);

  child.stdout.on("data", async (buf) => {
    const text = buf.toString("utf8");
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      pushConsole(id, line);
      if (/done|listening|started/i.test(line) && statusMap.get(id) !== "online") {
        await markStatus(id, "online", serverDef.type === "PocketMine-MP" ? 412 : 768);
      }
    }
  });

  child.stderr.on("data", (buf) => {
    const text = buf.toString("utf8");
    for (const line of text.split(/\r?\n/).filter(Boolean)) pushConsole(id, `[stderr] ${line}`);
  });

  child.on("exit", async (code, signal) => {
    processes.delete(id);
    const wasOnline = statusMap.get(id) === "online";
    await updateServer(id, () => ({ status: "offline", ramMb: 0, players: 0 }));
    statusMap.set(id, "offline");
    pushConsole(id, `[PANEL] Processo encerrado. code=${code} signal=${signal || "none"}`);
    broadcast({ type: "status", serverId: id, status: wasOnline ? "offline" : "crashed" });
  });

  return { ok: true };
}

async function stopServer(id) {
  const proc = processes.get(id);
  if (!proc) throw new Error("Servidor não está em execução");
  pushConsole(id, `[PANEL] Encerrando servidor...`);
  proc.kill("SIGTERM");
  return { ok: true };
}

async function restartServer(id) {
  if (processes.has(id)) {
    await stopServer(id);
    await new Promise((r) => setTimeout(r, 1000));
  }
  return startServer(id);
}

function safeJoin(base, name) {
  const target = path.normalize(path.join(base, name));
  if (!target.startsWith(path.normalize(base))) throw new Error("Caminho inválido");
  return target;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, now: nowIso() }));

app.get("/api/servers", async (_req, res) => {
  const servers = await getServers();
  const full = servers.map((srv) => ({ ...srv, console: ensureBuffer(srv.id), files: listFiles(srv.workingDir) }));
  res.json(full);
});

app.post("/api/servers", async (req, res) => {
  try {
    const created = await createServer(req.body || {});
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/servers/:id/start", async (req, res) => {
  try {
    res.json(await startServer(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/servers/:id/stop", async (req, res) => {
  try {
    res.json(await stopServer(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/servers/:id/restart", async (req, res) => {
  try {
    res.json(await restartServer(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/servers/:id/command", async (req, res) => {
  const proc = processes.get(req.params.id);
  if (!proc) return res.status(400).json({ error: "Servidor offline" });
  const command = String(req.body?.command || "").trim();
  if (!command) return res.status(400).json({ error: "Comando vazio" });
  proc.stdin.write(`${command}\n`);
  pushConsole(req.params.id, `> ${command}`);
  res.json({ ok: true });
});

app.get("/api/servers/:id/files/:name", async (req, res) => {
  try {
    const serverDef = await findServer(req.params.id);
    if (!serverDef) throw new Error("Servidor não encontrado");
    const filePath = safeJoin(serverDef.workingDir, req.params.name);
    const content = await fsp.readFile(filePath, "utf8");
    res.json({ name: req.params.name, content });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/servers/:id/files/:name", async (req, res) => {
  try {
    const serverDef = await findServer(req.params.id);
    if (!serverDef) throw new Error("Servidor não encontrado");
    const filePath = safeJoin(serverDef.workingDir, req.params.name);
    await fsp.writeFile(filePath, String(req.body?.content || ""), "utf8");
    pushConsole(req.params.id, `[PANEL] Arquivo salvo: ${req.params.name}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/servers/:id/upload", upload.single("file"), async (req, res) => {
  try {
    const serverDef = await findServer(req.params.id);
    if (!serverDef) throw new Error("Servidor não encontrado");
    if (!req.file) throw new Error("Arquivo não enviado");
    const filePath = safeJoin(serverDef.workingDir, req.file.originalname);
    await fsp.writeFile(filePath, req.file.buffer);
    pushConsole(req.params.id, `[PANEL] Upload concluído: ${req.file.originalname}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

wss.on("connection", async (ws) => {
  ws.send(JSON.stringify({ type: "hello", now: nowIso() }));
  const servers = await getServers();
  ws.send(JSON.stringify({ type: "snapshot", servers: servers.map((s) => ({ id: s.id, status: s.status, console: ensureBuffer(s.id) })) }));
});

server.listen(DEFAULT_PORT, async () => {
  await ensureDir(DATA_DIR);
  await ensureDir(SERVERS_DIR);
  console.log(`ShadowPanel backend running on http://localhost:${DEFAULT_PORT}`);
});
