import { BoardGrid, CpuLevel, HandPieces, PieceType, Player, Position } from '../types/shogi';
import { GameMove, applyMoveToBoard, collectLegalMoves, getCheckmateWinner, getCheckStatus, getOpponent, isKingInCheck } from './shogiEngine';

export interface CpuMove extends GameMove { score: number; }

const PIECE_VALUES: Record<PieceType, number> = {
  king: 10000, rook: 120, bishop: 105, gold: 72, silver: 63, knight: 42, lance: 34, pawn: 10,
};
const CENTRAL_FILES = [3, 4, 5];

function randomItem<T>(items: T[]): T { return items[Math.floor(Math.random() * items.length)]; }
function distance(a: Position, b: Position) { return Math.abs(a.row - b.row) + Math.abs(a.col - b.col); }

function findPiece(board: BoardGrid, player: Player, pieceType: PieceType): Position | null {
  for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) {
    const piece = board[row][col];
    if (piece?.player === player && piece.type === pieceType) return { row, col };
  }
  return null;
}

function materialScore(board: BoardGrid, player: Player): number {
  let score = 0;
  for (const row of board) for (const piece of row) {
    if (!piece) continue;
    const value = PIECE_VALUES[piece.type] + (piece.promoted ? 18 : 0);
    score += piece.player === player ? value : -value;
  }
  return score;
}

function handScore(hands: HandPieces, player: Player): number {
  const opponent = getOpponent(player);
  const own = hands[player].reduce((sum, type) => sum + PIECE_VALUES[type] * 0.75, 0);
  const enemy = hands[opponent].reduce((sum, type) => sum + PIECE_VALUES[type] * 0.75, 0);
  return own - enemy;
}

function positionalScore(board: BoardGrid, move: GameMove, player: Player): number {
  const movingPiece = move.from ? board[move.from.row][move.from.col] : null;
  const pieceType = move.dropPiece ?? movingPiece?.type;
  if (!pieceType) return 0;
  let score = 0;
  const progress = player === 'white' ? move.to.row : 8 - move.to.row;
  const centerDistance = Math.abs(move.to.row - 4) + Math.abs(move.to.col - 4);
  if (CENTRAL_FILES.includes(move.to.col)) score += 4;
  score += Math.max(0, 8 - centerDistance) * 1.3;
  if (['pawn', 'silver', 'knight'].includes(pieceType)) score += progress * 1.8;
  if (pieceType === 'rook' || pieceType === 'bishop') score += Math.max(0, 8 - centerDistance) * 2.2;
  const king = findPiece(board, player, 'king');
  if (king && (pieceType === 'gold' || pieceType === 'silver')) {
    const before = move.from ? distance(move.from, king) : 5;
    score += (before - distance(move.to, king)) * 4;
  }
  if (move.dropPiece) score += pieceType === 'pawn' ? 6 : 10;
  return score;
}

function evaluateBoard(board: BoardGrid, hands: HandPieces, player: Player): number {
  let score = materialScore(board, player) + handScore(hands, player);
  const opponent = getOpponent(player);
  if (isKingInCheck(board, opponent)) score += 85;
  if (isKingInCheck(board, player)) score -= 140;
  const winner = getCheckmateWinner(board, hands);
  if (winner === player) score += 100000;
  if (winner === opponent) score -= 100000;
  return score;
}

function evaluateMove(board: BoardGrid, hands: HandPieces, move: GameMove, player: Player, level: CpuLevel): number {
  const movingPiece = move.from ? board[move.from.row][move.from.col] : null;
  const targetPiece = board[move.to.row][move.to.col];
  const opponent = getOpponent(player);
  let score = Math.random() * (level === 'hard' ? 0.2 : 4);
  if (targetPiece) {
    score += PIECE_VALUES[targetPiece.type] * 14;
    if (movingPiece) score -= PIECE_VALUES[movingPiece.type] * 0.8;
  }
  if (move.promote && movingPiece) score += movingPiece.type === 'rook' || movingPiece.type === 'bishop' ? 95 : 38;
  score += positionalScore(board, move, player);
  const nextBoard = applyMoveToBoard(board, move, player);
  if (getCheckmateWinner(nextBoard, hands) === player) score += 90000;
  if (getCheckStatus(nextBoard) === opponent) score += 220;
  if (movingPiece && isKingInCheck(nextBoard, player)) score -= 99999;
  const replies = collectLegalMoves(nextBoard, hands, opponent);
  const biggestCapture = replies.reduce((max, reply) => {
    const captured = nextBoard[reply.to.row][reply.to.col];
    return captured && captured.player === player ? Math.max(max, PIECE_VALUES[captured.type]) : max;
  }, 0);
  score -= biggestCapture * (level === 'hard' ? 9 : 5);
  score += evaluateBoard(nextBoard, hands, player) * (level === 'hard' ? 0.7 : 0.35);
  if (level === 'hard') {
    const bestReply = replies.map((reply) => evaluateBoard(applyMoveToBoard(nextBoard, reply, opponent), hands, player)).sort((a, b) => a - b)[0] ?? 0;
    score += bestReply * 0.35;
  }
  return score;
}

export function chooseCpuMove(board: BoardGrid, hands: HandPieces, level: CpuLevel): CpuMove | null {
  const moves = collectLegalMoves(board, hands, 'white');
  if (!moves.length) return null;
  const scored = moves
    .map((move) => ({ ...move, score: evaluateMove(board, hands, move, 'white', level) }))
    .sort((a, b) => b.score - a.score);
  if (level === 'easy') return randomItem(scored.slice(0, Math.min(8, scored.length)));
  if (level === 'normal') return randomItem(scored.slice(0, Math.min(3, scored.length)));
  return scored[0];
}
