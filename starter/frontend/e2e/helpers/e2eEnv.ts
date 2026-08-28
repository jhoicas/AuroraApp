/**
 * Constantes compartidas del ciclo de vida E2E (Postgres efímero + backend :8081).
 */
export const E2E_DATABASE_URL =
  'postgres://e2e_user:e2e_pass@127.0.0.1:5433/aurora_e2e?sslmode=disable';

export const E2E_JWT_SECRET = 'e2e-jwt-secret-not-for-prod';

export const E2E_BACKEND_PORT = '8081';

export const E2E_API_BASE = `http://127.0.0.1:${E2E_BACKEND_PORT}/api/v1`;

export const E2E_HEALTHZ_URL = `http://127.0.0.1:${E2E_BACKEND_PORT}/healthz`;

export type E2ERuntime = {
  composeFile: string;
  starterRoot: string;
  backendRoot: string;
  binaryPath: string;
  databaseUrl: string;
  jwtSecret: string;
  backendPort: string;
  /** PID del proceso backend arrancado en globalSetup. */
  backendPid?: number;
};
