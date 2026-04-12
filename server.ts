import type { IncomingMessage } from "node:http";
import { createServer } from "node:http";
import type { Duplex } from "node:stream";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { parseCookieHeader } from "./src/lib/parse-cookie";
import { VoteRoom } from "./src/server/vote-room";
import {
  attachPongTracker,
  startWebSocketHeartbeat,
} from "./src/server/ws-heartbeat";

const dev = process.env.NODE_ENV !== "production";
/** Bind address. In production always listen on all interfaces (containers, VPS). */
const listenHost = dev ? (process.env.HOST ?? "localhost") : "0.0.0.0";
const port = Number(process.env.PORT) || 3000;
/**
 * In dev, vote WebSocket binds here so the main port only serves Next (incl. HMR).
 * Override with VOTE_WS_PORT (and NEXT_PUBLIC_VOTE_WS_PORT in next.config).
 */
const voteWsPort = dev ? Number(process.env.VOTE_WS_PORT) || 3001 : null;

const voteRoom = new VoteRoom();

const app = next({ dev, hostname: listenHost, port });

function pathnameFromRequestUrl(url: string | undefined): string {
  try {
    return new URL(url ?? "/", "http://localhost").pathname;
  } catch {
    return "/";
  }
}

app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const handleNextUpgrade = app.getUpgradeHandler();

  const wss = new WebSocketServer({ noServer: true });
  const stopHeartbeat = startWebSocketHeartbeat(wss);

  function handleVoteUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) {
    const pathname = pathnameFromRequestUrl(request.url);
    if (pathname !== "/api/vote/ws") {
      socket.destroy();
      return;
    }

    const voterId = parseCookieHeader(request.headers.cookie).voter_id;
    if (!voterId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      attachPongTracker(ws);
      voteRoom.addClient(ws, voterId);
      ws.on("message", (data) => {
        voteRoom.handleMessage(ws, data.toString());
      });
      ws.on("close", () => {
        voteRoom.removeClient(ws);
      });
    });
  }

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    void handle(req, res, parsedUrl);
  });

  let voteServer: ReturnType<typeof createServer> | null = null;

  if (dev && voteWsPort !== null) {
    voteServer = createServer();
    voteServer.on("upgrade", (request, socket, head) => {
      handleVoteUpgrade(request, socket, head);
    });
    voteServer.listen(voteWsPort, listenHost, () => {
      console.log(
        `> Vote WebSocket: ws://${listenHost}:${voteWsPort}/api/vote/ws`,
      );
    });

    server.on("upgrade", (request, socket, head) => {
      void handleNextUpgrade(request, socket, head);
    });
  } else {
    server.on("upgrade", (request, socket, head) => {
      const pathname = pathnameFromRequestUrl(request.url);
      if (pathname !== "/api/vote/ws") {
        void handleNextUpgrade(request, socket, head);
        return;
      }
      handleVoteUpgrade(request, socket, head);
    });
  }

  server.on("close", () => {
    stopHeartbeat();
    voteServer?.close();
  });

  server.listen(port, listenHost, () => {
    console.log(`> Ready on http://${listenHost}:${port}`);
  });
});
