import React from 'react';
import { CloudSun, Radio, RefreshCw } from 'lucide-react';
import { WifiSignal } from './WifiSignal';

/**
 * Top header component displaying the station title, device selector,
 * connection status, online/offline badge, and Wi-Fi RSSI.
 */
export function Header({
  devices,
  selectedDeviceId,
  onSelectDevice,
  isOnline,
  secondsAgo,
  wifiRssi,
  connectionMode,
  onRefresh,
}) {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 gap-3">
          {/* Title & Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <CloudSun className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl tracking-tight text-slate-900 font-normal">
                Weather Station
              </h1>
            </div>
          </div>

          {/* Controls & Device Info */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Device Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="device-select" className="text-xs text-slate-500 sr-only">
                Device
              </label>
              <select
                id="device-select"
                value={selectedDeviceId || ''}
                onChange={(e) => onSelectDevice(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs font-normal"
              >
                {devices.length === 0 ? (
                  <option value="">No devices found</option>
                ) : (
                  devices.map((d) => (
                    <option key={d.device_id} value={d.device_id}>
                      {d.device_id} {d.online ? '🟢' : '⚪'}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Online / Offline Status Badge */}
            <div className="flex items-center">
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal bg-slate-100 text-slate-600 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Offline
                </span>
              )}
            </div>

            {/* Last Updated Counter */}
            <div
              className="text-xs text-slate-500 hidden md:inline-flex items-center gap-1 font-normal"
              title="Time since last reading received"
            >
              <span>Updated:</span>
              <span className="text-slate-800 font-normal">
                {secondsAgo === null
                  ? 'Never'
                  : secondsAgo === 0
                  ? 'Just now'
                  : `${secondsAgo}s ago`}
              </span>
            </div>

            {/* Wi-Fi RSSI Bars */}
            <WifiSignal rssi={wifiRssi} />

            {/* Connection Mode Pill */}
            <div
              className={`hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-normal ${
                connectionMode === 'sse'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
              title={connectionMode === 'sse' ? 'Connected to live SSE stream' : 'Polling /api/readings/latest (fallback)'}
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span>{connectionMode === 'sse' ? 'SSE' : 'POLL'}</span>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={onRefresh}
              title="Manual refresh"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
