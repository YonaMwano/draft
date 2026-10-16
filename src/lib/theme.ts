/** Shared visual tokens — bot and multiplayer use the same look */

export const PIECE_COLORS = {
  white: {
    classic: 'linear-gradient(145deg, #fffef9 0%, #f0e6d4 40%, #d4c4a0 100%)',
    neon: 'linear-gradient(145deg, #f0f7ff 0%, #c8ddf5 45%, #9bb8d9 100%)',
    rimClassic: '#c4b498',
    rimNeon: '#a8c8ec',
    sideClassic: 'linear-gradient(180deg, #e8dcc8 0%, #b8a888 100%)',
  },
  // Black side rendered as pink for clarity
  black: {
    classic: 'linear-gradient(145deg, #ffc0d9 0%, #ff7eb3 35%, #e84393 70%, #c2185b 100%)',
    neon: 'linear-gradient(145deg, #ffb8d9 0%, #ff6eb0 40%, #e91e8c 100%)',
    rimClassic: '#ff8fbf',
    rimNeon: '#ff9ec8',
    sideClassic: 'linear-gradient(180deg, #f48fb1 0%, #ad1457 100%)',
  },
} as const;

export const ACCENT = {
  classic: '#D4A24C',
  neon: '#00E5FF',
} as const;
