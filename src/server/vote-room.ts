import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import type { ClientMessage, ServerMessage, VoteChoice } from "../types/vote";

const MIN_EXPECTED_PLAYERS = 2;
const MAX_EXPECTED_PLAYERS = 10;

export class VoteRoom {
  private clients = new Map<WebSocket, string>();
  private electionId = randomUUID();
  private votes = new Map<string, VoteChoice>();
  private expectedPlayers = MIN_EXPECTED_PLAYERS;

  addClient(ws: WebSocket, voterId: string) {
    this.clients.set(ws, voterId);
    this.broadcastState();
  }

  removeClient(ws: WebSocket) {
    this.clients.delete(ws);
    this.broadcastState();
  }

  handleMessage(ws: WebSocket, raw: string) {
    const voterId = this.clients.get(ws);
    if (!voterId) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }

    if (msg.type === "vote") {
      if (msg.vote !== "yes" && msg.vote !== "no") return;
      this.votes.set(voterId, msg.vote);
      this.broadcastState();
      return;
    }

    if (msg.type === "set_expected_players") {
      const n = msg.count;
      if (
        typeof n !== "number" ||
        !Number.isInteger(n) ||
        n < MIN_EXPECTED_PLAYERS ||
        n > MAX_EXPECTED_PLAYERS
      ) {
        return;
      }
      this.expectedPlayers = n;
      this.broadcastState();
      return;
    }

    if (msg.type === "new_vote") {
      this.electionId = randomUUID();
      this.votes.clear();
      this.broadcastNewVote();
      this.broadcastState();
    }
  }

  private buildState(voterId: string): ServerMessage {
    const connectedIds = [...this.clients.values()];
    const connectedCount = connectedIds.length;

    let votesReceived = 0;
    for (const id of connectedIds) {
      if (this.votes.has(id)) votesReceived++;
    }

    const everyoneVoted =
      connectedCount > 0 && votesReceived === connectedCount;
    const expectedMet = connectedCount === this.expectedPlayers;
    /** Full Ja/Nein totals only when table size matches selection and every connected client has voted. */
    const allVotesIn = everyoneVoted && expectedMet;

    let yes = 0;
    let no = 0;
    if (allVotesIn) {
      for (const id of connectedIds) {
        const v = this.votes.get(id);
        if (v === "yes") yes++;
        else if (v === "no") no++;
      }
    }

    return {
      type: "state",
      electionId: this.electionId,
      yes,
      no,
      yourVote: this.votes.get(voterId) ?? null,
      expectedPlayers: this.expectedPlayers,
      connectedCount,
      votesReceived,
      allVotesIn,
    };
  }

  private sendStateTo(ws: WebSocket, voterId: string) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(this.buildState(voterId)));
  }

  private broadcastState() {
    for (const [ws, voterId] of this.clients) {
      this.sendStateTo(ws, voterId);
    }
  }

  private broadcastNewVote() {
    const payload: ServerMessage = {
      type: "new_vote",
      electionId: this.electionId,
    };
    const raw = JSON.stringify(payload);
    for (const [ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(raw);
    }
  }
}
