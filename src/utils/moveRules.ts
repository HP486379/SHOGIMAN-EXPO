import { BoardGrid, Piece, PieceType, Player, Position, EffectCell, EffectKind } from '../types/shogi';

type Direction = [number, number];
const inBounds = (row: number, col: number) => row >= 0 && row < 9 && col >= 0 && col < 9;
const forward = (player: Player) => player === 'black' ? -1 : 1;

function stepDirs(type: PieceType, player: Player, promoted?: boolean): Direction[] {
  const f = forward(player);
  if (promoted && ['silver', 'knight', 'lance', 'pawn'].includes(type)) return [[f,-1],[f,0],[f,1],[0,-1],[0,1],[-f,0]];
  switch (type) {
    case 'king': return [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    case 'gold': return [[f,-1],[f,0],[f,1],[0,-1],[0,1],[-f,0]];
    case 'silver': return [[f,-1],[f,0],[f,1],[-f,-1],[-f,1]];
    case 'pawn': return [[f,0]];
    case 'knight': return [[f*2,-1],[f*2,1]];
    default: return [];
  }
}

function slidingDirs(type: PieceType, player: Player, promoted?: boolean): Direction[] {
  const f = forward(player);
  switch (type) {
    case 'rook': return [[-1,0],[1,0],[0,-1],[0,1]];
    case 'bishop': return [[-1,-1],[-1,1],[1,-1],[1,1]];
    case 'lance': return promoted ? [] : [[f,0]];
    default: return [];
  }
}

function promotedExtras(type: PieceType): Direction[] {
  if (type === 'rook') return [[-1,-1],[-1,1],[1,-1],[1,1]];
  if (type === 'bishop') return [[-1,0],[1,0],[0,-1],[0,1]];
  return [];
}

function effectKind(type: PieceType): EffectKind {
  if (type === 'rook') return 'cross';
  if (type === 'bishop') return 'diagonal';
  return 'flame';
}

function addStep(board: BoardGrid, effects: EffectCell[], row: number, col: number, piece: Piece, kind: EffectKind, distance: number) {
  if (!inBounds(row, col)) return;
  const target = board[row][col];
  if (!target) effects.push({ position: { row, col }, kind, distance });
  else if (target.player !== piece.player) effects.push({ position: { row, col }, kind: 'capture', distance });
}

export function getValidMoves(board: BoardGrid, pos: Position, piece: Piece): EffectCell[] {
  const effects: EffectCell[] = [];
  const { row, col } = pos;
  const { type, player, promoted } = piece;

  if (['rook', 'bishop', 'lance'].includes(type) && !(promoted && type === 'lance')) {
    for (const [dr, dc] of slidingDirs(type, player, promoted)) {
      let dist = 1;
      let r = row + dr;
      let c = col + dc;
      while (inBounds(r, c)) {
        const target = board[r][c];
        if (!target) {
          effects.push({ position: { row: r, col: c }, kind: effectKind(type), distance: dist });
          r += dr; c += dc; dist++;
        } else {
          if (target.player !== player) effects.push({ position: { row: r, col: c }, kind: 'capture', distance: dist });
          break;
        }
      }
    }
  }

  for (const [dr, dc] of stepDirs(type, player, promoted)) {
    addStep(board, effects, row + dr, col + dc, piece, 'flame', type === 'knight' && !promoted ? 2 : 1);
  }
  if (promoted) for (const [dr, dc] of promotedExtras(type)) addStep(board, effects, row + dr, col + dc, piece, 'flame', 1);
  return effects;
}
