import { type FormEvent, useState } from 'react';
import { useTenantStore } from '../../store/tenantStore';

type CreateTenantModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function CreateTenantModal({ open, onClose }: CreateTenantModalProps) {
  const createTenant = useTenantStore((s) => s.createTenant);
  const isLoading = useTenantStore((s) => s.isLoading);

  const [name, setName] = useState('');
  const [nit, setNit] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setName('');
    setNit('');
    setContactEmail('');
    setDomain('');
    setFormError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      await createTenant({
        name,
        nit,
        contact_email: contactEmail,
        domain: domain || undefined,
      });
      handleClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el tenant');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-tenant-title"
        className="w-full max-w-lg rounded-lg bg-white shadow-lg border border-gray-100"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 id="create-tenant-title" className="text-lg font-semibold text-gray-800">
            Nueva entidad
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="tenant-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              id="tenant-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="Alcaldía de Ejemplo"
            />
          </div>

          <div>
            <label htmlFor="tenant-nit" className="block text-sm font-medium text-gray-700 mb-1">
              NIT
            </label>
            <input
              id="tenant-nit"
              required
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="900123456-1"
            />
          </div>

          <div>
            <label htmlFor="tenant-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email de contacto
            </label>
            <input
              id="tenant-email"
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="contacto@alcaldia.gov.co"
            />
          </div>

          <div>
            <label htmlFor="tenant-domain" className="block text-sm font-medium text-gray-700 mb-1">
              Dominio <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              id="tenant-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="alcaldia.gov.co"
            />
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {isLoading ? 'Guardando…' : 'Crear entidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
