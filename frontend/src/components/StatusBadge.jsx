import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Status badge component.
 * Displays green for "ok", amber for minor warnings, and red with error text for sensor failures.
 */
export function StatusBadge({ status }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-normal">
        missing
      </span>
    );
  }

  const isOk = status.toLowerCase() === 'ok';

  if (isOk) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-normal bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        OK
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-normal bg-rose-50 text-rose-700 border border-rose-200"
      title={`Sensor error: ${status}`}
    >
      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
      <span className="truncate max-w-[140px]">{status}</span>
    </span>
  );
}
