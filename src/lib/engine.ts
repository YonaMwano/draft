/**
 * Thin wrapper around dawikk-draughts for 10×10 International rules.
 * The route handlers are the single source of truth; clients only send intent.
 */
import Draughts, { GAME_VARIANTS } from 'dawikk-draughts';

export type Square = number; // 0-49 for the 50 dark squares (International notation)

export function createGame(fen?: string) {
  const game = new Draughts({
    variant: GAME_VARIANTS.INTERNATIONAL,
    boardSize: 10,
  });
  if (fen) {
    try {
      game.load(fen);
    } catch {
      // ignore invalid fen, start fresh
    }
  }
  return game;
}

export function getLegalMoves(game: any) {
  return game.moves({ verbose: true }) || [];
}

export function applyMove(game: any, from: number | string, path: (number | string)[]) {
  // path is the full sequence including from; or just the hop squares
  // dawikk-draughts accepts SAN-style or object moves depending on version
  const moveStr = Array.isArray(path) && path.length
    ? [from, ...path].join('-')
    : `${from}-${path}`;
  const result = game.move(moveStr);
  return result;
}

export function getFen(game: any): string {
  return game.fen?.() || game.ascii?.() || '';
}

export function isGameOver(game: any): { over: boolean; result?: string; reason?: string } {
  if (game.game_over?.()) {
    if (game.in_draw?.()) return { over: true, result: '1/2-1/2', reason: 'draw' };
    // turn() is the side that would move next; if no moves, the other side won
    const turn = game.turn?.();
    if (turn === 'w' || turn === 'r') return { over: true, result: '0-1', reason: 'no_moves' };
    return { over: true, result: '1-0', reason: 'no_moves' };
  }
  return { over: false };
}

/** Convert algebraic / number notation helpers if needed */
export function squareToNotation(sq: number): string {
  // International draughts often uses 1-50 numbering for dark squares
  return String(sq + 1);
}
