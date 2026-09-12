import { BoardGrid, Piece } from '../types/shogi';

function b(type: Piece['type']): Piece { return { type, player: 'black' }; }
function w(type: Piece['type']): Piece { return { type, player: 'white' }; }

export function createInitialBoard(): BoardGrid {
  const _ = null;
  return [
    [w('lance'), w('knight'), w('silver'), w('gold'), w('king'), w('gold'), w('silver'), w('knight'), w('lance')],
    [_, w('rook'), _, _, _, _, _, w('bishop'), _],
    [w('pawn'), w('pawn'), w('pawn'), w('pawn'), w('pawn'), w('pawn'), w('pawn'), w('pawn'), w('pawn')],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
    [b('pawn'), b('pawn'), b('pawn'), b('pawn'), b('pawn'), b('pawn'), b('pawn'), b('pawn'), b('pawn')],
    [_, b('bishop'), _, _, _, _, _, b('rook'), _],
    [b('lance'), b('knight'), b('silver'), b('gold'), b('king'), b('gold'), b('silver'), b('knight'), b('lance')],
  ];
}
