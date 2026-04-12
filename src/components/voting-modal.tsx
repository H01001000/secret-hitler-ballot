"use client";

import { Germania_One } from "next/font/google";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useVoteSocket } from "@/hooks/use-vote-socket";
import type { VoteChoice } from "@/types/vote";

const germania = Germania_One({
  weight: "400",
  subsets: ["latin"],
});

export type VotingModalProps = {
  /** Show restart after results (starts a new election for everyone). */
  showRestartButton?: boolean;
};

export function VotingModal({ showRestartButton = true }: VotingModalProps) {
  const {
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
  } = useVoteSocket();

  const [vote, setVote] = useState<VoteChoice | null>(null);
  const lastElectionId = useRef<string | null>(null);
  const [screen, setScreen] = useState<"vote" | "results">("vote");
  const prevElectionId = useRef<string | null>(null);

  useEffect(() => {
    if (!electionId) return;
    if (
      lastElectionId.current !== null &&
      lastElectionId.current !== electionId
    ) {
      setVote(null);
    }
    lastElectionId.current = electionId;
  }, [electionId]);

  useEffect(() => {
    if (!electionId) return;
    if (
      prevElectionId.current !== null &&
      prevElectionId.current !== electionId
    ) {
      setScreen("vote");
    }
    prevElectionId.current = electionId;
  }, [electionId]);

  useEffect(() => {
    if (yourVote !== null && electionId) {
      setScreen("results");
    }
  }, [yourVote, electionId]);

  const selected = vote ?? yourVote;
  const voteToSend = vote ?? yourVote;
  const isBusy =
    status === "idle" || status === "session" || status === "connecting";

  const onConfirm = () => {
    if (!voteToSend) return;
    sendVote(voteToSend);
    setScreen("results");
  };

  const onRestart = () => {
    startNewVote();
    setScreen("vote");
    setVote(null);
  };

  return (
    <div
      className="w-full max-w-[min(100%,28rem)] rounded-lg bg-[#1a1a1a] px-6 py-7 text-[15px] leading-relaxed text-zinc-100 shadow-xl sm:px-8 sm:py-8"
      role="dialog"
      aria-labelledby="voting-modal-title"
    >
      <h2
        id="voting-modal-title"
        className={`${germania.className} mb-6 text-left text-3xl tracking-wide text-white sm:text-4xl`}
      >
        {screen === "vote" ? "VOTING" : "RESULTS"}
      </h2>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {status === "open" ? "Live" : isBusy ? "Connecting…" : "Offline"}
        </span>
        {voterId ? (
          <span className="truncate font-mono" title={voterId}>
            ID {voterId.slice(0, 8)}…
          </span>
        ) : null}
      </div>

      {screen === "vote" && status === "open" ? (
        <p className="mb-5 text-center text-sm text-zinc-400">
          <span className="font-semibold tabular-nums text-zinc-200">
            {connectedCount}
          </span>{" "}
          {connectedCount === 1 ? "client" : "clients"} connected
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {screen === "vote" ? (
        <>
          <div className="mb-8 flex flex-wrap justify-center gap-4 sm:gap-5">
            <button
              type="button"
              disabled={isBusy || status !== "open"}
              onClick={() => setVote("yes")}
              className={`relative min-w-0 flex-1 basis-[140px] max-w-[220px] overflow-hidden rounded-md border-2 transition-[box-shadow,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 ${
                selected === "yes"
                  ? "ring-2 ring-amber-400/90 ring-offset-2 ring-offset-[#1a1a1a]"
                  : "border-transparent hover:opacity-95 active:scale-[0.99]"
              }`}
              aria-pressed={selected === "yes"}
            >
              <Image
                src="/vote-yes.png"
                alt="Ja (Yes)"
                width={730}
                height={539}
                className="h-auto w-full select-none"
                priority
                draggable={false}
              />
            </button>
            <button
              type="button"
              disabled={isBusy || status !== "open"}
              onClick={() => setVote("no")}
              className={`relative min-w-0 flex-1 basis-[140px] max-w-[220px] overflow-hidden rounded-md border-2 transition-[box-shadow,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 ${
                selected === "no"
                  ? "ring-2 ring-amber-400/90 ring-offset-2 ring-offset-[#1a1a1a]"
                  : "border-transparent hover:opacity-95 active:scale-[0.99]"
              }`}
              aria-pressed={selected === "no"}
            >
              <Image
                src="/vote-no.png"
                alt="Nein (No)"
                width={730}
                height={539}
                className="h-auto w-full select-none"
                draggable={false}
              />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={voteToSend === null || isBusy || status !== "open"}
              onClick={onConfirm}
              className={`${germania.className} rounded-md bg-[#7b6d66] px-14 py-2.5 text-lg tracking-wide text-white transition-colors hover:bg-[#6d605a] disabled:cursor-not-allowed disabled:opacity-50`}
            >
              CONFIRM
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-6 text-center text-sm text-zinc-400">
            {allVotesIn
              ? "Everyone has voted. Full results are below."
              : "Your vote is recorded. Totals stay hidden until everyone has voted."}
          </p>

          <div className="mb-6 flex flex-col items-center gap-4 rounded-md border border-zinc-700/80 bg-zinc-900/50 px-4 py-6">
            <p className="text-center text-sm text-zinc-500">
              Players in room:{" "}
              <span className="font-semibold text-zinc-300">
                {connectedCount}
              </span>
            </p>
            {!allVotesIn ? (
              <p className="text-center text-sm text-zinc-400">
                Votes in:{" "}
                <span className="font-semibold tabular-nums text-zinc-200">
                  {votesReceived}
                </span>{" "}
                /{" "}
                <span className="font-semibold tabular-nums text-zinc-200">
                  {connectedCount}
                </span>
              </p>
            ) : null}
            {allVotesIn ? (
              <div className="flex w-full max-w-xs flex-col gap-3 text-center">
                <p className="text-lg">
                  <span className="font-semibold text-white">Ja</span>{" "}
                  <span className="tabular-nums text-zinc-200">{yes}</span>
                </p>
                <p className="text-lg">
                  <span className="font-semibold text-white">Nein</span>{" "}
                  <span className="tabular-nums text-zinc-200">{no}</span>
                </p>
              </div>
            ) : (
              <p className="text-center text-sm italic text-zinc-500">
                Waiting for remaining votes…
              </p>
            )}
            {electionId ? (
              <p className="font-mono text-xs text-zinc-600">
                Election {electionId.slice(0, 8)}…
              </p>
            ) : null}
          </div>

          {showRestartButton ? (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                disabled={isBusy || status !== "open"}
                onClick={onRestart}
                className={`${germania.className} rounded-md border border-zinc-600 bg-zinc-800 px-10 py-2.5 text-base tracking-wide text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                RESTART
              </button>
              <p className="text-center text-xs text-zinc-500">
                Starts a new election for all connected players.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
