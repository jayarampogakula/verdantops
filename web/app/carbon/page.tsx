'use client';
import { useEffect, useState } from 'react';
import { getCarbonSummary } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

export default function CarbonPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getCarbonSummary().then(setData).catch(e => setErr(String(e)));
  }, []);

  if (err) return <div className="p-8">Error: {err}</div>;
  if (!data) return <div className="p-8">Loading carbon metrics…</div>;

  const cards = [
    { label: 'Total CO₂e (kg)', value: data.totals.co2eKg.toFixed(3) },
    { label: 'Energy (kWh)', value: data.totals.kwh.toFixed(3) },
    { label: 'Data I/O (TB)', value: (data.totals.bytesIO / (1024**4)).toFixed(3) },
    { label: 'kg CO₂e / TB', value: data.kpis.kgCo2ePerTB.toFixed(3) }
  ];

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold">Carbon Footprint</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="rounded-2xl shadow p-4">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl shadow p-4">
        <div className="text-sm text-gray-500 mb-2">CO₂e trend (kg/day)</div>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <AreaChart data={data.byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="co2eKg" strokeWidth={2} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
