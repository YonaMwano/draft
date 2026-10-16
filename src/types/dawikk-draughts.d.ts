// The package ships JavaScript without TypeScript declarations.
declare module 'dawikk-draughts' {
  export const GAME_VARIANTS: Record<string, { id: string; [key: string]: unknown }>;
  export default class Draughts {
    constructor(options?: Record<string, unknown>);
  }
}
