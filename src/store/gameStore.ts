import { create } from 'zustand';
import { LocalGame, type Piece, type Move, type Color } from '@/lib/localEngine';
import { playMoveSound, playCaptureSound, playPromoteSound } from '@/lib/sound';

export type CameraMode = 'immersive' | 'tilted' | 'tactical' | 'topdown';
export type Theme = 'classic' | 'neon';

interface GameState {
  engine: LocalGame | null;
  pieces: Piece[];
  turn: Color;
  selected: number | null;
  legalMoves: Move[];
  legalDestinations: number[];
  hopPath: number[];
  status: 'idle' | 'active' | 'finished';
  winner: Color | 'draw' | null;
  resultReason: string | null;

  whiteMs: number;
  blackMs: number;
  lastTick: number | null;
  incrementMs: number;

  camera: CameraMode;
  theme: Theme;
  myColor: Color;
  captureRequired: boolean;
  maxCaptures: number;
  soundEnabled: boolean;

  newGame: () => void;
  selectSquare: (sq: number) => void;
  setCamera: (m: CameraMode) => void;
  setTheme: (t: Theme) => void;
  tick: () => void;
  resign: () => void;
  setSoundEnabled: (v: boolean) => void;
}

function destsFromMoves(moves: Move[]): number[] {
  return [...new Set(moves.map((m) => m.path[m.path.length - 1]))];
}

function playForMove(move: Move, soundEnabled: boolean) {
  if (!soundEnabled || typeof window === 'undefined') return;
  if (move.promote) {
    playPromoteSound();
  } else if (move.captures.length > 0) {
    playCaptureSound();
  } else {
    playMoveSound();
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  engine: null,
  pieces: [],
  turn: 'white',
  selected: null,
  legalMoves: [],
  legalDestinations: [],
  hopPath: [],
  status: 'idle',
  winner: null,
  resultReason: null,

  whiteMs: 180_000,
  blackMs: 180_000,
  lastTick: null,
  incrementMs: 2000,

  camera: 'tilted',
  theme: 'classic',
  myColor: 'white',
  captureRequired: false,
  maxCaptures: 0,
  soundEnabled: true,

  newGame: () => {
    const engine = new LocalGame();
    const moves = engine.legalMoves();
    const maxCap = Math.max(0, ...moves.map((m) => m.captures.length));
    set({
      engine,
      pieces: engine.getPieces(),
      turn: 'white',
      selected: null,
      legalMoves: moves,
      legalDestinations: [],
      hopPath: [],
      status: 'active',
      winner: null,
      resultReason: null,
      whiteMs: 180_000,
      blackMs: 180_000,
      lastTick: Date.now(),
      captureRequired: maxCap > 0,
      maxCaptures: maxCap,
    });
  },

  selectSquare: (sq: number) => {
    const s = get();
    if (s.status !== 'active' || !s.engine) return;

    // Destination → execute move
    if (s.selected !== null && s.legalDestinations.includes(sq)) {
      const candidates = s.legalMoves.filter(
        (m) => m.from === s.selected && m.path[m.path.length - 1] === sq
      );
      let move = candidates[0];
      if (s.hopPath.length > 0) {
        const cont = candidates.find((m) =>
          m.path.slice(0, s.hopPath.length).every((p, i) => p === s.hopPath[i])
        );
        if (cont) move = cont;
      }
      if (!move) return;

      playForMove(move, s.soundEnabled);

      s.engine.applyMove(move);

      const nextMoves = s.engine.legalMoves();
      const maxCap = Math.max(0, ...nextMoves.map((m) => m.captures.length));

      const justMoved = s.turn;
      let whiteMs = s.whiteMs;
      let blackMs = s.blackMs;
      if (justMoved === 'white') whiteMs += s.incrementMs;
      else blackMs += s.incrementMs;

      set({
        pieces: s.engine.getPieces(),
        turn: s.engine.turn,
        selected: null,
        legalMoves: nextMoves,
        legalDestinations: [],
        hopPath: [],
        status: s.engine.winner ? 'finished' : 'active',
        winner: s.engine.winner,
        resultReason: s.engine.resultReason,
        whiteMs,
        blackMs,
        lastTick: Date.now(),
        captureRequired: maxCap > 0,
        maxCaptures: maxCap,
      });
      return;
    }

    // Select own piece
    const piece = s.pieces.find((p) => p.square === sq);
    if (!piece || piece.color !== s.turn) {
      set({ selected: null, legalDestinations: [], hopPath: [] });
      return;
    }

    const pieceMoves = s.legalMoves.filter((m) => m.from === sq);
    set({
      selected: sq,
      legalDestinations: destsFromMoves(pieceMoves),
      hopPath: [],
    });
  },

  setCamera: (m) => set({ camera: m }),
  setTheme: (t) => set({ theme: t }),
  setSoundEnabled: (v) => set({ soundEnabled: v }),

  tick: () => {
    const s = get();
    if (s.status !== 'active' || !s.lastTick) return;
    const now = Date.now();
    const elapsed = now - s.lastTick;
    if (elapsed < 100) return;

    if (s.turn === 'white') {
      const ms = Math.max(0, s.whiteMs - elapsed);
      set({ whiteMs: ms, lastTick: now });
      if (ms === 0) {
        set({ status: 'finished', winner: 'black', resultReason: 'timeout' });
      }
    } else {
      const ms = Math.max(0, s.blackMs - elapsed);
      set({ blackMs: ms, lastTick: now });
      if (ms === 0) {
        set({ status: 'finished', winner: 'white', resultReason: 'timeout' });
      }
    }
  },

  resign: () => {
    const s = get();
    if (s.status !== 'active') return;
    set({
      status: 'finished',
      winner: s.turn === 'white' ? 'black' : 'white',
      resultReason: 'resignation',
    });
  },
}));
