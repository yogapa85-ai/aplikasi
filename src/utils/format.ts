export function formatCompactIDR(value: number): string {
  if (!Number.isFinite(value) || value === 0) return 'Rp 0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}Rp ${(abs / 1e9).toFixed(2).replace('.', ',')} M`;
  if (abs >= 1e6) return `${sign}Rp ${(abs / 1e6).toFixed(1).replace('.', ',')} Jt`;
  if (abs >= 1e3) return `${sign}Rp ${(abs / 1e3).toFixed(0)} Rb`;
  return `${sign}Rp ${Math.round(abs).toLocaleString('id-ID')}`;
}

export function formatFullIDR(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0';
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

export function formatPercentID(value: number): string {
  if (!Number.isFinite(value)) return '0,00%';
  return `${value.toFixed(2).replace('.', ',')}%`;
}

export function formatTimeID(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function getCycleLimit(ca?: string): number {
  const norm = (ca || '').trim().toUpperCase();
  if (norm === 'C0') return 9;
  if (norm === 'C1' || norm === 'C2') return 11;
  return 10;
}

export function getPerformanceStatus(
  inPercent: number,
  ca?: string
): {
  label: string;
  tone: 'emerald' | 'amber' | 'rose';
  limit: number;
} {
  const limit = getCycleLimit(ca);
  if (inPercent > limit) return { label: 'Busuk', tone: 'rose', limit };
  if (inPercent > limit - 1.5) return { label: 'Waspada', tone: 'amber', limit };
  return { label: 'Bagus', tone: 'emerald', limit };
}

export function parsePeriodSortKey(periode: string): number {
  const parts = periode.split('/');
  if (parts.length >= 3) {
    const m = parseInt(parts[1], 10) || 0;
    const y = parseInt(parts[2], 10) || 0;
    return y * 100 + m;
  }
  return 0;
}
