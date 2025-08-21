export const fetcher = (url: string) =>
  fetch(`http://localhost:4000${url}`).then((res) => res.json());

export async function getCarbonSummary(params?: { from?: string; to?: string }) {
  const qs = new URLSearchParams(params as any).toString();
  const res = await fetch(`/api/metrics/carbon${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch carbon metrics');
  return res.json();
}

