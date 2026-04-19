# Secret Hitler Ballot

Small web app for **live Ja / Nein government votes** around the table. Each player opens the same page on their phone; votes stay private until everyone has voted and the headcount matches the table size you set.

Built with **Next.js** (App Router), a **custom Node server** (`server.ts`) that serves the app and a **`ws`** vote room, **Tailwind CSS**, and **Biome** for lint/format.

> *Secret Hitler* is a trademark of Goat Wolf & Cactus LLC. This project is an unofficial helper and is not affiliated with or endorsed by the publisher.

## Features

- **Ja / Nein** ballot UI with per-device voter identity (`voter_id` httpOnly cookie from `/api/vote/session`).
- **WebSocket** sync (`/api/vote/ws`): connected count, progress, and full tallies only when every connected client has voted **and** `connected ===` “Players in game” (2–10).
- **New election** (Restart) clears votes for everyone on the socket.
- **Dev**: vote WebSocket defaults to port **3001** so port **3000** stays clean for Next HMR; production uses a single HTTP server and upgrade routing.

## Requirements

- Node.js 20+ (recommended)
- [Yarn](https://yarnpkg.com/) 4 (`packageManager` is pinned in `package.json`)

## Setup

```bash
yarn install
```

## Development

```bash
yarn dev
```

- App: [http://localhost:3000](http://localhost:3000) (or `http://$HOST:3000` if you set `HOST`)
- Vote WebSocket (default): `ws://localhost:3001/api/vote/ws`

Override ports with:

| Variable | Purpose |
|----------|---------|
| `HOST` | Bind host in dev (default `localhost`) |
| `PORT` | HTTP port (default `3000`) |
| `VOTE_WS_PORT` | Vote WS port in dev only (default `3001`; must match `next.config.ts` / `NEXT_PUBLIC_VOTE_WS_PORT`) |

## Production

```bash
yarn build
yarn start
```

`yarn start` runs `NODE_ENV=production tsx server.ts`. In production the server listens on **`0.0.0.0`** by default (override with `PORT` as needed for your host/container).

## Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Custom server + Next in development |
| `yarn build` | Next production build |
| `yarn start` | Production server |
| `yarn lint` | `biome check` |
| `yarn format` | `biome format --write` |

## How it works (brief)

1. The client calls **`GET /api/vote/session`** to ensure a `voter_id` cookie exists.
2. The browser opens **`WebSocket`** to `/api/vote/ws`; the server checks the cookie on upgrade and attaches the socket to a shared **`VoteRoom`** (`src/server/vote-room.ts`).
3. JSON messages match **`src/types/vote.ts`** (`vote`, `new_vote`, `set_expected_players` from clients; `state` / `new_vote` from server).
