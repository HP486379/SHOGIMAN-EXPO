export type Player = 'black' | 'white';
export type CpuLevel = 'easy' | 'normal' | 'hard';
export type DisplayMode = 'military' | 'shogi';
export type PieceType = 'king' | 'rook' | 'bishop' | 'gold' | 'silver' | 'knight' | 'lance' | 'pawn';

export interface Piece {
  type: PieceType;
  player: Player;
  promoted?: boolean;
}

export type BoardGrid = (Piece | null)[][];
export type HandPieces = Record<Player, PieceType[]>;

export interface Position { row: number; col: number; }
export interface LastMove { from: Position | null; to: Position; player: Player; }
export type EffectKind = 'flame' | 'capture' | 'cross' | 'diagonal';
export interface EffectCell { position: Position; kind: EffectKind; distance: number; }
export interface PendingPromotion { from: Position; to: Position; }

export interface GameState {
  board: BoardGrid;
  hands: HandPieces;
  selectedPos: Position | null;
  selectedHandPiece: PieceType | null;
  effects: EffectCell[];
  captureEffect: Position | null;
  checkPlayer: Player | null;
  currentPlayer: Player;
  firstPlayer: Player;
  lastMove: LastMove | null;
  gameOverWinner: Player | null;
  moveCount: number;
  seEnabled: boolean;
  cpuLevel: CpuLevel;
  pendingPromotion: PendingPromotion | null;
}
