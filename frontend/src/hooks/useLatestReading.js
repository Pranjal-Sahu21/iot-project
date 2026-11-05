import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';

/**
 * Custom hook to manage the latest reading state.
 *
 * Implements:
 * 1. Primary real-time stream using Server-Sent Events (SSE) via /api/stream.
 * 2. Automatic fallback to polling /api/readings/latest every 10s if the SSE stream disconnects.
 * 3. Automatic reconnection and recovery.
 * 4. Second-by-second calculation of "last updated X seconds ago".
 * 5. Device discovery and selection management.
 */
export function useLatestReading() {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [latestReading, setLatestReading] = useState(null);
  const [connectionMode, setConnectionMode] = useState('connecting'); // 'sse', 'polling', 'connecting', 'error'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(null);

  const eventSourceRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const selectedDeviceIdRef = useRef(selectedDeviceId);

  // Keep ref synchronized for event listeners without causing reconnect loops
  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  // Fetch known devices list
  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDevices(data);

      // Auto-select first device if none selected
      if (data.length > 0 && !selectedDeviceIdRef.current) {
        setSelectedDeviceId(data[0].device_id);
      }
    } catch (err) {
      console.warn('Failed to fetch devices:', err.message);
    }
  }, []);

  // Fetch the latest reading via HTTP GET (used for initial load and polling fallback)
  const fetchLatestViaHttp = useCallback(async (devId) => {
    const targetId = devId || selectedDeviceIdRef.current;
    const url = targetId
      ? `${API_BASE_URL}/api/readings/latest?device_id=${encodeURIComponent(targetId)}`
      : `${API_BASE_URL}/api/readings/latest`;

    try {
      const res = await fetch(url);
      if (res.status === 404) {
        // No data yet for this device
        setLatestReading(null);
        setError(null);
        setIsLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setLatestReading(data);
      if (!selectedDeviceIdRef.current && data.device_id) {
        setSelectedDeviceId(data.device_id);
      }
      setError(null);
      setIsLoading(false);
    } catch (err) {
      console.warn('Polling error:', err.message);
      // Only set error if we don't have any data yet
      if (!latestReading) {
        setError(err.message);
      }
      setIsLoading(false);
    }
  }, [latestReading]);

  // Start polling fallback interval
  const startPollingFallback = useCallback(() => {
    if (pollingTimerRef.current) return;
    setConnectionMode('polling');
    console.warn('SSE stream unavailable; switching to polling fallback (10s interval)');

    // Trigger immediate fetch
    fetchLatestViaHttp();

    pollingTimerRef.current = setInterval(() => {
      fetchLatestViaHttp();
      fetchDevices();
    }, 10000);
  }, [fetchLatestViaHttp, fetchDevices]);

  // Stop polling fallback
  const stopPollingFallback = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Connect to SSE stream
  useEffect(() => {
    let isMounted = true;

    // Fetch initial device list and reading
    fetchDevices();
    fetchLatestViaHttp();

    function setupSSE() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `${API_BASE_URL}/api/stream`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMounted) return;
        setConnectionMode('sse');
        stopPollingFallback();
        setError(null);
      };

      es.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const reading = JSON.parse(event.data);
          // If no device is currently selected, select this one
          if (!selectedDeviceIdRef.current) {
            setSelectedDeviceId(reading.device_id);
            setLatestReading(reading);
            setIsLoading(false);
            return;
          }

          // If the reading matches the currently selected device, update state
          if (reading.device_id === selectedDeviceIdRef.current) {
            setLatestReading(reading);
            setIsLoading(false);
            setError(null);
          }

          // Refresh devices list so online status updates
          fetchDevices();
        } catch (e) {
          console.error('Failed to parse SSE payload:', e);
        }
      };

      es.onerror = () => {
        if (!isMounted) return;
        // When SSE connection encounters an error, switch to polling fallback
        startPollingFallback();
      };
    }

    setupSSE();

    // Periodic check for devices list every 15s
    const deviceInterval = setInterval(fetchDevices, 15000);

    return () => {
      isMounted = false;
      clearInterval(deviceInterval);
      stopPollingFallback();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [fetchDevices, fetchLatestViaHttp, startPollingFallback, stopPollingFallback]);

  // When selected device changes, fetch that device's latest reading immediately
  useEffect(() => {
    if (selectedDeviceId) {
      fetchLatestViaHttp(selectedDeviceId);
    }
  }, [selectedDeviceId, fetchLatestViaHttp]);

  // Live timer for "last updated X seconds ago"
  useEffect(() => {
    function updateTimer() {
      if (!latestReading || !latestReading.received_at) {
        setSecondsAgo(null);
        return;
      }
      const receivedMs = new Date(latestReading.received_at).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - receivedMs) / 1000));
      setSecondsAgo(diffSec);
    }

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [latestReading]);

  // Online flag: true if latest reading received within 30 seconds
  const isOnline = secondsAgo !== null && secondsAgo <= 30;

  return {
    latestReading,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    isOnline,
    secondsAgo,
    connectionMode,
    isLoading,
    error,
    refresh: () => fetchLatestViaHttp(selectedDeviceId),
  };
}
