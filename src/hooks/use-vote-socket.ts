"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage, VoteChoice } from "@/types/vote";

export type VoteSocketStatus =
  | "idle"
  | "session"
  | "connecting"
  | "open"
  | "error";

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

function isSocketBusy(ws: WebSocket | null): boolean {
  if (!ws) return false;
  const rs = ws.readyState;
  return (
    rs === WebSocket.CONNECTING ||
    rs === WebSocket.OPEN ||
    rs === WebSocket.CLOSING
  );
}

export function useVoteSocket() {
  const [status, setStatus] = useState<VoteSocketStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [electionId, setElectionId] = useState<string | null>(null);
  const [yes, setYes] = useState(0);
  const [no, setNo] = useState(0);
  const [yourVote, setYourVote] = useState<VoteChoice | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [expectedPlayers, setExpectedPlayers] = useState(2);
  const [votesReceived, setVotesReceived] = useState(0);
  const [allVotesIn, setAllVotesIn] = useState(false);
  const [voterId, setVoterId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const cancelledRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const isConnectingRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    function scheduleReconnect() {
      clearReconnectTimer();
      const delay = Math.min(
        INITIAL_BACKOFF_MS * 2 ** attemptRef.current,
        MAX_BACKOFF_MS,
      );
      attemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        void connect();
      }, delay);
    }

    async function connect() {
      if (cancelledRef.current) return;
      if (isConnectingRef.current) return;

      const existing = wsRef.current;
      if (isSocketBusy(existing)) return;
      if (existing?.readyState === WebSocket.CLOSED) {
        wsRef.current = null;
      }

      isConnectingRef.current = true;
      setStatus("session");
      setError(null);

      try {
        const res = await fetch("/api/vote/session", { credentials: "include" });
        if (cancelledRef.current) return;
        if (!res.ok) {
          isConnectingRef.current = false;
          setError("Could not create voter session.");
          setStatus("error");
          scheduleReconnect();
          return;
        }
        const data = (await res.json()) as { voterId: string };
        if (cancelledRef.current) return;
        setVoterId(data.voterId);

        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${proto}//${window.location.host}/api/vote/ws`;
        setStatus("connecting");
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelledRef.current) return;
          isConnectingRef.current = false;
          attemptRef.current = 0;
          clearReconnectTimer();
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
            setExpectedPlayers(msg.expectedPlayers);
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

        // iOS Safari often fires onerror before onclose; avoid sticky error UI here.
        ws.onerror = () => {};

        ws.onclose = () => {
          isConnectingRef.current = false;
          if (wsRef.current === ws) wsRef.current = null;
          if (cancelledRef.current) return;
          if (intentionalCloseRef.current) {
            intentionalCloseRef.current = false;
            return;
          }
          setStatus("connecting");
          setError(null);
          scheduleReconnect();
        };
      } catch {
        isConnectingRef.current = false;
        if (!cancelledRef.current) {
          setError("Connection failed.");
          setStatus("error");
          scheduleReconnect();
        }
      }
    }

    void connect();

    const onOnline = () => {
      if (cancelledRef.current) return;
      attemptRef.current = 0;
      clearReconnectTimer();
      const w = wsRef.current;
      if (!w || w.readyState !== WebSocket.OPEN) void connect();
    };

    const onVisible = () => {
      if (cancelledRef.current || document.visibilityState !== "visible") return;
      attemptRef.current = 0;
      clearReconnectTimer();
      const w = wsRef.current;
      if (!w || w.readyState !== WebSocket.OPEN) void connect();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelledRef.current = true;
      clearReconnectTimer();
      intentionalCloseRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [clearReconnectTimer]);

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

  const setExpectedPlayersCount = useCallback((count: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "set_expected_players", count }));
  }, []);

  return {
    status,
    error,
    voterId,
    electionId,
    yes,
    no,
    yourVote,
    expectedPlayers,
    connectedCount,
    votesReceived,
    allVotesIn,
    sendVote,
    startNewVote,
    setExpectedPlayersCount,
  };
}
