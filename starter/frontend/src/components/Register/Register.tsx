import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { homeForUser } from '../../lib/roles';
import { LogoAurora } from '../LogoAurora';

const inputClassName =
  'h-14 border border-slate-300 rounded-lg px-6 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 transition-all';

export default function Register() {
  const { isAuthenticated, user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [entityName, setEntityName] = useState('');
  const [nit, setNit] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<{ message: string }>('/auth/register', {
        entity_name: entityName.trim(),
        nit: nit.trim(),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      window.alert(data.message || 'Institución registrada correctamente. Ya puede iniciar sesión.');
      navigate('/login', { replace: true });
    } catch (err) {
      if (isAxiosError(err)) {
        setError(
          (err.response?.data as { error?: string } | undefined)?.error ??
            'No se pudo completar el registro. Intenta de nuevo.',
        );
      } else {
        setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row overflow-x-hidden bg-slate-50 text-slate-900">
      {/* Left Side: Visual Anchor */}
      <section
        className="hidden md:flex md:w-5/12 p-16 flex-col justify-center items-start relative overflow-hidden"
        style={{
          backgroundColor: '#f0fdfa',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232c7a7b' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      >
        <div className="relative z-10 space-y-6">
          <div className="mb-10">
            <LogoAurora className="w-12 h-12 text-teal-600" />
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-700 max-w-md leading-tight">
            Transforme la formulación de proyectos en su región
          </h1>

          <p className="text-lg text-slate-500 max-w-sm leading-relaxed">
            Únase a la plataforma líder en gestión de inversión pública con IA.
          </p>

          <div className="pt-16 grid grid-cols-1 gap-6">
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-slate-200 shadow-sm">
              <span
                className="material-symbols-outlined text-teal-700"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified_user
              </span>
              <span className="font-semibold text-lg text-slate-800">Seguridad Gubernamental</span>
            </div>
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-slate-200 shadow-sm">
              <span
                className="material-symbols-outlined text-teal-700"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                monitoring
              </span>
              <span className="font-semibold text-lg text-slate-800">Análisis de Datos con IA</span>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-teal-700/5 rounded-full blur-3xl" />
      </section>

      {/* Right Side: Registration Form */}
      <section className="flex-1 bg-slate-100/80 px-4 md:px-16 py-16 flex items-center justify-center">
        <div className="w-full max-w-[600px]">
          <div className="flex md:hidden justify-center mb-10">
            <LogoAurora className="w-10 h-10 text-teal-600" />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-16 shadow-sm">
            <div className="mb-16 text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-1">
                Registrar Institución
              </h2>
              <p className="text-base md:text-lg text-slate-600">
                Cree el espacio de trabajo para su entidad
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="entity_name" className="font-semibold text-lg text-slate-800">
                    Nombre de la Entidad
                  </label>
                  <input
                    type="text"
                    id="entity_name"
                    required
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder="Ej. Alcaldía de Yumbo"
                    className={inputClassName}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="nit" className="font-semibold text-lg text-slate-800">
                    NIT / ID Tributaria
                  </label>
                  <input
                    type="text"
                    id="nit"
                    required
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                    placeholder="900.000.000-1"
                    className={inputClassName}
                  />
                </div>
              </div>

              <hr className="border-slate-200 my-6" />

              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="full_name" className="font-semibold text-lg text-slate-800">
                    Nombre completo (Administrador)
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ingrese su nombre"
                    className={inputClassName}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="register_email" className="font-semibold text-lg text-slate-800">
                    Correo institucional
                  </label>
                  <input
                    type="email"
                    id="register_email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@entidad.gov.co"
                    className={inputClassName}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="register_password" className="font-semibold text-lg text-slate-800">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      id="register_password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClassName}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="confirm_password" className="font-semibold text-lg text-slate-800">
                      Confirmar contraseña
                    </label>
                    <input
                      type="password"
                      id="confirm_password"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 font-medium">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 bg-teal-700 hover:bg-[#006162] active:scale-95 disabled:opacity-60 text-white font-semibold text-lg rounded-lg shadow-md transition-all duration-300 flex items-center justify-center gap-2 mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-600"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                    Cargando...
                  </>
                ) : (
                  <>
                    Crear cuenta institucional
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </>
                )}
              </button>
              <div className="pt-6 text-center">
                <p className="text-base font-medium text-slate-600">
                  ¿Su entidad ya está registrada?{' '}
                  <Link
                    to="/login"
                    className="text-teal-600 font-bold hover:underline ml-1 transition-all"
                  >
                    Iniciar sesión
                  </Link>
                </p>
              </div>
            </form>
          </div>

          <div className="mt-10 flex justify-center gap-6 text-sm text-slate-500">
            <a href="#ayuda" onClick={(e) => e.preventDefault()} className="hover:text-teal-700">
              Centro de Ayuda
            </a>
            <span>•</span>
            <a href="#terminos" onClick={(e) => e.preventDefault()} className="hover:text-teal-700">
              Términos
            </a>
            <span>•</span>
            <a href="#privacidad" onClick={(e) => e.preventDefault()} className="hover:text-teal-700">
              Privacidad
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
