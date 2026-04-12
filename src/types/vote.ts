export type VoteChoice = "yes" | "no";

export type ClientMessage =
  | { type: "vote"; vote: VoteChoice }
  | { type: "new_vote" }
  | { type: "set_expected_players"; count: number };

export type ServerMessage =
  | {
      type: "state";
      electionId: string;
      /** Ja / Nein counts; only nonzero when `allVotesIn` (everyone voted + connected matches expected). */
      yes: number;
      no: number;
      yourVote: VoteChoice | null;
      /** Table size (informational); votes are allowed regardless of match to connected count. */
      expectedPlayers: number;
      connectedCount: number;
      /** How many connected players have submitted a vote this election. */
      votesReceived: number;
      /** True when tallies are revealed: every connected player voted and `connectedCount === expectedPlayers`. */
      allVotesIn: boolean;
    }
  | { type: "new_vote"; electionId: string };
