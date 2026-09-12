import { Piece, PieceType } from '../types/shogi';

type UnitKind = PieceType | 'promotedPawn' | 'promotedLance' | 'promotedKnight' | 'promotedSilver' | 'promotedBishop' | 'promotedRook';

const BASE = '#26351a';
const DARK = '#10170b';
const MID = '#516629';
const LIGHT = '#c7b56c';
const FIRE = '#ff6a1a';
const RED = '#b73522';
const BLUE = '#5582a5';

function svgToDataUri(svg: string): string { return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`; }
function shell(inner: string, accent = MID): string {
  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="3" dy="4" stdDeviation="2" flood-color="#000" flood-opacity=".65"/></filter></defs><rect width="128" height="128" fill="none"/><g filter="url(#s)"><path d="M17 104 C20 79 28 65 42 57 C52 51 77 51 87 57 C101 65 108 79 112 104 Z" fill="${accent}" opacity=".18"/>${inner}</g></svg>`);
}

const pawn = shell(`<circle cx="64" cy="32" r="13" fill="${DARK}"/><path d="M44 53 h40 l8 47 h-56 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><path d="M38 68 l-20 22" stroke="${LIGHT}" stroke-width="7"/><path d="M90 68 l20 22" stroke="${LIGHT}" stroke-width="7"/><path d="M57 72 l-23 24" stroke="${DARK}" stroke-width="8"/><path d="M71 72 l23 24" stroke="${DARK}" stroke-width="8"/><rect x="36" y="78" width="56" height="10" rx="3" fill="${MID}"/>`, '#4f7f2d');
const lance = shell(`<path d="M25 79 h64 l18 18 h-87 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><circle cx="45" cy="98" r="8" fill="${DARK}"/><circle cx="82" cy="98" r="8" fill="${DARK}"/><rect x="42" y="49" width="58" height="19" rx="5" fill="${MID}" stroke="${LIGHT}" stroke-width="3"/><path d="M96 56 l24 -10" stroke="${DARK}" stroke-width="11" stroke-linecap="round"/><path d="M99 54 l22 -9" stroke="${LIGHT}" stroke-width="4" stroke-linecap="round"/>`, '#704222');
const knight = shell(`<ellipse cx="64" cy="69" rx="34" ry="20" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><circle cx="37" cy="44" r="15" fill="none" stroke="${DARK}" stroke-width="8"/><circle cx="91" cy="44" r="15" fill="none" stroke="${DARK}" stroke-width="8"/><circle cx="37" cy="44" r="7" fill="${LIGHT}"/><circle cx="91" cy="44" r="7" fill="${LIGHT}"/><rect x="54" y="80" width="8" height="22" fill="${DARK}"/><rect x="68" y="80" width="8" height="22" fill="${DARK}"/><path d="M48 65 h32" stroke="${BLUE}" stroke-width="5"/>`, '#335d6d');
const silver = shell(`<circle cx="64" cy="29" r="15" fill="${DARK}"/><path d="M39 50 h50 l-5 55 h-40 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><path d="M33 72 l-17 20" stroke="${DARK}" stroke-width="7"/><path d="M84 65 l28 29" stroke="${DARK}" stroke-width="7"/><path d="M51 58 l33 29" stroke="${LIGHT}" stroke-width="5"/><rect x="49" y="34" width="30" height="8" fill="${BLUE}"/>`, '#6b6f6f');
const gold = shell(`<circle cx="58" cy="30" r="13" fill="${DARK}"/><path d="M38 48 h39 l10 57 h-55 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><rect x="72" y="54" width="30" height="43" rx="5" fill="${DARK}" stroke="${LIGHT}" stroke-width="3"/><path d="M83 62 v28" stroke="${MID}" stroke-width="5"/><path d="M46 67 l-24 24" stroke="${DARK}" stroke-width="8"/>`, '#8a7528');
const bishop = shell(`<path d="M25 81 h73 l15 16 h-92 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><circle cx="45" cy="98" r="7" fill="${DARK}"/><circle cx="82" cy="98" r="7" fill="${DARK}"/><rect x="41" y="55" width="50" height="18" rx="4" fill="${MID}"/><path d="M51 55 l43 -28" stroke="${DARK}" stroke-width="12" stroke-linecap="round"/><path d="M53 54 l43 -28" stroke="${LIGHT}" stroke-width="4"/><circle cx="84" cy="37" r="17" fill="none" stroke="${RED}" stroke-width="4"/><path d="M84 20 v34 M67 37 h34" stroke="${RED}" stroke-width="3"/>`, '#7a4b24');
const rook = shell(`<path d="M18 76 h81 l18 20 h-106 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><circle cx="38" cy="98" r="8" fill="${DARK}"/><circle cx="75" cy="98" r="8" fill="${DARK}"/><circle cx="100" cy="98" r="8" fill="${DARK}"/><rect x="45" y="49" width="58" height="20" rx="5" fill="${MID}" stroke="${LIGHT}" stroke-width="3"/><path d="M97 53 l28 -5" stroke="${DARK}" stroke-width="10" stroke-linecap="round"/><path d="M99 52 l25 -4" stroke="${LIGHT}" stroke-width="4"/>`, '#2f5e77');
const king = shell(`<path d="M23 100 h82 v-39 l-13 -12 v-23 h-16 v13 h-24 v-13 h-16 v23 l-13 12 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><path d="M34 100 v-26 h18 v26 M76 100 v-26 h18 v26" fill="${DARK}"/><path d="M64 42 v-23 M51 28 h26" stroke="${LIGHT}" stroke-width="5"/><circle cx="104" cy="36" r="10" fill="none" stroke="${BLUE}" stroke-width="4"/><path d="M103 49 q-21 9 -35 22" stroke="${BLUE}" stroke-width="4" fill="none"/>`, '#5f3f86');
const promotedPawn = shell(`<circle cx="54" cy="30" r="13" fill="${DARK}"/><path d="M34 49 h43 l10 54 h-61 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><rect x="67" y="55" width="38" height="15" fill="${DARK}"/><path d="M95 58 l22 -7" stroke="${FIRE}" stroke-width="8"/><path d="M48 71 l-28 21" stroke="${DARK}" stroke-width="8"/><path d="M35 104 h60" stroke="${RED}" stroke-width="7"/>`, '#894025');
const promotedLance = shell(`<path d="M20 80 h78 l16 17 h-101 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><circle cx="37" cy="98" r="8" fill="${DARK}"/><circle cx="67" cy="98" r="8" fill="${DARK}"/><circle cx="94" cy="98" r="8" fill="${DARK}"/><rect x="36" y="47" width="62" height="21" rx="5" fill="${MID}" stroke="${LIGHT}" stroke-width="3"/><path d="M91 53 l31 -12" stroke="${DARK}" stroke-width="13"/><path d="M101 48 l21 -8" stroke="${FIRE}" stroke-width="7"/>`, '#8a4a1f');
const promotedKnight = shell(`<ellipse cx="64" cy="68" rx="38" ry="22" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><circle cx="34" cy="42" r="16" fill="none" stroke="${DARK}" stroke-width="8"/><circle cx="94" cy="42" r="16" fill="none" stroke="${DARK}" stroke-width="8"/><rect x="46" y="76" width="36" height="11" fill="${DARK}"/><path d="M84 74 l31 9" stroke="${FIRE}" stroke-width="8"/><path d="M45 60 h38" stroke="${RED}" stroke-width="5"/>`, '#566e2a');
const promotedSilver = shell(`<circle cx="65" cy="27" r="15" fill="${DARK}"/><path d="M36 49 h55 l-5 55 h-44 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><path d="M36 68 l-24 23" stroke="${DARK}" stroke-width="8"/><path d="M87 66 l28 25" stroke="${DARK}" stroke-width="8"/><path d="M47 58 l39 34" stroke="${RED}" stroke-width="5"/><path d="M48 103 h38" stroke="${RED}" stroke-width="7"/>`, '#8a3f2a');
const promotedBishop = shell(`<path d="M22 81 h78 l16 17 h-99 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><circle cx="43" cy="99" r="7" fill="${DARK}"/><circle cx="82" cy="99" r="7" fill="${DARK}"/><rect x="38" y="55" width="57" height="19" rx="4" fill="${MID}"/><path d="M47 55 l51 -31" stroke="${DARK}" stroke-width="13"/><path d="M92 27 l25 -7" stroke="${FIRE}" stroke-width="7"/><circle cx="82" cy="38" r="18" fill="none" stroke="${RED}" stroke-width="4"/>`, '#843f24');
const promotedRook = shell(`<path d="M13 77 h88 l20 20 h-115 z" fill="${BASE}" stroke="${LIGHT}" stroke-width="3"/><circle cx="35" cy="99" r="8" fill="${DARK}"/><circle cx="68" cy="99" r="8" fill="${DARK}"/><circle cx="101" cy="99" r="8" fill="${DARK}"/><rect x="40" y="47" width="64" height="22" rx="5" fill="${MID}" stroke="${LIGHT}" stroke-width="3"/><path d="M98 52 l29 -6" stroke="${DARK}" stroke-width="13"/><path d="M109 49 l19 -4" stroke="${FIRE}" stroke-width="7"/><path d="M72 35 v-20 M62 24 h20" stroke="${LIGHT}" stroke-width="4"/>`, '#455d28');

export const UNIT_ICONS: Record<UnitKind, string> = { pawn, lance, knight, silver, gold, bishop, rook, king, promotedPawn, promotedLance, promotedKnight, promotedSilver, promotedBishop, promotedRook };

export function getUnitIcon(piece: Piece): string {
  if (piece.promoted) {
    switch (piece.type) {
      case 'pawn': return UNIT_ICONS.promotedPawn;
      case 'lance': return UNIT_ICONS.promotedLance;
      case 'knight': return UNIT_ICONS.promotedKnight;
      case 'silver': return UNIT_ICONS.promotedSilver;
      case 'bishop': return UNIT_ICONS.promotedBishop;
      case 'rook': return UNIT_ICONS.promotedRook;
      default: return UNIT_ICONS[piece.type];
    }
  }
  return UNIT_ICONS[piece.type];
}

export function getPieceTypeIcon(pieceType: PieceType): string { return UNIT_ICONS[pieceType]; }
