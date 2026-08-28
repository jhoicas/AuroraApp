import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';

export type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Tiempo máximo en ms (default 180_000). */
  timeoutMs?: number;
};

export type RunCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

/**
 * Ejecuta un comando de forma síncrona (Promise) capturando stdout/stderr.
 * En Windows usa shell para resolver `docker` / `go` del PATH.
 * Rechaza con mensaje accionable si el exit code ≠ 0 o hay timeout.
 */
export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<RunCommandResult> {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const display = [command, ...args].join(' ');

  return new Promise((resolve, reject) => {
    const spawnOpts: SpawnOptionsWithoutStdio = {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: process.platform === 'win32',
    };

    const child = spawn(command, args, spawnOpts);
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(
        new Error(
          `Timeout (${timeoutMs}ms) ejecutando:\n  ${display}\n` +
            `cwd=${options.cwd ?? process.cwd()}\n` +
            `stdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `No se pudo lanzar el proceso "${command}": ${err.message}\n` +
            `Comando: ${display}\n` +
            `¿Está instalado y en el PATH?`,
        ),
      );
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        reject(
          new Error(
            `Comando falló (exit ${exitCode}):\n  ${display}\n` +
              `cwd=${options.cwd ?? process.cwd()}\n` +
              `stdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        );
        return;
      }
      resolve({ code: exitCode, stdout, stderr });
    });
  });
}

/**
 * Reintenta `fn` hasta `attempts` veces con backoff lineal.
 */
export async function retry<T>(
  label: string,
  attempts: number,
  delayMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, delayMs * i));
      }
    }
  }
  throw new Error(
    `${label}: agotados ${attempts} intentos.\n` +
      `${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
