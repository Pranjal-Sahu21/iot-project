import React from 'react';

/**
 * Wi-Fi signal strength indicator.
 * Displays 4 progressive vertical bars according to the received RSSI (in dBm).
 */
export function WifiSignal({ rssi }) {
  if (rssi === null || rssi === undefined) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <span>— dBm</span>
      </div>
    );
  }

  let activeBars = 0;
  let qualityLabel = 'Weak';
  let barColorClass = 'bg-rose-500';

  if (rssi >= -55) {
    activeBars = 4;
    qualityLabel = 'Excellent';
    barColorClass = 'bg-emerald-500';
  } else if (rssi >= -67) {
    activeBars = 3;
    qualityLabel = 'Good';
    barColorClass = 'bg-emerald-500';
  } else if (rssi >= -78) {
    activeBars = 2;
    qualityLabel = 'Fair';
    barColorClass = 'bg-amber-500';
  } else if (rssi >= -88) {
    activeBars = 1;
    qualityLabel = 'Weak';
    barColorClass = 'bg-rose-500';
  } else {
    activeBars = 0;
    qualityLabel = 'Very Poor';
    barColorClass = 'bg-rose-600';
  }

  const heights = ['h-1.5', 'h-2.5', 'h-3.5', 'h-4.5'];

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 text-xs text-slate-700 font-medium"
      title={`Wi-Fi RSSI: ${rssi} dBm (${qualityLabel})`}
    >
      <div className="flex items-end gap-0.5 h-4.5 w-4" aria-label={`Signal strength ${activeBars} of 4 bars`}>
        {heights.map((h, i) => (
          <span
            key={i}
            className={`w-1 rounded-t-sm transition-all duration-300 ${h} ${
              i < activeBars ? barColorClass : 'bg-slate-300'
            }`}
          />
        ))}
      </div>
      <span>{rssi} dBm</span>
    </div>
  );
}
