import React from 'react';
import { Table } from 'lucide-react';

/**
 * Table component showing the 10 most recent readings for DHT22 and BMP180 Barometer.
 * Ensures null values are rendered as '—' instead of 0.
 */
export function ReadingsTable({ history }) {
  const recentTen = React.useMemo(() => {
    if (!history || !history.length) return [];
    return [...history].slice(-10).reverse();
  }, [history]);

  if (!recentTen.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Table className="w-4 h-4 text-slate-500" />
          <h3 className="text-base text-slate-900 font-normal">
            Recent Telemetry Feed (Last 10 Readings)
          </h3>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center text-sm table-fixed min-w-[720px]">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200 font-normal">
            <tr className="divide-x divide-slate-200">
              <th scope="col" className="w-1/5 px-6 py-3.5 text-center font-normal">Time</th>
              <th scope="col" className="w-1/5 px-6 py-3.5 text-center font-normal">Temperature</th>
              <th scope="col" className="w-1/5 px-6 py-3.5 text-center font-normal">Humidity</th>
              <th scope="col" className="w-1/5 px-6 py-3.5 text-center font-normal">Pressure</th>
              <th scope="col" className="w-1/5 px-6 py-3.5 text-center font-normal">Sensors Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentTen.map((row) => {
              const allOk = row.dht22_status === 'ok' && row.bmp180_status === 'ok';

              return (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-100"
                >
                  {/* Timestamp */}
                  <td className="w-1/5 px-6 py-4 whitespace-nowrap text-center text-slate-700">
                    <span className="font-normal text-slate-800 text-sm">{row.timeLabel}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">
                      #{row.id}
                    </span>
                  </td>

                  {/* Temperature */}
                  <td className="w-1/5 px-6 py-4 whitespace-nowrap text-center">
                    {row.dht22_status !== 'ok' && row.dht22_temp === null ? (
                      <span className="text-rose-500 text-xs font-normal">
                        ⚠️ {row.dht22_status}
                      </span>
                    ) : (
                      <span className="text-orange-600 font-normal text-sm">
                        {row.dht22_temp !== null ? `${row.dht22_temp.toFixed(1)} °C` : '—'}
                      </span>
                    )}
                  </td>

                  {/* Humidity */}
                  <td className="w-1/5 px-6 py-4 whitespace-nowrap text-center">
                    {row.dht22_status !== 'ok' && row.dht22_hum === null ? (
                      <span className="text-rose-500 text-xs font-normal">
                        ⚠️ {row.dht22_status}
                      </span>
                    ) : (
                      <span className="text-cyan-600 font-normal text-sm">
                        {row.dht22_hum !== null ? `${row.dht22_hum.toFixed(1)} %` : '—'}
                      </span>
                    )}
                  </td>

                  {/* Pressure */}
                  <td className="w-1/5 px-6 py-4 whitespace-nowrap text-center">
                    {row.bmp180_status !== 'ok' && row.bmp180_press === null ? (
                      <span className="text-rose-500 text-xs font-normal">
                        ⚠️ {row.bmp180_status}
                      </span>
                    ) : (
                      <span className="text-indigo-600 font-normal text-sm">
                        {row.bmp180_press !== null ? `${row.bmp180_press.toFixed(2)} hPa` : '—'}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="w-1/5 px-6 py-4 whitespace-nowrap text-center">
                    {allOk ? (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-normal bg-emerald-50 text-emerald-700 border border-emerald-200">
                        All OK
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-normal bg-rose-50 text-rose-700 border border-rose-200">
                        Degraded
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
