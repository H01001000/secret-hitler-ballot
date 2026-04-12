import { createServer } from "node:http";
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

const voteRoom = new VoteRoom();

const app = next({ dev, hostname: listenHost, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    void handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });
  const stopHeartbeat = startWebSocketHeartbeat(wss);

  server.on("close", () => {
    stopHeartbeat();
  });

  server.on("upgrade", (request, socket, head) => {
    const pathname = parse(request.url ?? "", true).pathname ?? "";
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
  });

  server.listen(port, listenHost, () => {
    console.log(`> Ready on http://${listenHost}:${port}`);
  });
});
