declare module 'dawikk-draughts' {
  export const GAME_VARIANTS: { INTERNATIONAL: string };
  const Draughts: new (options: { variant: string; boardSize: number }) => unknown;
  export default Draughts;
}
