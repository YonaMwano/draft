# Online Drafts — 10×10 International

Premium, mobile-first, real-time International Draughts arena.

Built with the hard 5-library budget:

| # | Library | Role |
|---|---------|------|
| 1 | **Next.js 15** (App Router) | SSR, route handlers as game authority, deploy-ready |
| 2 | **dawikk-draughts** | 10×10 International rules, flying kings, majority capture |
| 3 | **pusher-js / pusher** | Real-time moves, presence, clock sync |
| 4 | **@neondatabase/serverless + pg** | Postgres over HTTP + classic Pool |
| 5 | **zustand** | Client game state, optimistic moves, rollback |

All 3D is pure CSS 3D transforms. Auth is hand-rolled (scrypt + HMAC cookies). No Prisma, no UI kit, no Three.js.

---

## Quick Start

### 1. Install

```bash
cd online-drafts
npm install
```

### 2. Database (Neon)

1. Open your Neon project → SQL Editor
2. Paste the entire contents of `schema.sql` and run it
3. Confirm tables appear: `users`, `sessions`, `games`, `moves`, etc.

Set `DATABASE_URL` in Netlify environment variables and in an ignored `.env.local` for local development. No database credentials are stored in source.

### 3. Pusher

Go to [Pusher Dashboard](https://dashboard.pusher.com) and:

1. Create (or open) an app
2. Copy **App ID**, **Key**, **Secret**, **Cluster**
3. Set `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, and `NEXT_PUBLIC_PUSHER_CLUSTER` in Netlify environment variables and your ignored `.env.local`.

Set `SESSION_SECRET` to a strong random value for session signing. Private values must remain server-side. The two `NEXT_PUBLIC_PUSHER_*` settings are intentionally included in browser bundles and are the only keys excluded from Netlify secrets scanning.

Previously committed database and Pusher credentials must be rotated with their providers. Rotate the session secret to invalidate existing sessions. Coordinate any Git history cleanup across repository clones; removing credentials from current files does not remove historical exposure.

Enable **Client Events** if you want emotes from the client; otherwise all events go through the Next.js route handlers (recommended for authority).

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000

---

## Architecture Highlights

### Authority model
- Client sends **intent only**: `{ from, path[], expectedPly }`
- Route handler loads the game row, replays through `dawikk-draughts`, rejects illegal moves, persists, then triggers Pusher
- Zustand applies optimistic UI; `game-state-sync` event confirms or rolls back

### Clocks
- Server stores `last_move_at` + remaining ms
- Every event includes `serverTime`
- Clients compute `offset = serverTime - Date.now()` and tick locally
- Zero ticking traffic

### Disconnect policy
- 15 s grace → “Opponent disconnected…”
- 15–60 s → “Waiting…” + Claim Victory
- 60 s → auto-resign

### Design system
- Classic Walnut (default) / Neon Arena themes
- Camera modes: Immersive 52° · Tilted 34° · Tactical 12° · Top-down 0°
- Board size formula: `min(100vw - 24px, 100dvh - 220px, 640px)`
- Hit-slop on every square; selected pieces scale 1.08

---

## Project Structure

```
src/
  app/
    page.tsx              Landing (floating 3D board + Play Now)
    home/page.tsx         Lobby
    api/
      auth/guest/         Guest session
      auth/me/            Current user
      games/…             (extend with create / join / move)
  components/
    Board3D.tsx           CSS-3D board + pieces (≤ 600 DOM nodes)
  lib/
    db.ts                 Neon serverless + pg Pool
    auth.ts               scrypt + HMAC sessions
    pusher.ts             Shared channels and event types
    pusher-client.ts      Public browser client
    pusher-server.ts      Server-only realtime delivery
    engine.ts             dawikk-draughts wrapper
  store/
    gameStore.ts          Zustand – optimistic moves, clocks, UI
schema.sql                Full Neon schema (paste into dashboard)
```

---

## Next Steps (to complete the full product)

1. **Move route** (`/api/games/[id]/move`) – authority + Pusher emit
2. **Matchmaking** – queue table or Redis, expanding rating window
3. **Game room page** – full HUD, clocks, chat, post-game sheet
4. **Registration / Login** – email + password + OAuth PKCE
5. **Bots** – simple minimax or random legal moves with difficulty tiers
6. **Puzzles / Leaderboard / Friends** – already modeled in schema
7. **Sound** – Web Audio synthesis for captures / low time / promotions
8. **Performance guard** – rAF sampler → auto-downgrade 3D → 2D

---

## SQL Schema

See `schema.sql` (also printed at the end of this message for convenience).

---

## License

MIT – build on it, ship it, enjoy the flying kings.
