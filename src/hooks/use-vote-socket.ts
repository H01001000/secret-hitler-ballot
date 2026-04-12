"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage, VoteChoice } from "@/types/vote";

export type VoteSocketStatus =
  | "idle"
  | "session"
  | "connecting"
  | "open"
  | "error";

export function useVoteSocket() {
  const [status, setStatus] = useState<VoteSocketStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [electionId, setElectionId] = useState<string | null>(null);
  const [yes, setYes] = useState(0);
  const [no, setNo] = useState(0);
  const [yourVote, setYourVote] = useState<VoteChoice | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [votesReceived, setVotesReceived] = useState(0);
  const [allVotesIn, setAllVotesIn] = useState(false);
  const [voterId, setVoterId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus("session");
      setError(null);
      const res = await fetch("/api/vote/session", { credentials: "include" });
      if (!res.ok) {
        setError("Could not create voter session.");
        setStatus("error");
        return;
      }
      const data = (await res.json()) as { voterId: string };
      if (cancelled) return;
      setVoterId(data.voterId);

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${window.location.host}/api/vote/ws`;
      setStatus("connecting");
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setStatus("open");
        setError(null);
      };

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage;
        } catch {
          return;
        }
        if (msg.type === "state") {
          setElectionId(msg.electionId);
          setYes(msg.yes);
          setNo(msg.no);
          setYourVote(msg.yourVote);
          setConnectedCount(msg.connectedCount);
          setVotesReceived(msg.votesReceived);
          setAllVotesIn(msg.allVotesIn);
        } else if (msg.type === "new_vote") {
          setElectionId(msg.electionId);
          setYes(0);
          setNo(0);
          setYourVote(null);
          setVotesReceived(0);
          setAllVotesIn(false);
        }
      };

      ws.onerror = () => {
        if (cancelled) return;
        setError("WebSocket error.");
        setStatus("error");
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus("error");
        setError((prev) => prev ?? "Disconnected.");
      };
    }

    void run();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const sendVote = useCallback((vote: VoteChoice) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "vote", vote }));
  }, []);

  const startNewVote = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "new_vote" }));
  }, []);

  return {
    status,
    error,
    voterId,
    electionId,
    yes,
    no,
    yourVote,
    connectedCount,
    votesReceived,
    allVotesIn,
    sendVote,
    startNewVote,
  };
}
