import Pusher from 'pusher';
import PusherClient from 'pusher-js';

/*
  Pusher credentials.
  The string you provided looks like key + secret concatenated.
  Split it for the server SDK.  Adjust if your dashboard shows different values.
*/
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY || 'de2ZYOo4oykhBT6Qj26kaQ';
const PUSHER_SECRET = process.env.PUSHER_SECRET || 'lG8pvOxbqirCxz8EZ4GM';
const PUSHER_APP_ID = process.env.PUSHER_APP_ID || 'your-app-id';
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

// Server-side (route handlers)
export const pusherServer = new Pusher({
  appId: PUSHER_APP_ID,
  key: PUSHER_KEY,
  secret: PUSHER_SECRET,
  cluster: PUSHER_CLUSTER,
  useTLS: true,
});

// Client-side factory
export function createPusherClient() {
  return new PusherClient(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER,
    forceTLS: true,
  });
}

// Channel helpers
export const channels = {
  lobby: 'presence-lobby',
  game: (id: string) => `private-game-${id}`,
  spectate: (id: string) => `presence-spectate-${id}`,
  user: (id: string) => `private-user-${id}`,
};

export type GameEvent =
  | { type: 'move-made'; ply: number; from: number; path: number[]; captures: number[]; fen: string; whiteMs: number; blackMs: number; serverTime: number }
  | { type: 'game-state-sync'; fen: string; ply: number; moves: any[]; whiteMs: number; blackMs: number; status: string; result?: string; serverTime: number }
  | { type: 'clock-state'; whiteMs: number; blackMs: number; serverTime: number }
  | { type: 'draw-offered'; by: string }
  | { type: 'draw-accepted' }
  | { type: 'draw-declined' }
  | { type: 'game-over'; result: string; reason: string }
  | { type: 'chat-message'; userId: string; username: string; body: string; at: string }
  | { type: 'emote'; userId: string; emote: string }
  | { type: 'player-disconnected'; color: 'white' | 'black' }
  | { type: 'player-reconnected'; color: 'white' | 'black' }
  | { type: 'takeback-requested'; by: string };
