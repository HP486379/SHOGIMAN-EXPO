import { BoardGrid, EffectCell, HandPieces, Piece, PieceType, Player, Position } from '../types/shogi';
import { getValidMoves, mustPromote, promotePiece, moveTouchesPromotionZone } from './moveRules';

export interface GameMove {
  from?: Position;
  to: Position;
  dropPiece?: PieceType;
  promote: boolean;
  score?: number;
}

const PROMOTABLE_TYPES: PieceType[] = ['rook', 'bishop', 'silver', 'knight', 'lance', 'pawn'];

export function cloneBoard(board: BoardGrid): BoardGrid {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function cloneHands(hands: HandPieces): HandPieces {
  return { black: [...hands.black], white: [...hands.white] };
}

export function getOpponent(player: Player): Player {
  return player === 'black' ? 'white' : 'black';
}

export function canDropPiece(board: BoardGrid, pieceType: PieceType, player: Player, to: Position): boolean {
  if (board[to.row][to.col]) return false;
  if ((pieceType === 'pawn' || pieceType === 'lance') && (player === 'black' ? to.row === 0 : to.row === 8)) return false;
  if (pieceType === 'knight' && (player === 'black' ? to.row <= 1 : to.row >= 7)) return false;
  if (pieceType === 'pawn') {
    return !board.some((row) => row[to.col]?.player === player && row[to.col]?.type === 'pawn' && !row[to.col]?.promoted);
  }
  return true;
}

export function getDropEffects(board: BoardGrid, pieceType: PieceType, player: Player): EffectCell[] {
  const effects: EffectCell[] = [];
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (canDropPiece(board, pieceType, player, { row, col })) {
        effects.push({ position: { row, col }, kind: 'flame', distance: 1 });
      }
    }
  }
  return effects;
}

export function collectDropMoves(board: BoardGrid, hands: HandPieces, player: Player): GameMove[] {
  const moves: GameMove[] = [];
  for (const dropPiece of Array.from(new Set(hands[player]))) {
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const to = { row, col };
        if (canDropPiece(board, dropPiece, player, to)) moves.push({ to, dropPiece, promote: false });
      }
    }
  }
  return moves;
}

export function applyMoveToBoard(board: BoardGrid, move: GameMove, player: Player): BoardGrid {
  const nextBoard = cloneBoard(board);
  if (move.dropPiece) {
    nextBoard[move.to.row][move.to.col] = { type: move.dropPiece, player };
    return nextBoard;
  }
  if (!move.from) return nextBoard;
  const movingPiece = nextBoard[move.from.row][move.from.col];
  nextBoard[move.to.row][move.to.col] = movingPiece && move.promote ? promotePiece(movingPiece) : movingPiece;
  nextBoard[move.from.row][move.from.col] = null;
  return nextBoard;
}

export function findKing(board: BoardGrid, player: Player): Position | null {
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const piece = board[row][col];
      if (piece?.player === player && piece.type === 'king') return { row, col };
    }
  }
  return null;
}

export function isSquareAttacked(board: BoardGrid, pos: Position, byPlayer: Player): boolean {
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.player !== byPlayer) continue;
      if (getValidMoves(board, { row, col }, piece).some((move) => move.position.row === pos.row && move.position.col === pos.col)) return true;
    }
  }
  return false;
}

export function isKingInCheck(board: BoardGrid, player: Player): boolean {
  const kingPos = findKing(board, player);
  return kingPos ? isSquareAttacked(board, kingPos, getOpponent(player)) : false;
}

function collectPseudoMoves(board: BoardGrid, hands: HandPieces, player: Player): GameMove[] {
  const moves: GameMove[] = [];
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.player !== player) continue;
      const from = { row, col };
      for (const effect of getValidMoves(board, from, piece)) {
        const target = board[effect.position.row][effect.position.col];
        if (target?.type === 'king') continue;
        const touchesZone = moveTouchesPromotionZone(piece, from, effect.position);
        const forced = mustPromote(piece, effect.position);
        const baseMove: GameMove = { from, to: effect.position, promote: forced || touchesZone };
        moves.push(baseMove);
        if (!forced && touchesZone && PROMOTABLE_TYPES.includes(piece.type)) moves.push({ ...baseMove, promote: false });
      }
    }
  }
  return [...moves, ...collectDropMoves(board, hands, player)];
}

export function collectLegalMoves(board: BoardGrid, hands: HandPieces, player: Player): GameMove[] {
  return collectPseudoMoves(board, hands, player).filter((move) => !isKingInCheck(applyMoveToBoard(board, move, player), player));
}

export function getLegalMoveEffects(board: BoardGrid, hands: HandPieces, pos: Position, piece: Piece): EffectCell[] {
  const targets = new Set(
    collectLegalMoves(board, hands, piece.player)
      .filter((move) => move.from?.row === pos.row && move.from?.col === pos.col)
      .map((move) => `${move.to.row}-${move.to.col}`),
  );
  return getValidMoves(board, pos, piece).filter((effect) => targets.has(`${effect.position.row}-${effect.position.col}`));
}

export function isCheckmate(board: BoardGrid, hands: HandPieces, player: Player): boolean {
  return isKingInCheck(board, player) && collectLegalMoves(board, hands, player).length === 0;
}

export function getCheckStatus(board: BoardGrid): Player | null {
  if (isKingInCheck(board, 'black')) return 'black';
  if (isKingInCheck(board, 'white')) return 'white';
  return null;
}

export function getCheckmateWinner(board: BoardGrid, hands: HandPieces): Player | null {
  if (isCheckmate(board, hands, 'black')) return 'white';
  if (isCheckmate(board, hands, 'white')) return 'black';
  return null;
}
