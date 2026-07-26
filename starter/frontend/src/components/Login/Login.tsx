import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../../context/AuthContext';
import { homeForUser, normalizeRole, Roles } from '../../lib/roles';
import { LogoAurora } from '../LogoAurora';

export default function Login() {
  const { login, isAuthenticated, user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectAfterAuth = (authUser: { role: string; tenant_id: string | null }) => {
    const userRole = normalizeRole(authUser.role);

    if (userRole === Roles.SuperAdmin) {
      navigate('/admin/tenants', { replace: true });
      return;
    }

    // Flujo Tenant estándar
    if (authUser.tenant_id) {
      navigate('/tenant/projects', { replace: true });
      return;
    }

    // Usuario común sin tenant asignado
    logout();
    navigate('/login', { replace: true });
  };

  if (!isLoading && isAuthenticated && user) {
    const dest = homeForUser(user);
    if (dest === '/login') {
      logout();
      return <Navigate to="/login" replace />;
    }
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login(email, password);
      redirectAfterAuth(loggedUser);
    } catch (err) {
      if (isAxiosError(err)) {
        setError(
          (err.response?.data as { error?: string } | undefined)?.error ??
            'Credenciales inválidas. Verifica tu correo y contraseña.',
        );
      } else {
        setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-12 bg-slate-50">
      {/* Atmosphere */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-teal-200/30 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-teal-100/40 blur-[150px]" />
      </div>

      <main className="w-full max-w-[500px] flex flex-col gap-12">
        <header className="flex flex-col items-center text-center space-y-4">
          <p className="text-base md:text-lg text-slate-600 max-w-[320px] leading-relaxed">
            Portal de Formulación de Proyectos de Inversión Pública
          </p>
        </header>

        <section className="bg-white/95 backdrop-blur-md border border-slate-200 p-6 md:p-10 rounded-xl shadow-sm">
          <div className="flex justify-center mb-8">
            <LogoAurora className="w-12 h-12 text-teal-600" />
          </div>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-base font-semibold text-slate-800">
                Correo electrónico
              </label>
              <div className="relative flex items-center rounded-lg focus-within:ring-2 focus-within:ring-teal-600/30">
                <span className="absolute left-4 material-symbols-outlined text-slate-400 pointer-events-none">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@aurora.gov"
                  className="w-full h-14 pl-14 pr-4 border border-slate-300 rounded-lg bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-base font-semibold text-slate-800">
                Contraseña
              </label>
              <div className="relative flex items-center rounded-lg focus-within:ring-2 focus-within:ring-teal-600/30">
                <span className="absolute left-4 material-symbols-outlined text-slate-400 pointer-events-none">
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-14 pl-14 pr-14 border border-slate-300 rounded-lg bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 text-slate-400 hover:text-teal-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-600 cursor-pointer"
                />
                <span className="text-sm text-slate-500 group-hover:text-teal-700 transition-colors">
                  Recordarme
                </span>
              </label>
              <a
                href="#recuperar"
                className="text-sm font-bold text-teal-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
                onClick={(e) => e.preventDefault()}
              >
                ¿Olvidó su contraseña?
              </a>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-14 mt-2 bg-teal-700 hover:bg-teal-600 active:scale-[0.98] disabled:opacity-60 text-white font-semibold text-lg rounded-lg shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-600"
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  Ingresando…
                </span>
              ) : (
                'Ingresar'
              )}
            </button>

            <p className="text-center text-sm text-slate-600 pt-1">
              ¿Su entidad no está registrada?{' '}
              <Link
                to="/register"
                className="text-teal-600 hover:text-teal-700 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
              >
                Crea una cuenta institucional
              </Link>
            </p>
          </form>
        </section>

        <footer className="mt-4 text-center space-y-3">
          <p className="text-sm text-slate-500">
            © 2026 AuroraApp · Sistema gubernamental de gestión
          </p>
          <div className="flex justify-center gap-6">
            <a
              href="#accesibilidad"
              onClick={(e) => e.preventDefault()}
              className="text-sm text-slate-400 hover:text-teal-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
            >
              Accesibilidad
            </a>
            <a
              href="#terminos"
              onClick={(e) => e.preventDefault()}
              className="text-sm text-slate-400 hover:text-teal-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
            >
              Términos
            </a>
            <a
              href="#privacidad"
              onClick={(e) => e.preventDefault()}
              className="text-sm text-slate-400 hover:text-teal-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
            >
              Privacidad
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
