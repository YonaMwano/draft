/**
 * Lightweight 10×10 International Draughts engine for the demo / offline play.
 * Rules: flying kings, majority capture mandatory, men capture backward,
 * promotion deferred until end of capture sequence.
 *
 * Squares: 0–49 (dark squares only), International numbering style.
 * Board mapping: row 0 = White's back rank, row 9 = Black's back rank.
 */

export type Color = 'white' | 'black';

export interface Piece {
  id: string;
  color: Color;
  isKing: boolean;
  square: number; // 0-49
}

export interface Move {
  from: number;
  path: number[];       // intermediate + final squares
  captures: number[];   // squares of captured pieces
  promote: boolean;
}

// ── Board geometry ──────────────────────────────────────────────
// Each of the 50 dark squares has coordinates (x,y) on a 10×10 grid.
// x = file 0–9, y = rank 0–9 (0 = white bottom)

export function sqToXY(sq: number): { x: number; y: number } {
  const row = Math.floor(sq / 5); // 0–9
  const col = sq % 5;
  const y = row;
  const x = row % 2 === 0 ? col * 2 + 1 : col * 2;
  return { x, y };
}

export function xyToSq(x: number, y: number): number | null {
  if (x < 0 || x > 9 || y < 0 || y > 9) return null;
  if ((x + y) % 2 === 0) return null; // light square
  const col = Math.floor(x / 2);
  return y * 5 + col;
}

const DIRS = [
  { dx: 1, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: -1 },
];

function initialPieces(): Piece[] {
  const pieces: Piece[] = [];
  // White on ranks 0–3 (20 pieces)
  for (let sq = 0; sq < 20; sq++) {
    pieces.push({ id: `w${sq}`, color: 'white', isKing: false, square: sq });
  }
  // Black on ranks 6–9 (sq 30–49)
  for (let sq = 30; sq < 50; sq++) {
    pieces.push({ id: `b${sq}`, color: 'black', isKing: false, square: sq });
  }
  return pieces;
}

export class LocalGame {
  pieces: Piece[];
  turn: Color = 'white';
  history: Move[] = [];
  winner: Color | 'draw' | null = null;
  resultReason: string | null = null;

  constructor() {
    this.pieces = initialPieces();
  }

  pieceAt(sq: number): Piece | undefined {
    return this.pieces.find((p) => p.square === sq);
  }

  occupied(): Set<number> {
    return new Set(this.pieces.map((p) => p.square));
  }

  /** All legal moves for the side to move (majority capture enforced). */
  legalMoves(color: Color = this.turn): Move[] {
    const all: Move[] = [];
    for (const p of this.pieces.filter((x) => x.color === color)) {
      all.push(...this.movesFrom(p));
    }
    // Majority capture rule
    const maxCap = Math.max(0, ...all.map((m) => m.captures.length));
    if (maxCap > 0) {
      return all.filter((m) => m.captures.length === maxCap);
    }
    return all.filter((m) => m.captures.length === 0);
  }

  movesFrom(piece: Piece): Move[] {
    const captures = this.captureSequences(piece);
    if (captures.length > 0) return captures;
    return this.quietMoves(piece);
  }

  quietMoves(piece: Piece): Move[] {
    const occ = this.occupied();
    const { x, y } = sqToXY(piece.square);
    const moves: Move[] = [];
    const dirs = piece.isKing
      ? DIRS
      : piece.color === 'white'
      ? [DIRS[0], DIRS[1]] // forward only (increasing y)
      : [DIRS[2], DIRS[3]]; // decreasing y

    for (const { dx, dy } of dirs) {
      if (piece.isKing) {
        // Flying king – any distance
        let cx = x + dx;
        let cy = y + dy;
        while (true) {
          const sq = xyToSq(cx, cy);
          if (sq === null) break;
          if (occ.has(sq)) break;
          moves.push({ from: piece.square, path: [sq], captures: [], promote: false });
          cx += dx;
          cy += dy;
        }
      } else {
        const sq = xyToSq(x + dx, y + dy);
        if (sq !== null && !occ.has(sq)) {
          const promote =
            (piece.color === 'white' && sqToXY(sq).y === 9) ||
            (piece.color === 'black' && sqToXY(sq).y === 0);
          moves.push({ from: piece.square, path: [sq], captures: [], promote });
        }
      }
    }
    return moves;
  }

  captureSequences(piece: Piece): Move[] {
    const results: Move[] = [];
    const occ = this.occupied();
    const enemy = piece.color === 'white' ? 'black' : 'white';

    const search = (
      from: number,
      path: number[],
      captures: number[],
      isKing: boolean,
      visitedCaps: Set<number>
    ) => {
      const { x, y } = sqToXY(from);
      let found = false;

      for (const { dx, dy } of DIRS) {
        if (isKing) {
          // Flying king capture
          let cx = x + dx;
          let cy = y + dy;
          let enemySq: number | null = null;
          while (true) {
            const sq = xyToSq(cx, cy);
            if (sq === null) break;
            const p = this.pieceAt(sq);
            if (p) {
              if (p.color === enemy && !visitedCaps.has(sq)) {
                enemySq = sq;
                // look for landing squares beyond
                let lx = cx + dx;
                let ly = cy + dy;
                while (true) {
                  const land = xyToSq(lx, ly);
                  if (land === null) break;
                  if (occ.has(land) && !visitedCaps.has(land)) break;
                  // can land here
                  const newVisited = new Set(visitedCaps);
                  newVisited.add(enemySq!);
                  const newPath = [...path, land];
                  const newCaps = [...captures, enemySq!];
                  // continue from landing (still king during sequence)
                  search(land, newPath, newCaps, true, newVisited);
                  found = true;
                  // also record this as a complete move option; longer ones will win majority filter
                  results.push({
                    from: piece.square,
                    path: newPath,
                    captures: newCaps,
                    promote: false,
                  });
                  lx += dx;
                  ly += dy;
                }
              }
              break; // blocked by any piece
            }
            cx += dx;
            cy += dy;
          }
        } else {
          // Man capture (one step over)
          const mid = xyToSq(x + dx, y + dy);
          const land = xyToSq(x + 2 * dx, y + 2 * dy);
          if (mid === null || land === null) continue;
          const midPiece = this.pieceAt(mid);
          if (
            midPiece &&
            midPiece.color === enemy &&
            !visitedCaps.has(mid) &&
            !occ.has(land)
          ) {
            const newVisited = new Set(visitedCaps);
            newVisited.add(mid);
            const newPath = [...path, land];
            const newCaps = [...captures, mid];
            // Deferred promotion: stay man during sequence
            search(land, newPath, newCaps, false, newVisited);
            found = true;
            const promote =
              (piece.color === 'white' && sqToXY(land).y === 9) ||
              (piece.color === 'black' && sqToXY(land).y === 0);
            results.push({
              from: piece.square,
              path: newPath,
              captures: newCaps,
              promote,
            });
          }
        }
      }

      // If no further captures found and we have at least one, the current path is already pushed
      void found;
    };

    search(piece.square, [], [], piece.isKing, new Set());

    // Keep only longest sequences from this piece
    if (results.length === 0) return [];
    const max = Math.max(...results.map((m) => m.captures.length));
    return results.filter((m) => m.captures.length === max);
  }

  applyMove(move: Move): void {
    const piece = this.pieceAt(move.from);
    if (!piece) return;

    // Remove captured
    for (const cap of move.captures) {
      this.pieces = this.pieces.filter((p) => p.square !== cap);
    }

    // Move piece
    const finalSq = move.path[move.path.length - 1];
    piece.square = finalSq;

    // Promote
    if (move.promote || piece.isKing === false) {
      const { y } = sqToXY(finalSq);
      if (
        (piece.color === 'white' && y === 9) ||
        (piece.color === 'black' && y === 0)
      ) {
        piece.isKing = true;
      }
    }

    this.history.push(move);
    this.turn = this.turn === 'white' ? 'black' : 'white';

    // Game over?
    const nextMoves = this.legalMoves(this.turn);
    if (nextMoves.length === 0) {
      this.winner = this.turn === 'white' ? 'black' : 'white';
      this.resultReason = 'no_moves';
    }
  }

  /** Clone pieces array for React state */
  getPieces(): Piece[] {
    return this.pieces.map((p) => ({ ...p }));
  }
}
