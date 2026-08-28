import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  E2E_BACKEND_PORT,
  E2E_DATABASE_URL,
  E2E_HEALTHZ_URL,
  E2E_JWT_SECRET,
  type E2ERuntime,
} from './helpers/e2eEnv';
import { retry, runCommand } from './helpers/runCommand';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const STARTER_ROOT = path.resolve(FRONTEND_ROOT, '..');
const BACKEND_ROOT = path.join(STARTER_ROOT, 'backend');
const COMPOSE_FILE = path.join(STARTER_ROOT, 'docker-compose.e2e.yml');
const RUNTIME_FILE = path.join(__dirname, '.runtime.json');
const BIN_NAME = process.platform === 'win32' ? 'aurora-e2e.exe' : 'aurora-e2e';
const BINARY_PATH = path.join(BACKEND_ROOT, 'bin', BIN_NAME);

function waitForTcp(host: string, port: number, timeoutMs = 5_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TCP ${host}:${port} no responde en ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    });
  });
}

async function waitForHealthz(url: string, timeoutMs = 5_000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`healthz HTTP ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function dockerComposeUp(): Promise<void> {
  if (!fs.existsSync(COMPOSE_FILE)) {
    throw new Error(`No se encontró docker-compose.e2e.yml en:\n  ${COMPOSE_FILE}`);
  }

  console.log('[e2e setup] Levantando Postgres/pgvector efímero…');
  try {
    await runCommand(
      'docker',
      ['compose', '-p', 'aurora-e2e', '-f', COMPOSE_FILE, 'up', '-d', '--wait'],
      { cwd: STARTER_ROOT, timeoutMs: 180_000 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/dockerDesktopLinuxEngine|cannot find the file specified|Is the docker daemon running/i.test(msg)) {
      throw new Error(
        'Docker Desktop no está en ejecución (o el daemon no responde).\n' +
          'Inicia Docker Desktop y vuelve a ejecutar: npm run test:e2e:chromium\n\n' +
          msg,
      );
    }
    console.warn(
      '[e2e setup] `up --wait` falló; reintentando sin --wait y esperando TCP :5433…\n',
      msg,
    );
    await runCommand(
      'docker',
      ['compose', '-p', 'aurora-e2e', '-f', COMPOSE_FILE, 'up', '-d'],
      { cwd: STARTER_ROOT, timeoutMs: 180_000 },
    );
    await retry('Espera Postgres :5433', 30, 1_000, () =>
      waitForTcp('127.0.0.1', 5433),
    );
  }

  await retry('Postgres listo (TCP)', 15, 500, () => waitForTcp('127.0.0.1', 5433));
  console.log('[e2e setup] Postgres E2E saludable en 127.0.0.1:5433');
}

async function migrateAndSeed(): Promise<void> {
  console.log('[e2e setup] AutoMigrate + seed (go run ./cmd/seed)…');
  await runCommand('go', ['run', './cmd/seed'], {
    cwd: BACKEND_ROOT,
    timeoutMs: 180_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      JWT_SECRET: E2E_JWT_SECRET,
      EMBEDDING_PROVIDER: 'mock',
      PORT: E2E_BACKEND_PORT,
    },
  });
  console.log('[e2e setup] Migración y seed OK (admin@aurora.gov.co)');
}

async function buildBackendBinary(): Promise<void> {
  const binDir = path.dirname(BINARY_PATH);
  fs.mkdirSync(binDir, { recursive: true });

  console.log(`[e2e setup] Compilando backend → ${BINARY_PATH}`);
  await runCommand('go', ['build', '-o', BINARY_PATH, './cmd/server'], {
    cwd: BACKEND_ROOT,
    timeoutMs: 180_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      JWT_SECRET: E2E_JWT_SECRET,
      EMBEDDING_PROVIDER: 'mock',
    },
  });

  if (!fs.existsSync(BINARY_PATH)) {
    throw new Error(`El binario E2E no se generó en ${BINARY_PATH}`);
  }
  console.log('[e2e setup] Binario listo');
}

/**
 * Arranca el binario en background.
 * Playwright ejecuta globalSetup en un proceso que termina al completar;
 * por eso el hijo debe ser detached + unref en todas las plataformas.
 */
function startBackendProcess(): ChildProcess {
  console.log(`[e2e setup] Arrancando backend en :${E2E_BACKEND_PORT}…`);
  const child = spawn(BINARY_PATH, [], {
    cwd: BACKEND_ROOT,
    env: {
      ...process.env,
      PORT: E2E_BACKEND_PORT,
      DATABASE_URL: E2E_DATABASE_URL,
      JWT_SECRET: E2E_JWT_SECRET,
      EMBEDDING_PROVIDER: 'mock',
    },
    stdio: 'ignore',
    detached: true,
    windowsHide: true,
  });

  child.on('error', (err) => {
    console.error('[e2e setup] Error al lanzar backend:', err.message);
  });

  return child;
}

function writeRuntime(backendPid: number): void {
  const runtime: E2ERuntime & { backendPid: number } = {
    composeFile: COMPOSE_FILE,
    starterRoot: STARTER_ROOT,
    backendRoot: BACKEND_ROOT,
    binaryPath: BINARY_PATH,
    databaseUrl: E2E_DATABASE_URL,
    jwtSecret: E2E_JWT_SECRET,
    backendPort: E2E_BACKEND_PORT,
    backendPid,
  };
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(runtime, null, 2), 'utf8');
}

/**
 * Global setup de Playwright (se ejecuta DESPUÉS de webServer del frontend):
 * 1) Docker Compose Postgres/pgvector
 * 2) Migraciones (AutoMigrate vía seed)
 * 3) Build + arranque del binario Go en :8081
 */
export default async function globalSetup(): Promise<void> {
  console.log('[e2e setup] === FASE 6: infraestructura E2E ===');
  await dockerComposeUp();
  await migrateAndSeed();
  await buildBackendBinary();

  const child = startBackendProcess();
  if (child.pid == null) {
    throw new Error('No se pudo obtener PID del proceso backend E2E');
  }

  try {
    await retry('Backend /healthz', 40, 500, () => waitForHealthz(E2E_HEALTHZ_URL));
  } catch (err) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    throw err;
  }

  // Detached + unref: el proceso setup de Playwright termina tras este return.
  child.unref();

  writeRuntime(child.pid);
  console.log('[e2e setup] Completado. Backend PID=', child.pid, '→', RUNTIME_FILE);
}
