import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';

const TIME_RANGES = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

/**
 * Transforms an API reading object into a standardized chart and table point.
 * Preserves null values faithfully so Recharts does not treat missing data as zero.
 */
export function formatDataPoint(reading) {
  const date = new Date(reading.received_at);
  const timeLabel = isNaN(date.getTime())
    ? '--:--'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    id: reading.id,
    received_at: reading.received_at,
    timestamp: date.getTime(),
    timeLabel,
    fullTime: isNaN(date.getTime()) ? '' : date.toLocaleString(),
    device_id: reading.device_id,

    // Sensor values - STRICT NULL preservation
    dht22_temp: reading.dht22?.temperature_c !== undefined && reading.dht22?.temperature_c !== null
      ? Number(reading.dht22.temperature_c)
      : null,
    dht22_hum: reading.dht22?.humidity_pct !== undefined && reading.dht22?.humidity_pct !== null
      ? Number(reading.dht22.humidity_pct)
      : null,
    dht22_status: reading.dht22?.status || 'missing',

    bmp180_press: reading.bmp180?.pressure_hpa !== undefined && reading.bmp180?.pressure_hpa !== null
      ? Number(reading.bmp180.pressure_hpa)
      : null,
    bmp180_status: reading.bmp180?.status || 'missing',
  };
}

/**
 * Hook to manage history fetching, time-range filtering, and live chart updates.
 */
export function useHistory(deviceId, latestReading) {
  const [timeRange, setTimeRange] = useState('1h');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!deviceId) return;
    setIsLoading(true);
    setError(null);

    const rangeMs = TIME_RANGES[timeRange] || TIME_RANGES['1h'];
    const fromTime = new Date(Date.now() - rangeMs).toISOString();

    try {
      const url = `${API_BASE_URL}/api/readings?device_id=${encodeURIComponent(
        deviceId
      )}&from=${encodeURIComponent(fromTime)}&limit=1000`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const formatted = data.map(formatDataPoint);
      setHistory(formatted);
    } catch (err) {
      console.warn('Failed to fetch history:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, timeRange]);

  // Refetch when deviceId or timeRange changes
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // When a new live reading arrives, integrate it into the history dataset
  useEffect(() => {
    if (!latestReading || latestReading.device_id !== deviceId) return;

    setHistory((prev) => {
      // Check if this point is already included
      if (prev.some((p) => p.id === latestReading.id)) {
        return prev;
      }
      const newPoint = formatDataPoint(latestReading);
      const rangeMs = TIME_RANGES[timeRange] || TIME_RANGES['1h'];
      const cutoff = Date.now() - rangeMs;

      // Filter out points that fell out of the active time window and append the new one
      const updated = [...prev.filter((p) => p.timestamp >= cutoff), newPoint];
      // Keep sorted by timestamp
      return updated.sort((a, b) => a.timestamp - b.timestamp);
    });
  }, [latestReading, deviceId, timeRange]);

  return {
    history,
    timeRange,
    setTimeRange,
    isLoading,
    error,
    refetch: fetchHistory,
  };
}
