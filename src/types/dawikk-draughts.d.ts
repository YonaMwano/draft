declare module 'dawikk-draughts' {
  export interface GameVariant {
    id: string;
    name: string;
    description: string;
    boardSize: number;
    rules: Record<string, boolean | string>;
  }

  export const GAME_VARIANTS: Record<string, GameVariant> & {
    INTERNATIONAL: GameVariant;
  };

  export default class Draughts {
    constructor(config?: { boardSize?: number; variant?: GameVariant });
  }
}
