/**
 * Validates and normalizes an incoming weather station reading payload.
 *
 * Rules:
 * - device_id must be a non-empty string.
 * - Accept both "dht" and "dht22", normalizing to "dht22".
 * - Sensor sections (dht22, bmp180) must be an object if present.
 * - Sensor numeric values can be null (when status != "ok") - never coerce null to 0.
 */
export function validateAndNormalizeReading(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a valid JSON object' };
  }

  const { device_id } = body;
  if (typeof device_id !== 'string' || !device_id.trim()) {
    return { valid: false, error: 'Field "device_id" is required and must be a non-empty string' };
  }

  const normalized = {
    device_id: device_id.trim(),
    uptime_s: body.uptime_s !== undefined && body.uptime_s !== null ? Number(body.uptime_s) : null,
    wifi_rssi: body.wifi_rssi !== undefined && body.wifi_rssi !== null ? Number(body.wifi_rssi) : null,
  };

  // Support both "dht" and "dht22"
  const rawDht = body.dht22 || body.dht;
  if (rawDht !== undefined && rawDht !== null) {
    if (typeof rawDht !== 'object' || Array.isArray(rawDht)) {
      return { valid: false, error: 'Sensor field "dht22" must be an object' };
    }
    normalized.dht22 = {
      status: rawDht.status ?? 'ok',
      temperature_c: rawDht.temperature_c !== undefined && rawDht.temperature_c !== null ? Number(rawDht.temperature_c) : null,
      humidity_pct: rawDht.humidity_pct !== undefined && rawDht.humidity_pct !== null ? Number(rawDht.humidity_pct) : null,
    };
  } else {
    normalized.dht22 = {
      status: 'missing',
      temperature_c: null,
      humidity_pct: null,
    };
  }

  // BMP180 barometric pressure
  const rawBmp = body.bmp180;
  if (rawBmp !== undefined && rawBmp !== null) {
    if (typeof rawBmp !== 'object' || Array.isArray(rawBmp)) {
      return { valid: false, error: 'Sensor field "bmp180" must be an object' };
    }
    normalized.bmp180 = {
      status: rawBmp.status ?? 'ok',
      pressure_hpa: rawBmp.pressure_hpa !== undefined && rawBmp.pressure_hpa !== null ? Number(rawBmp.pressure_hpa) : null,
      temperature_c: rawBmp.temperature_c !== undefined && rawBmp.temperature_c !== null ? Number(rawBmp.temperature_c) : null,
    };
  } else {
    normalized.bmp180 = {
      status: 'missing',
      pressure_hpa: null,
      temperature_c: null,
    };
  }

  return { valid: true, normalized };
}
