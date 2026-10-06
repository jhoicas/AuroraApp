import type { ReactNode } from 'react';

type ModalProps = {
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
};

export default function Modal({ title, titleId, onClose, children, wide }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-lg border border-gray-100`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 id={titleId} className="text-lg font-semibold text-gray-800">
            {title}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  'w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#006162]';
export const primaryBtn =
  'inline-flex items-center gap-1 rounded bg-[#006162] hover:bg-[#2c7a7b] disabled:opacity-60 text-white px-4 py-2 text-sm font-medium';
export const ghostBtn = 'rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100';
