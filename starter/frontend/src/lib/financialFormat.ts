const currencyFmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const BAR_NAME_VPN = 'VPN';
export const BAR_NAME_TIR = 'TIR (%)';

export function formatVPN(vpn: number): string {
  return currencyFmt.format(Math.round(vpn));
}

/** La TIR llega como fracción decimal desde el motor Go (0.0964 → "9,64 %"). */
export function formatTIR(tir: number | null | undefined): string {
  if (tir == null || Number.isNaN(tir)) return 'No calculable';
  return `${(tir * 100).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

/** Formatea los valores del tooltip de recharts; `name` es el prop `name` de cada Bar. */
export function tooltipFormatter(value: unknown, name: unknown): [string, string] {
  const num = typeof value === 'number' ? value : Number(value ?? 0);
  return name === BAR_NAME_TIR ? [formatTIR(num / 100), 'TIR'] : [formatVPN(num), 'VPN'];
}
