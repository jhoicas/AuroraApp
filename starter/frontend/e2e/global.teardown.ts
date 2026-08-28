import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { E2ERuntime } from './helpers/e2eEnv';
import { runCommand } from './helpers/runCommand';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_FILE = path.join(__dirname, '.runtime.json');

type RuntimeWithPid = E2ERuntime & { backendPid?: number };

function loadRuntime(): RuntimeWithPid | null {
  if (!fs.existsSync(RUNTIME_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf8')) as RuntimeWithPid;
  } catch (err) {
    console.warn(
      '[e2e teardown] No se pudo leer .runtime.json:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function killBackend(pid: number | undefined): void {
  if (pid == null || pid <= 0) {
    return;
  }
  console.log('[e2e teardown] Deteniendo backend PID', pid);
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      if (result.status !== 0 && result.stderr) {
        console.warn('[e2e teardown] taskkill:', result.stderr.trim());
      }
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch (err) {
    console.warn(
      '[e2e teardown] No se pudo matar backend:',
      err instanceof Error ? err.message : err,
    );
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* ya no existe */
    }
  }
}

/**
 * Global teardown: mata el backend E2E, apaga Postgres y destruye volúmenes (-v).
 */
export default async function globalTeardown(): Promise<void> {
  console.log('[e2e teardown] === Limpieza infraestructura E2E ===');
  const runtime = loadRuntime();

  const composeFile =
    runtime?.composeFile ??
    path.resolve(__dirname, '..', '..', 'docker-compose.e2e.yml');
  const starterRoot =
    runtime?.starterRoot ?? path.resolve(__dirname, '..', '..');
  const binaryPath = runtime?.binaryPath;

  const errors: string[] = [];

  killBackend(runtime?.backendPid);

  try {
    console.log('[e2e teardown] docker compose down -v…');
    await runCommand(
      'docker',
      ['compose', '-p', 'aurora-e2e', '-f', composeFile, 'down', '-v', '--remove-orphans'],
      { cwd: starterRoot, timeoutMs: 120_000 },
    );
    console.log('[e2e teardown] Contenedor y volúmenes destruidos');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/dockerDesktopLinuxEngine|cannot find the file specified|Is the docker daemon running/i.test(msg)) {
      console.warn(
        '[e2e teardown] Docker daemon no disponible; se omite down -v.\n',
        msg,
      );
    } else {
      console.error('[e2e teardown] Falló docker compose down -v:\n', msg);
      errors.push(msg);
    }
  }

  if (binaryPath && fs.existsSync(binaryPath)) {
    try {
      fs.unlinkSync(binaryPath);
      console.log('[e2e teardown] Binario eliminado:', binaryPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[e2e teardown] No se pudo borrar el binario:', msg);
      errors.push(msg);
    }
  }

  if (fs.existsSync(RUNTIME_FILE)) {
    try {
      fs.unlinkSync(RUNTIME_FILE);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[e2e teardown] No se pudo borrar .runtime.json:', msg);
      errors.push(msg);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Teardown E2E completó con errores:\n${errors.map((e) => `- ${e}`).join('\n')}`,
    );
  }

  console.log('[e2e teardown] Completado');
}
