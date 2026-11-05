import React from 'react';
import { Thermometer, Droplets, Gauge } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

/**
 * 1. Dedicated Temperature Card (°C)
 */
export function TemperatureCard({ sensor }) {
  const temp = sensor?.temperature_c ?? null;
  const status = sensor?.status || 'missing';

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base text-slate-900 font-normal">Temperature</h3>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="bg-slate-50/80 py-8 px-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
        <div className="text-4xl sm:text-5xl text-orange-600 font-normal tracking-tight flex items-baseline justify-center gap-1.5">
          <span>{temp !== null && temp !== undefined ? Number(temp).toFixed(1) : '—'}</span>
          <span className="text-xl sm:text-2xl text-slate-400 font-normal">°C</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Dedicated Relative Humidity Card (%)
 */
export function HumidityCard({ sensor }) {
  const status = sensor?.status || 'missing';
  const hum = sensor?.humidity_pct;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-cyan-50 text-cyan-600">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base text-slate-900 font-normal">Humidity</h3>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="bg-slate-50/80 py-8 px-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
        <div className="text-4xl sm:text-5xl text-cyan-600 font-normal tracking-tight flex items-baseline justify-center gap-1.5">
          <span>{hum !== null && hum !== undefined ? Number(hum).toFixed(1) : '—'}</span>
          <span className="text-xl sm:text-2xl text-slate-400 font-normal">%</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 3. Dedicated Barometric Pressure Card (hPa)
 */
export function PressureCard({ sensor }) {
  const status = sensor?.status || 'missing';
  const press = sensor?.pressure_hpa;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base text-slate-900 font-normal">Pressure</h3>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="bg-slate-50/80 py-8 px-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
        <div className="text-4xl sm:text-5xl text-indigo-600 font-normal tracking-tight flex items-baseline justify-center gap-1.5">
          <span>{press !== null && press !== undefined ? Number(press).toFixed(2) : '—'}</span>
          <span className="text-xl sm:text-2xl text-slate-400 font-normal">hPa</span>
        </div>
      </div>
    </div>
  );
}
