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
export interface Position { row: number; col: number; }
export type EffectKind = 'flame' | 'capture' | 'cross' | 'diagonal';
export interface EffectCell { position: Position; kind: EffectKind; distance: number; }
