import { createServer } from 'node:net';
import { Aedes } from 'aedes';
import mqtt from 'mqtt';

let aedesInstance = null;
let netServer = null;
let clientInstance = null;

/**
 * Initializes MQTT integration for the IoT Weather Station backend.
 *
 * Configured to match the ESP32 firmware sketch:
 *   - Broker: "mqtt://broker.hivemq.com:1883" (or MQTT_BROKER_URL in .env)
 *   - Telemetry topic: "weather/+/readings" (e.g. "weather/esp32-weather-01/readings")
 *   - Status topic: "weather/+/status" ("online" / "offline" LWT)
 *
 * @param {Object} options
 * @param {Function} options.onReading - Callback for sensor readings: (payload, topic) => void
 * @param {Function} [options.onStatus]  - Callback for status updates: ({ deviceId, status }) => void
 */
export async function initMQTT({ onReading, onStatus }) {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
  const mqttPort = parseInt(process.env.MQTT_PORT, 10) || 1883;

  function handleMessage(topic, payloadBuffer) {
    const payloadStr = payloadBuffer.toString('utf8').trim();

    // 1. Device status topic: weather/<device_id>/status
    if (topic.endsWith('/status')) {
      const parts = topic.split('/');
      const deviceId = parts[1] || 'unknown-device';
      if (onStatus) {
        onStatus({ deviceId, status: payloadStr });
      }
      return;
    }

    // 2. Telemetry readings topic: weather/<device_id>/readings or weather/readings
    if (topic.endsWith('/readings') || topic === 'weather/readings') {
      try {
        const data = JSON.parse(payloadStr);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          return; // Ignore scalar or array payloads
        }

        // If device_id wasn't in payload, infer from topic "weather/<device_id>/readings"
        if (!data.device_id && topic.includes('/')) {
          const parts = topic.split('/');
          if (parts[0] === 'weather' && parts[1] && parts[1] !== 'readings') {
            data.device_id = parts[1];
          }
        }

        onReading(data, topic);
      } catch (err) {
        console.warn(`[MQTT] Failed to parse JSON on topic "${topic}":`, err.message);
      }
    }
  }

  if (brokerUrl.toLowerCase() === 'embedded') {
    // Mode 1: Embedded Aedes Broker on local port
    try {
      aedesInstance = await Aedes.createBroker();
      netServer = createServer(aedesInstance.handle);

      aedesInstance.on('client', (client) => {
        console.log(`[MQTT Broker] Client connected: ${client ? client.id : 'unknown'}`);
      });

      aedesInstance.on('clientDisconnect', (client) => {
        console.log(`[MQTT Broker] Client disconnected: ${client ? client.id : 'unknown'}`);
      });

      aedesInstance.on('publish', (packet, client) => {
        if (client && packet && packet.topic) {
          handleMessage(packet.topic, packet.payload);
        }
      });

      netServer.listen(mqttPort, '0.0.0.0', () => {
        console.log(`[MQTT Broker] Embedded MQTT broker running on port ${mqttPort}`);
        console.log(`[MQTT Broker] Subscribed to "weather/+/readings", "weather/+/status"`);
      });

      netServer.on('error', (err) => {
        console.error(`[MQTT Broker] Server error on port ${mqttPort}:`, err.message);
      });
    } catch (err) {
      console.error('[MQTT Broker] Failed to initialize embedded broker:', err);
    }
  } else {
    // Mode 2: Connect to external/cloud MQTT broker (e.g. HiveMQ)
    console.log(`[MQTT] Connecting to broker at ${brokerUrl}...`);
    clientInstance = mqtt.connect(brokerUrl, {
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      clientId: `backend-weather-${Math.random().toString(16).slice(2, 8)}`,
    });

    clientInstance.on('connect', () => {
      console.log(`[MQTT] Connected to broker (${brokerUrl})`);
      const topics = [
        'weather/+/readings',
        'weather/+/status',
        'weather/readings',
      ];
      clientInstance.subscribe(topics, (err) => {
        if (err) {
          console.error('[MQTT] Subscription error:', err);
        } else {
          console.log(`[MQTT] Subscribed to topics: ${topics.join(', ')}`);
        }
      });
    });

    clientInstance.on('message', (topic, message) => {
      handleMessage(topic, message);
    });

    clientInstance.on('error', (err) => {
      console.error('[MQTT] Connection error:', err.message);
    });

    clientInstance.on('reconnect', () => {
      console.log('[MQTT] Reconnecting to broker...');
    });
  }
}

/**
 * Closes the MQTT client or embedded broker gracefully.
 */
export function closeMQTT() {
  if (clientInstance) {
    try {
      clientInstance.end(true);
    } catch {
      // ignore
    }
    clientInstance = null;
  }

  if (aedesInstance) {
    try {
      aedesInstance.close();
    } catch {
      // ignore
    }
    aedesInstance = null;
  }

  if (netServer) {
    try {
      netServer.close();
    } catch {
      // ignore
    }
    netServer = null;
  }
}
