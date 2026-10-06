import { isAxiosError } from 'axios';

const BACKEND_MESSAGES: Array<[RegExp, string]> = [
  [/credenciales inv[aá]lidas|invalid credentials/i, 'Las credenciales no coinciden. Por favor, verifica tu correo y contraseña.'],
  [/correo.*ya est[aá] registrado|already registered/i, 'Este correo ya está registrado. Prueba iniciar sesión o usa otro correo.'],
  [/nit.*correo|ya existe una entidad/i, 'Ya existe una entidad con ese NIT o el correo ya está en uso. Revisa los datos ingresados.'],
  [/correo electr[oó]nico inv[aá]lido/i, 'El correo electrónico no parece válido. Revísalo e intenta de nuevo.'],
];

const NETWORK = 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';

export function humanizeAuthError(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return NETWORK;
  if (!err.response) return NETWORK;
  const raw = (err.response.data as { error?: string } | undefined)?.error ?? '';
  const match = BACKEND_MESSAGES.find(([re]) => re.test(raw));
  if (match) return match[1];
  if (err.response.status === 401) return BACKEND_MESSAGES[0][1];
  if (err.response.status >= 500) return 'Algo salió mal de nuestro lado. Intenta de nuevo en unos minutos.';
  return fallback;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
