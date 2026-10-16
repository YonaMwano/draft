// The package ships JavaScript only. Describe the exports used by the wrapper.
declare module 'dawikk-draughts' {
  export interface GameVariant {
    id: string;
    name: string;
    description: string;
    [key: string]: unknown;
  }

  export const GAME_VARIANTS: {
    INTERNATIONAL: GameVariant;
    [key: string]: GameVariant;
  };

  export default class Draughts {
    constructor(config?: { variant?: GameVariant; boardSize?: number });
    load(fen: string): boolean;
  }
}
