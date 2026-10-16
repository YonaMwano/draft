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
