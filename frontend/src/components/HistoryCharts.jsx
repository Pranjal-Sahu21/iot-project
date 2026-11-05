import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Thermometer,
  Droplets,
  Gauge,
  Radio,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Global Chart.js typography
ChartJS.defaults.font.family = "'General Sans', system-ui, sans-serif";
ChartJS.defaults.font.weight = 400;

/**
 * Standardized Chart.js options with smooth sliding animations,
 * preventing canvas resets when new readings arrive.
 */
function createMovingChartOptions({ yUnit = '', yTitle = '' }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 650,
      easing: 'easeOutQuart',
    },
    transitions: {
      active: {
        animation: {
          duration: 300,
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#334155',
          font: { size: 11, family: "'General Sans', sans-serif", weight: 400 },
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        titleColor: '#0f172a',
        bodyColor: '#334155',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { weight: 400 },
        bodyFont: { weight: 400 },
        callbacks: {
          label: function (context) {
            const raw = context.raw;
            const label = context.dataset.label || '';
            const unit = context.dataset.unit || yUnit;
            if (raw === null || raw === undefined || isNaN(raw)) {
              return ` ${label}: — (Sensor Error)`;
            }
            return ` ${label}: ${Number(raw).toFixed(1)} ${unit}`.trim();
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.8)',
        },
      },
      y: {
        title: {
          display: Boolean(yTitle),
          text: yTitle,
          color: '#64748b',
          font: { size: 10, weight: 400 },
        },
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          callback: function (val) {
            return `${val}${yUnit ? ' ' + yUnit : ''}`;
          },
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.8)',
        },
      },
    },
  };
}

/**
 * Creates dynamic point radius function that highlights the leading edge
 * (the newest reading) as a pulsing tracker dot.
 */
function createTrackerPointRadius() {
  return (ctx) => {
    const isLatest = ctx.dataIndex === ctx.dataset.data.length - 1;
    return isLatest ? 5.5 : 1.5;
  };
}

export function HistoryCharts({
  history,
  timeRange,
  onTimeRangeChange,
  isLoading,
}) {
  const ranges = [
    { key: '15m', label: '15 Min' },
    { key: '1h', label: '1 Hour' },
    { key: '6h', label: '6 Hours' },
    { key: '24h', label: '24 Hours' },
  ];

  const activeDataset = useMemo(() => {
    if (!history || !history.length) return [];
    return history;
  }, [history]);

  const hasData = activeDataset && activeDataset.length > 0;
  const labels = useMemo(() => activeDataset.map((pt) => pt.timeLabel), [activeDataset]);

  // 1. Temperature Chart (Single clean Temperature curve - NO DHT/BMP comparison)
  const tempData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Temperature',
        data: activeDataset.map((pt) => pt.dht22_temp),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.08)',
        fill: true,
        tension: 0.4,
        spanGaps: false,
        pointRadius: createTrackerPointRadius(),
        pointHoverRadius: 6,
        borderWidth: 2,
        unit: '°C',
      },
    ],
  }), [labels, activeDataset]);

  // 2. Humidity Chart (Relative Humidity %)
  const humData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Humidity',
        data: activeDataset.map((pt) => pt.dht22_hum),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        fill: true,
        tension: 0.4,
        spanGaps: false,
        pointRadius: createTrackerPointRadius(),
        pointHoverRadius: 6,
        borderWidth: 2,
        unit: '%',
      },
    ],
  }), [labels, activeDataset]);

  // 3. Pressure Chart (Barometric Pressure in hPa)
  const pressData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Pressure',
        data: activeDataset.map((pt) => pt.bmp180_press),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        fill: true,
        tension: 0.4,
        spanGaps: false,
        pointRadius: createTrackerPointRadius(),
        pointHoverRadius: 6,
        borderWidth: 2,
        unit: 'hPa',
      },
    ],
  }), [labels, activeDataset]);

  return (
    <div className="space-y-6">
      {/* Time-Range Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base text-slate-900 font-normal">
              Environmental Telemetry Waves
            </h2>
          </div>
        </div>

        {/* Time Ranges */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {ranges.map((r) => {
            const isActive = timeRange === r.key;
            return (
              <button
                key={r.key}
                onClick={() => onTimeRangeChange(r.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-normal transition-all ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <p className="text-sm text-slate-500">
            {isLoading ? 'Loading historical data...' : 'Waiting for incoming sensor telemetry...'}
          </p>
        </div>
      ) : (
        /* Each chart covers FULL horizontal width */
        <div className="space-y-6">
          {/* Chart 1: Temperature Wave (Full Horizontal Width) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                  <Thermometer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm text-slate-900 font-normal">Temperature (°C)</h3>
                </div>
              </div>
            </div>
            <div className="h-64 sm:h-72 w-full">
              <Line
                data={tempData}
                options={createMovingChartOptions({ yUnit: '°C', yTitle: 'Temperature (°C)' })}
              />
            </div>
          </div>

          {/* Chart 2: Humidity Wave (Full Horizontal Width) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm text-slate-900 font-normal">Humidity (%)</h3>
                </div>
              </div>
            </div>
            <div className="h-64 sm:h-72 w-full">
              <Line
                data={humData}
                options={createMovingChartOptions({ yUnit: '%', yTitle: 'Humidity (%)' })}
              />
            </div>
          </div>

          {/* Chart 3: Pressure Wave (Full Horizontal Width) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm text-slate-900 font-normal">Pressure (hPa)</h3>
                </div>
              </div>
            </div>
            <div className="h-64 sm:h-72 w-full">
              <Line
                data={pressData}
                options={createMovingChartOptions({ yUnit: ' hPa', yTitle: 'Pressure (hPa)' })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
