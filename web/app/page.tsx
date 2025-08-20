"use client";

import useSWR from "swr";
import { fetcher } from "../lib/api";

export default function HomePage() {
  const { data, error } = useSWR("/metrics", fetcher);

  if (error) return <div>❌ Failed to load</div>;
  if (!data) return <div>⏳ Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Carbon Emissions</h1>
      <table className="table-auto border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-4 py-2">Job ID</th>
            <th className="border px-4 py-2">Energy (kWh)</th>
            <th className="border px-4 py-2">CO₂e (kg)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.job_id}>
              <td className="border px-4 py-2">{row.job_id}</td>
              <td className="border px-4 py-2">{row.energy_kwh.toFixed(2)}</td>
              <td className="border px-4 py-2">{row.co2_kg.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
