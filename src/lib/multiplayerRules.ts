import { LocalGame, type Color, type Piece } from './localEngine';

/** Find a legal transition without trusting a client's turn, clocks or result. */
export function validateTransition(pieces: Piece[], turn: Color, target: unknown): LocalGame | null {
  if (!Array.isArray(target) || target.length > 40 || target.some(p =>
    !p || typeof p.id !== 'string' || !Number.isInteger(p.square) ||
    p.square < 0 || p.square > 49 || !['white', 'black'].includes(p.color) || typeof p.isKing !== 'boolean'
  )) return null;
  const signature = (board: Piece[]) => JSON.stringify([...board].sort((a, b) => a.id.localeCompare(b.id)));
  const engine = new LocalGame();
  engine.pieces = pieces.map(p => ({ ...p }));
  engine.turn = turn;
  for (const move of engine.legalMoves()) {
    const candidate = new LocalGame();
    candidate.pieces = pieces.map(p => ({ ...p }));
    candidate.turn = turn;
    candidate.applyMove(move);
    if (signature(candidate.getPieces()) === signature(target)) return candidate;
  }
  return null;
}
