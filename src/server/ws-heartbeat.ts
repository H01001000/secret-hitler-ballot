import { WebSocket as WS } from "ws";
import type { WebSocket, WebSocketServer } from "ws";

/** Per-socket flag used with ping/pong to drop dead connections (zombies). */
export type AliveWebSocket = WebSocket & { isAlive?: boolean };

const PING_INTERVAL_MS = 30_000;

/**
 * Marks the socket alive on pong; call once per connection.
 */
export function attachPongTracker(ws: AliveWebSocket) {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
}

/**
 * Periodically pings all clients and terminates any that did not answer the
 * previous ping with a pong (stale TCP / zombie peers).
 */
export function startWebSocketHeartbeat(wss: WebSocketServer) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const w = ws as AliveWebSocket;
      if (w.readyState !== WS.OPEN) return;
      if (w.isAlive === false) {
        w.terminate();
        return;
      }
      w.isAlive = false;
      w.ping();
    });
  }, PING_INTERVAL_MS);

  return () => clearInterval(interval);
}
