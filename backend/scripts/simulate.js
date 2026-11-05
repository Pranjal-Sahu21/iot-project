/**
 * IoT Weather Station Sensor Simulator
 *
 * Periodically generates realistic sensor readings for DHT22 & BMP180
 * and publishes them via MQTT matching the ESP32 firmware topic structure.
 *
 * Topics:
 *   - "weather/<device_id>/readings"
 *   - "weather/<device_id>/status"
 */

import dotenv from 'dotenv';
import mqtt from 'mqtt';

dotenv.config();

const PORT = process.env.PORT || 3000;
const MQTT_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
const HTTP_URL = process.env.BACKEND_URL || `http://localhost:${PORT}/api/readings`;
const API_KEY = process.env.API_KEY || '';
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS, 10) || 5000;

const DEVICE_IDS = ['esp32-weather-01', 'esp32-weather-02'];
let tickCount = 0;
const startTimes = {
  'esp32-weather-01': Math.floor(Date.now() / 1000) - 3600,
  'esp32-weather-02': Math.floor(Date.now() / 1000) - 1800,
};

let mqttConnected = false;
const clientId = `simulator-${Math.random().toString(16).slice(2, 8)}`;

const mqttClient = mqtt.connect(MQTT_URL, {
  clientId,
  reconnectPeriod: 3000,
  will: {
    topic: 'weather/esp32-weather-01/status',
    payload: Buffer.from('offline'),
    qos: 1,
    retain: true,
  },
});

mqttClient.on('connect', () => {
  mqttConnected = true;
  console.log(`[SIMULATOR] Connected to MQTT broker at ${MQTT_URL}`);
  // Publish online status
  DEVICE_IDS.forEach((id) => {
    mqttClient.publish(`weather/${id}/status`, 'online', { retain: true, qos: 1 });
  });
  console.log(`[SIMULATOR] Published "online" status for: ${DEVICE_IDS.join(', ')}`);
});

mqttClient.on('error', (err) => {
  mqttConnected = false;
  console.warn(`[SIMULATOR] MQTT connection notice: ${err.message}. (HTTP fallback ready)`);
});

mqttClient.on('offline', () => {
  mqttConnected = false;
});

function randomInRange(min, max, decimals = 1) {
  const val = min + Math.random() * (max - min);
  return Number(val.toFixed(decimals));
}

function generateReading(deviceId) {
  tickCount += 1;
  const nowSec = Math.floor(Date.now() / 1000);
  const uptime_s = nowSec - startTimes[deviceId];

  // Randomize Wi-Fi RSSI between -40 dBm (strong) and -82 dBm (weak)
  const wifi_rssi = Math.floor(randomInRange(-82, -40, 0));

  // ~8% chance of DHT22 sensor failure
  const dhtError = Math.random() < 0.08;
  const dhtData = dhtError
    ? {
        status: Math.random() < 0.5 ? 'sensor not found' : 'checksum error',
        temperature_c: null,
        humidity_pct: null,
      }
    : {
        status: 'ok',
        temperature_c: randomInRange(21.5, 29.5, 1),
        humidity_pct: randomInRange(38.0, 72.0, 1),
      };

  // ~6% chance of BMP180 sensor failure
  const bmpError = Math.random() < 0.06;
  const bmpData = bmpError
    ? {
        status: 'sensor not found',
        pressure_hpa: null,
      }
    : {
        status: 'ok',
        pressure_hpa: randomInRange(1008.0, 1018.5, 2),
      };

  return {
    device_id: deviceId,
    uptime_s,
    wifi_rssi,
    dht22: dhtData,
    bmp180: bmpData,
  };
}

async function sendReading() {
  const deviceId = Math.random() < 0.8 ? DEVICE_IDS[0] : DEVICE_IDS[1];
  const payload = generateReading(deviceId);
  const tempStr = payload.dht22?.temperature_c ?? 'ERR';
  const pressStr = payload.bmp180?.pressure_hpa ?? 'ERR';
  const topic = `weather/${deviceId}/readings`;

  if (mqttConnected) {
    const jsonStr = JSON.stringify(payload);
    mqttClient.publish(topic, jsonStr, { qos: 0 }, (err) => {
      if (err) {
        console.error(`[SIMULATOR] MQTT publish error:`, err.message);
      } else {
        console.log(
          `[SIMULATOR] [MQTT -> ${topic}] ${deviceId} | Temp: ${tempStr}°C | Press: ${pressStr} hPa`
        );
      }
    });
  } else {
    // HTTP fallback
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) {
      headers['x-api-key'] = API_KEY;
    }

    try {
      const res = await fetch(HTTP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        console.log(
          `[SIMULATOR] [HTTP Fallback] Sent ${deviceId} -> ID: ${data.id} | Temp: ${tempStr}°C | Press: ${pressStr} hPa`
        );
      } else {
        console.error(`[SIMULATOR] HTTP Error (${res.status}):`, data);
      }
    } catch (err) {
      console.error(`[SIMULATOR] Failed HTTP POST to ${HTTP_URL}:`, err.message);
    }
  }
}

console.log(`Starting IoT Weather Station Simulator...`);
console.log(`MQTT Target: ${MQTT_URL}`);
console.log(`HTTP Fallback: ${HTTP_URL}`);
console.log(`Interval: ${INTERVAL_MS}ms`);

// Initial reading after short delay
setTimeout(sendReading, 500);
setInterval(sendReading, INTERVAL_MS);
