import type { NextConfig } from "next";

/** Must match server.ts dev vote port (VOTE_WS_PORT) so the client connects to the right origin. */
const voteWsPort = process.env.VOTE_WS_PORT ?? "3001";

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_VOTE_WS_PORT: voteWsPort,
  },
};

export default nextConfig;
