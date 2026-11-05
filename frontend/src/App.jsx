import React from 'react';
import { useLatestReading } from './hooks/useLatestReading';
import { useHistory } from './hooks/useHistory';
import { Header } from './components/Header';
import { TemperatureCard, HumidityCard, PressureCard } from './components/SensorCard';
import { HistoryCharts } from './components/HistoryCharts';
import { ReadingsTable } from './components/ReadingsTable';
import { Radio, AlertCircle, RefreshCw, Cpu, Activity } from 'lucide-react';

export default function App() {
  const {
    latestReading,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    isOnline,
    secondsAgo,
    connectionMode,
    isLoading: isLoadingLatest,
    error: latestError,
    refresh: refreshLatest,
  } = useLatestReading();

  const {
    history,
    timeRange,
    setTimeRange,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useHistory(selectedDeviceId, latestReading);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* 1. Main Header */}
      <Header
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={setSelectedDeviceId}
        isOnline={isOnline}
        secondsAgo={secondsAgo}
        wifiRssi={latestReading?.wifi_rssi ?? null}
        connectionMode={connectionMode}
        onRefresh={() => {
          refreshLatest();
          refetchHistory();
        }}
      />

      {/* 2. Main Dashboard Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-10 space-y-6">
        {/* Error State */}
        {latestError && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between text-rose-800">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="text-sm font-normal">Failed to connect to weather backend</p>
                <p className="text-xs text-rose-600">{latestError}</p>
              </div>
            </div>
            <button
              onClick={refreshLatest}
              className="px-3 py-1.5 rounded-lg text-xs font-normal bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoadingLatest && !latestReading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-base text-slate-800 font-normal">
              Connecting to Weather Station...
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Establishing stream connection and fetching active device telemetry.
            </p>
          </div>
        )}

        {/* Empty State: No data yet - waiting for device */}
        {!isLoadingLatest && !latestReading && !latestError && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-xl mx-auto my-12">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Radio className="w-7 h-7 animate-pulse" />
            </div>
            <h3 className="text-lg text-slate-900 font-normal">
              No data yet - waiting for the device
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Waiting for incoming HTTP POST readings from the ESP32 weather station or simulator.
              Ensure the backend is running and the device is transmitting to{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 text-xs font-mono">
                /api/readings
              </code>.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={refreshLatest}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-normal hover:bg-blue-700 transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Check Again
              </button>
            </div>
          </div>
        )}

        {/* Active Telemetry Display */}
        {latestReading && (
          <>
            {/* System Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs text-xs">
              <div className="flex items-center gap-4 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-slate-500">Device:</span>
                  <span className="text-slate-900 font-normal">{latestReading.device_id}</span>
                </span>

                <span className="hidden sm:inline-flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-500">Uptime:</span>
                  <span className="text-slate-900 font-normal">
                    {latestReading.uptime_s !== null ? `${latestReading.uptime_s}s` : '—'}
                  </span>
                </span>
              </div>

              <div className="text-slate-400 text-[11px]">
                Reading ID: #{latestReading.id} &bull; Received:{' '}
                {new Date(latestReading.received_at).toLocaleTimeString()}
              </div>
            </div>

            {/* 3 Dedicated Metric Cards: Temperature, Humidity, and Pressure */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <TemperatureCard sensor={latestReading.dht22} />
              <HumidityCard sensor={latestReading.dht22} />
              <PressureCard sensor={latestReading.bmp180} />
            </div>

            {/* Full-Horizontal Width Telemetry Wave Charts */}
            <HistoryCharts
              history={history}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              isLoading={isLoadingHistory}
            />

            {/* Recent Telemetry Table */}
            <ReadingsTable history={history} />
          </>
        )}
      </main>
    </div>
  );
}
