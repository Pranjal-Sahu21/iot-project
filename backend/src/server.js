import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  insertReading,
  getLatestReading,
  getHistory,
  getDevices,
  closeDb,
} from './db.js';
import { validateAndNormalizeReading } from './validator.js';
import {
  initSSE,
  handleSSEConnection,
  broadcastReading,
  closeSSE,
} from './sse.js';
import { initMQTT, closeMQTT } from './mqtt.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || null;

// Initialize SSE heartbeats
initSSE();

// Unified reading processor shared between HTTP POST and MQTT ingestion
export function processIncomingReading(payload, source = 'HTTP') {
  const { valid, error, normalized } = validateAndNormalizeReading(payload);
  if (!valid) {
    return { valid: false, error };
  }

  const receivedAt = new Date().toISOString();
  const { id } = insertReading(normalized, receivedAt);

  console.log(`[${source}] [${receivedAt}] Accepted reading #${id} from ${normalized.device_id} (RSSI: ${normalized.wifi_rssi ?? 'N/A'} dBm)`);

  const fullReading = {
    ...normalized,
    id,
    received_at: receivedAt,
  };
  broadcastReading(fullReading);

  return { valid: true, id, receivedAt };
}

const explicitDeviceStatus = new Map();

// Initialize MQTT broker / subscriber
initMQTT({
  onReading: (payload, topic) => {
    processIncomingReading(payload, `MQTT:${topic}`);
    if (payload && payload.device_id) {
      explicitDeviceStatus.set(payload.device_id, {
        status: 'online',
        updatedAt: Date.now(),
      });
    }
  },
  onStatus: ({ deviceId, status }) => {
    console.log(`[MQTT Status] Device "${deviceId}" state changed to: ${status}`);
    explicitDeviceStatus.set(deviceId, {
      status,
      updatedAt: Date.now(),
    });
  },
});

// Middleware: Enable CORS and limit JSON body size to 100kb
app.use(cors());
app.use(express.json({ limit: '100kb' }));

/**
 * Health check endpoint.
 */
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

/**
 * Server-Sent Events stream endpoint for real-time dashboard updates.
 */
app.get('/api/stream', (req, res) => {
  handleSSEConnection(req, res);
});

/**
 * Known devices list with lastSeen timestamp and online status.
 * Combines SQLite history with real-time MQTT LWT status.
 */
app.get('/api/devices', (req, res) => {
  const devices = getDevices();
  const enhanced = devices.map((d) => {
    const override = explicitDeviceStatus.get(d.device_id);
    if (override && override.status === 'offline') {
      return { ...d, online: false, isOnline: false };
    }
    return d;
  });
  res.json(enhanced);
});

/**
 * Latest reading for a device (or overall if omitted), or 404.
 */
app.get('/api/readings/latest', (req, res) => {
  const { device_id } = req.query;
  const reading = getLatestReading(device_id);

  if (!reading) {
    return res.status(404).json({
      error: device_id
        ? `No readings found for device "${device_id}"`
        : 'No readings found',
    });
  }

  res.json(reading);
});

/**
 * Historical readings, oldest to newest, limit capped at 1000.
 */
app.get('/api/readings', (req, res) => {
  const { device_id, limit, from, to } = req.query;
  const history = getHistory({
    deviceId: device_id,
    limit,
    from,
    to,
  });

  res.json(history);
});

/**
 * Ingest new reading from IoT device or simulator via HTTP POST.
 * Optional API key protection via x-api-key header.
 */
app.post('/api/readings', (req, res) => {
  // Validate optional API key
  if (API_KEY) {
    const incomingKey = req.headers['x-api-key'];
    if (!incomingKey || incomingKey !== API_KEY) {
      return res.status(401).json({
        error: 'Unauthorized: Missing or invalid x-api-key header',
      });
    }
  }

  const result = processIncomingReading(req.body, 'HTTP');
  if (!result.valid) {
    return res.status(400).json({ error: result.error });
  }

  res.status(201).json({
    ok: true,
    id: result.id,
    receivedAt: result.receivedAt,
  });
});

// Central error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`Weather Station Backend running on http://localhost:${PORT}`);
  if (API_KEY) {
    console.log('API key protection enabled for POST /api/readings');
  } else {
    console.log('No API_KEY set; POST /api/readings is open');
  }
});

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  closeMQTT();
  closeSSE();
  server.close(() => {
    try {
      closeDb();
      console.log('Database connection closed.');
    } catch (e) {
      console.error('Error closing database:', e);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default app;
