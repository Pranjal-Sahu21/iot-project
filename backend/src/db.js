import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the data directory exists
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'weather.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

// Initialize the schema
db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    received_at TEXT NOT NULL,
    uptime_s INTEGER,
    wifi_rssi INTEGER,
    dht22_status TEXT,
    dht22_temp REAL,
    dht22_hum REAL,
    bmp180_status TEXT,
    bmp180_temp REAL,
    bmp180_press REAL,
    bmp180_alt REAL,
    ldr_status TEXT,
    ldr_raw INTEGER,
    ldr_lux REAL,
    mq2_status TEXT,
    mq2_raw INTEGER,
    mq2_level REAL,
    mq2_gas_detected INTEGER,
    raw_json TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_readings_device_received 
    ON readings (device_id, received_at DESC);

  CREATE INDEX IF NOT EXISTS idx_readings_received 
    ON readings (received_at DESC);
`);

/**
 * Reconstructs the standard API reading format from a database row.
 * Preserves null values faithfully without converting to zero.
 */
export function formatReadingRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    device_id: row.device_id,
    received_at: row.received_at,
    uptime_s: row.uptime_s !== null ? Number(row.uptime_s) : null,
    wifi_rssi: row.wifi_rssi !== null ? Number(row.wifi_rssi) : null,
    dht22: {
      status: row.dht22_status || 'missing',
      temperature_c: row.dht22_temp !== null ? Number(row.dht22_temp) : null,
      humidity_pct: row.dht22_hum !== null ? Number(row.dht22_hum) : null,
    },
    bmp180: {
      status: row.bmp180_status || 'missing',
      pressure_hpa: row.bmp180_press !== null ? Number(row.bmp180_press) : null,
      temperature_c: row.bmp180_temp !== null ? Number(row.bmp180_temp) : null,
    },
  };
}

const insertStmt = db.prepare(`
  INSERT INTO readings (
    device_id, received_at, uptime_s, wifi_rssi,
    dht22_status, dht22_temp, dht22_hum,
    bmp180_status, bmp180_temp, bmp180_press, bmp180_alt,
    ldr_status, ldr_raw, ldr_lux,
    mq2_status, mq2_raw, mq2_level, mq2_gas_detected,
    raw_json
  ) VALUES (
    @device_id, @received_at, @uptime_s, @wifi_rssi,
    @dht22_status, @dht22_temp, @dht22_hum,
    @bmp180_status, @bmp180_temp, @bmp180_press, @bmp180_alt,
    @ldr_status, @ldr_raw, @ldr_lux,
    @mq2_status, @mq2_raw, @mq2_level, @mq2_gas_detected,
    @raw_json
  )
`);

const pruneStmt = db.prepare(`
  DELETE FROM readings
  WHERE device_id = ?
    AND id NOT IN (
      SELECT id FROM readings
      WHERE device_id = ?
      ORDER BY received_at DESC, id DESC
      LIMIT ?
    )
`);

/**
 * Inserts a reading and prunes older entries beyond the keepLimit.
 */
export function insertReading(normalized, receivedAt = new Date().toISOString()) {
  const dht = normalized.dht22 || {};
  const bmp = normalized.bmp180 || {};

  const info = insertStmt.run({
    device_id: normalized.device_id,
    received_at: receivedAt,
    uptime_s: normalized.uptime_s ?? null,
    wifi_rssi: normalized.wifi_rssi ?? null,

    dht22_status: dht.status ?? null,
    dht22_temp: dht.temperature_c ?? null,
    dht22_hum: dht.humidity_pct ?? null,

    bmp180_status: bmp.status ?? null,
    bmp180_temp: bmp.temperature_c ?? null,
    bmp180_press: bmp.pressure_hpa ?? null,
    bmp180_alt: null,

    ldr_status: null,
    ldr_raw: null,
    ldr_lux: null,

    mq2_status: null,
    mq2_raw: null,
    mq2_level: null,
    mq2_gas_detected: null,

    raw_json: JSON.stringify(normalized),
  });

  // Prune older readings for this device, retaining newest 5000 rows
  pruneStmt.run(normalized.device_id, normalized.device_id, 5000);

  return {
    id: Number(info.lastInsertRowid),
    receivedAt,
  };
}

/**
 * Gets the latest reading for a specific device, or latest overall if deviceId not provided.
 */
export function getLatestReading(deviceId) {
  let row;
  if (deviceId) {
    row = db.prepare(`
      SELECT * FROM readings
      WHERE device_id = ?
      ORDER BY received_at DESC, id DESC
      LIMIT 1
    `).get(deviceId);
  } else {
    row = db.prepare(`
      SELECT * FROM readings
      ORDER BY received_at DESC, id DESC
      LIMIT 1
    `).get();
  }

  return formatReadingRow(row);
}

/**
 * Returns readings history ordered oldest to newest, capped at 1000 items.
 */
export function getHistory({ deviceId, limit = 100, from, to }) {
  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 100), 1000);
  const conditions = [];
  const params = [];

  if (deviceId) {
    conditions.push('device_id = ?');
    params.push(deviceId);
  }

  if (from) {
    conditions.push('received_at >= ?');
    params.push(from);
  }

  if (to) {
    conditions.push('received_at <= ?');
    params.push(to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // If "from" is specified, get the first safeLimit rows matching the time range ascending.
  // If "from" is omitted, fetch the newest safeLimit rows and sort them ascending so
  // the client receives the most recent continuous block of history.
  let rows;
  if (from) {
    const query = `
      SELECT * FROM readings
      ${whereClause}
      ORDER BY received_at ASC, id ASC
      LIMIT ?
    `;
    rows = db.prepare(query).all(...params, safeLimit);
  } else {
    const query = `
      SELECT * FROM (
        SELECT * FROM readings
        ${whereClause}
        ORDER BY received_at DESC, id DESC
        LIMIT ?
      ) sub
      ORDER BY received_at ASC, id ASC
    `;
    rows = db.prepare(query).all(...params, safeLimit);
  }

  return rows.map(formatReadingRow);
}

/**
 * Returns the list of known devices with their lastSeen timestamp and online status.
 * Online = lastSeen within 30 seconds.
 */
export function getDevices() {
  const rows = db.prepare(`
    SELECT device_id, MAX(received_at) as last_seen
    FROM readings
    GROUP BY device_id
    ORDER BY last_seen DESC
  `).all();

  const now = Date.now();
  return rows.map((r) => {
    const lastSeenMs = new Date(r.last_seen).getTime();
    const isOnline = now - lastSeenMs <= 30000;
    return {
      device_id: r.device_id,
      lastSeen: r.last_seen,
      online: isOnline,
      isOnline: isOnline,
    };
  });
}

export function closeDb() {
  db.close();
}

export default db;
