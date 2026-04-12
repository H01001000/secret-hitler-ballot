export type VoteChoice = "yes" | "no";

export type ClientMessage =
  | { type: "vote"; vote: VoteChoice }
  | { type: "new_vote" };

export type ServerMessage =
  | {
      type: "state";
      electionId: string;
      /** Ja / Nein counts; only nonzero once `allVotesIn` is true (no partial totals). */
      yes: number;
      no: number;
      yourVote: VoteChoice | null;
      connectedCount: number;
      /** How many connected players have submitted a vote this election. */
      votesReceived: number;
      /** True when every connected player has voted; then `yes`/`no` are the full tally. */
      allVotesIn: boolean;
    }
  | { type: "new_vote"; electionId: string };
