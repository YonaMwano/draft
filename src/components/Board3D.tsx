'use client';

import { useGameStore, CameraMode } from '@/store/gameStore';
import { useCallback } from 'react';
import { PIECE_COLORS, ACCENT } from '@/lib/theme';

const ROTATE: Record<CameraMode, number> = {
  immersive: 52,
  tilted: 34,
  tactical: 12,
  topdown: 0,
};

export default function Board3D({
  boardSize = 360,
  interactive = true,
  flipPieces = false,
}: {
  boardSize?: number;
  interactive?: boolean;
  flipPieces?: boolean;
}) {
  const {
    pieces,
    selected,
    legalDestinations,
    camera,
    theme,
    turn,
    status,
    selectSquare,
    captureRequired,
  } = useGameStore();

  const rotateX = ROTATE[camera];
  const isNeon = theme === 'neon';

  const lightSq = isNeon ? '#161C24' : '#E9DCC6';
  const darkSq = isNeon ? '#0E1319' : '#3A2A1F';
  const frame = isNeon ? '#0A0E14' : '#5A3E2B';
  const accent = isNeon ? '#00E5FF' : '#D4A24C';

  const pieceMap = new Map(pieces.map((p) => [p.square, p]));

  const handleTap = useCallback(
    (sq: number) => {
      if (!interactive || status !== 'active') return;
      selectSquare(sq);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    },
    [interactive, status, selectSquare]
  );

  const squarePx = boardSize / 10;

  return (
    <div
      className="relative mx-auto select-none"
      style={{ width: boardSize, height: boardSize, perspective: '1400px' }}
    >
      <div
        className="absolute inset-[-14%] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 35%, #00000099 100%)',
        }}
      />

      <div
        className="absolute inset-0 transition-transform duration-320"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotateX}deg)`,
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          className="absolute -inset-[10px] rounded-[20px]"
          style={{
            background: `linear-gradient(180deg, ${frame} 0%, #1a120c 100%)`,
            transform: 'translateZ(-8px)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.55)',
          }}
        />

        <div
          className="absolute -inset-[6px] rounded-[18px]"
          style={{
            background: frame,
            border: `1px solid ${isNeon ? '#00E5FF33' : '#8A6440'}`,
            transform: 'translateZ(0px)',
          }}
        />

        <div
          className="absolute inset-0 grid grid-cols-10 grid-rows-10 rounded-[14px] overflow-hidden"
          style={{ transform: 'translateZ(1px)' }}
        >
          {Array.from({ length: 100 }).map((_, i) => {
            const x = i % 10;
            const y = Math.floor(i / 10);
            const displayY = 9 - y;
            const isDark = (x + displayY) % 2 === 1;

            let playableSq: number | null = null;
            if (isDark) {
              const rowFromBottom = displayY;
              const darkIndexInRow = Math.floor(x / 2);
              playableSq = rowFromBottom * 5 + darkIndexInRow;
            }

            const isSelected = playableSq !== null && selected === playableSq;
            const isLegal = playableSq !== null && legalDestinations.includes(playableSq);
            const piece = playableSq !== null ? pieceMap.get(playableSq) : undefined;

            return (
              <div
                key={i}
                onClick={() => playableSq !== null && handleTap(playableSq)}
                className="relative flex items-center justify-center"
                style={{
                  background: isDark ? darkSq : lightSq,
                  boxShadow: isDark && !isNeon ? 'inset 0 1px 2px rgba(0,0,0,0.3)' : undefined,
                  border: isNeon && isDark ? '1px solid #00E5FF18' : undefined,
                  cursor: playableSq !== null && interactive ? 'pointer' : 'default',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {isLegal && (
                  <div
                    className="absolute rounded-full pointer-events-none z-10"
                    style={{
                      width: piece ? '72%' : '30%',
                      height: piece ? '72%' : '30%',
                      border: `2.5px solid ${accent}`,
                      background: piece ? `${accent}44` : `${accent}33`,
                      boxShadow: `0 0 14px ${accent}aa`,
                    }}
                  />
                )}

                {isSelected && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      boxShadow: `inset 0 0 0 2px ${accent}`,
                      background: `${accent}18`,
                    }}
                  />
                )}

                {piece && (
                  <PieceView
                    piece={piece}
                    size={squarePx * 0.82}
                    selected={isSelected}
                    accent={accent}
                    isNeon={isNeon}
                    dimmed={status === 'active' && piece.color !== turn}
                    flip={flipPieces}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {captureRequired && status === 'active' && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full bg-[#F5A52422] border border-[#F5A52455] text-[#F5A524] text-xs font-medium">
          Capture required
        </div>
      )}
    </div>
  );
}

function PieceView({
  piece,
  size,
  selected,
  accent,
  isNeon,
  dimmed,
  flip,
}: {
  piece: { color: 'white' | 'black'; isKing: boolean };
  size: number;
  selected: boolean;
  accent: string;
  isNeon: boolean;
  dimmed?: boolean;
  flip?: boolean;
}) {
  const isWhite = piece.color === 'white';

  // White = ivory; Black side = pink (high contrast, clear on dark squares)
  const base = isWhite
    ? isNeon
      ? 'linear-gradient(145deg, #f0f7ff 0%, #c8ddf5 45%, #9bb8d9 100%)'
      : 'linear-gradient(145deg, #fffef9 0%, #f0e6d4 40%, #d4c4a0 100%)'
    : isNeon
    ? 'linear-gradient(145deg, #ffb8d9 0%, #ff6eb0 40%, #e91e8c 100%)'
    : 'linear-gradient(145deg, #ffc0d9 0%, #ff7eb3 35%, #e84393 70%, #c2185b 100%)';

  const rim = isWhite
    ? isNeon
      ? '#a8c8ec'
      : '#c4b498'
    : isNeon
    ? '#ff9ec8'
    : '#ff8fbf';

  const shadowTint = isWhite ? 'rgba(0,0,0,0.35)' : 'rgba(180,20,80,0.45)';

  return (
    <div
      className="relative rounded-full transition-transform duration-150"
      style={{
        width: size,
        height: size,
        transform: [
          flip ? 'rotate(180deg)' : '',
          selected ? 'translateZ(14px) scale(1.12)' : 'translateZ(2px)',
        ].filter(Boolean).join(' '),
        opacity: dimmed ? 0.75 : 1,
        transformStyle: 'preserve-3d',
        // Avoid permanent will-change (causes jank on mobile)
        zIndex: selected ? 20 : 5,
        touchAction: 'manipulation',
      }}
    >
      {/* Contact shadow on board */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
        style={{
          width: '90%',
          height: '22%',
          bottom: '-8%',
          background: shadowTint,
          filter: 'blur(4px)',
          transform: 'translateZ(-3px)',
        }}
      />

      {/* Side depth ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: isWhite
            ? 'linear-gradient(180deg, #e8dcc8 0%, #b8a888 100%)'
            : 'linear-gradient(180deg, #f48fb1 0%, #ad1457 100%)',
          transform: 'translateZ(-3px) scale(0.96)',
        }}
      />

      {/* Main body */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: base,
          boxShadow: `
            inset 0 3px 6px rgba(255,255,255,0.45),
            inset 0 -4px 8px rgba(0,0,0,0.25),
            0 2px 6px rgba(0,0,0,0.35)
          `,
          border: `1.5px solid ${rim}`,
        }}
      />

      {/* Specular highlight */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '42%',
          height: '28%',
          top: '12%',
          left: '18%',
          background: isWhite
            ? 'radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, transparent 70%)',
        }}
      />

      {/* King crown ring */}
      {piece.isKing && (
        <div
          className="absolute inset-[14%] rounded-full flex items-center justify-center font-bold"
          style={{
            border: `2.5px solid ${accent}`,
            color: accent,
            background: isWhite ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.2)',
            fontSize: size * 0.3,
            textShadow: `0 0 6px ${accent}`,
            boxShadow: `inset 0 0 8px ${accent}44, 0 0 6px ${accent}33`,
          }}
        >
          ♔
        </div>
      )}

      {/* Subtle identity ring for non-kings (colorblind aid) */}
      {!piece.isKing && !isWhite && (
        <div
          className="absolute inset-[20%] rounded-full pointer-events-none"
          style={{ border: '1.5px solid rgba(255,255,255,0.35)' }}
        />
      )}
    </div>
  );
}
