import { Check, Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

type MgaAccordionProps = {
  number: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export default function MgaAccordion({ number, title, open, onToggle, children }: MgaAccordionProps) {
  return (
    <div className="border border-gray-200 rounded">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-50 font-semibold text-sm text-gray-700"
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2e7d32] text-white text-xs">
            <Check className="w-3 h-3" />
          </span>
          <span>
            {number} - {title}
          </span>
        </div>
        <span className="flex items-center justify-center w-5 h-5 rounded-full border border-gray-400 text-gray-600">
          {open ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </span>
      </button>
      {open && <div className="p-4 text-xs">{children}</div>}
    </div>
  );
}
