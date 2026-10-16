declare module 'dawikk-draughts' {
  interface GameVariant {
    id: string;
    name: string;
    description: string;
    boardSize: number;
    rules: Record<string, unknown>;
  }

  export const GAME_VARIANTS: Record<string, GameVariant>;

  export default class Draughts {
    constructor(options?: { variant?: GameVariant; boardSize?: number });
    load(fen: string): unknown;
    moves(options?: { verbose?: boolean }): unknown[];
    move(move: string): unknown;
    fen(): string;
    ascii(): string;
    game_over(): boolean;
    in_draw(): boolean;
    turn(): string;
  }
}
