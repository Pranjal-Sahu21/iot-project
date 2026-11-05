/**
 * Server-Sent Events (SSE) manager.
 * Handles client connections, periodic 15-second heartbeats, and reading broadcasts.
 */

const clients = new Set();
let heartbeatInterval = null;

export function initSSE() {
  if (heartbeatInterval) return;

  // Send heartbeat comment every 15 seconds to keep connections alive
  heartbeatInterval = setInterval(() => {
    for (const client of clients) {
      try {
        client.write(': heartbeat\n\n');
      } catch {
        clients.delete(client);
      }
    }
  }, 15000);
}

export function handleSSEConnection(req, res) {
  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  // Send an immediate comment to complete connection handshake
  res.write(': connected\n\n');

  clients.add(res);

  // Clean up on disconnect
  req.on('close', () => {
    clients.delete(res);
  });
}

/**
 * Pushes a newly saved reading to all active SSE subscribers.
 */
export function broadcastReading(reading) {
  const payload = `data: ${JSON.stringify(reading)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function getClientCount() {
  return clients.size;
}

export function closeSSE() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  for (const client of clients) {
    try {
      client.end();
    } catch {
      // ignore
    }
  }
  clients.clear();
}
