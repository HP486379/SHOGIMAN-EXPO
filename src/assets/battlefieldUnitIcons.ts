import { Piece, PieceType } from '../types/shogi';
import { getPieceTypeIcon, getUnitIcon } from './unitIcons';

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function soldierIcon(promoted = false): string {
  const jacket = promoted ? '#536b22' : '#394d1f';
  const jacket2 = promoted ? '#789336' : '#607a2e';
  const trim = promoted ? '#ffcc44' : '#d6c071';
  const fire = promoted ? '#ff6a1a' : '#1b2412';

  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="3" dy="4" stdDeviation="2" flood-color="#000" flood-opacity=".72"/>
        </filter>
        <linearGradient id="vest" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${jacket2}"/>
          <stop offset="1" stop-color="${jacket}"/>
        </linearGradient>
      </defs>
      <rect width="128" height="128" fill="none"/>
      <g filter="url(#shadow)">
        <ellipse cx="64" cy="109" rx="43" ry="10" fill="#080908" opacity=".62"/>
        <path d="M42 38 C44 20 84 20 87 38 L82 45 H47 Z" fill="#19210f" stroke="${trim}" stroke-width="3"/>
        <path d="M40 36 H89 L84 47 H45 Z" fill="#61752b" stroke="#0b1007" stroke-width="3"/>
        <circle cx="64" cy="51" r="15" fill="#171910" stroke="${trim}" stroke-width="3"/>
        <rect x="51" y="45" width="28" height="8" rx="3" fill="#050805" opacity=".9"/>
        <path d="M40 68 C44 57 84 57 89 68 L96 105 H32 Z" fill="url(#vest)" stroke="#0b1007" stroke-width="4"/>
        <path d="M51 69 L45 103 M77 69 L84 103" stroke="#1a220f" stroke-width="6" opacity=".9"/>
        <path d="M33 73 L17 91" stroke="#18200f" stroke-width="10" stroke-linecap="round"/>
        <path d="M92 70 L116 86" stroke="#18200f" stroke-width="10" stroke-linecap="round"/>
        <path d="M35 79 L105 63" stroke="#0b0d08" stroke-width="10" stroke-linecap="round"/>
        <path d="M67 71 L112 61" stroke="${trim}" stroke-width="4" stroke-linecap="round"/>
        <path d="M101 63 L122 58" stroke="#0b0d08" stroke-width="8" stroke-linecap="round"/>
        <path d="M121 57 L126 55" stroke="${fire}" stroke-width="6" stroke-linecap="round"/>
        <rect x="46" y="74" width="36" height="12" rx="3" fill="#10170b" stroke="${trim}" stroke-width="2"/>
        <circle cx="55" cy="80" r="2" fill="${trim}"/><circle cx="64" cy="80" r="2" fill="${trim}"/><circle cx="73" cy="80" r="2" fill="${trim}"/>
        <path d="M48 102 L39 116 H56 L62 104 Z" fill="#1a220f"/>
        <path d="M80 102 L88 116 H72 L66 104 Z" fill="#1a220f"/>
        ${promoted ? '<path d="M31 108 H97" stroke="#b73522" stroke-width="7"/><path d="M92 25 L102 17 L112 25" fill="none" stroke="#ffcc44" stroke-width="5" stroke-linecap="round"/>' : ''}
      </g>
    </svg>
  `);
}

const HUMAN_INFANTRY = soldierIcon(false);
const VETERAN_INFANTRY = soldierIcon(true);

export function getBattlefieldUnitIcon(piece: Piece): string {
  if (piece.type === 'pawn') return piece.promoted ? VETERAN_INFANTRY : HUMAN_INFANTRY;
  return getUnitIcon(piece);
}

export function getBattlefieldPieceTypeIcon(pieceType: PieceType): string {
  if (pieceType === 'pawn') return HUMAN_INFANTRY;
  return getPieceTypeIcon(pieceType);
}
