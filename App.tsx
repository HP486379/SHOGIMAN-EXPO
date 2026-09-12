import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BoardGrid, CpuLevel, DisplayMode, Piece, PieceType, Position } from './src/types/shogi';
import { createInitialBoard } from './src/utils/initialBoard';
import { getValidMoves } from './src/utils/moveRules';

const MILITARY: Record<PieceType, string> = {
  pawn: 'INF', lance: 'ART', knight: 'DRN', silver: 'SPC', gold: 'GRD', bishop: 'RKT', rook: 'TNK', king: 'HQ',
};
const SHOGI: Record<PieceType, string> = {
  pawn: '歩', lance: '香', knight: '桂', silver: '銀', gold: '金', bishop: '角', rook: '飛', king: '王',
};

const samePos = (a: Position | null, b: Position) => !!a && a.row === b.row && a.col === b.col;
const cloneBoard = (board: BoardGrid): BoardGrid => board.map((row) => row.map((p) => p ? { ...p } : null));

function allCpuMoves(board: BoardGrid) {
  const moves: { from: Position; to: Position }[] = [];
  board.forEach((row, r) => row.forEach((piece, c) => {
    if (piece?.player !== 'white') return;
    getValidMoves(board, { row: r, col: c }, piece).forEach((effect) => moves.push({ from: { row: r, col: c }, to: effect.position }));
  }));
  return moves;
}

function applyMove(board: BoardGrid, from: Position, to: Position): BoardGrid {
  const next = cloneBoard(board);
  next[to.row][to.col] = next[from.row][from.col];
  next[from.row][from.col] = null;
  return next;
}

export default function App() {
  const { width } = useWindowDimensions();
  const boardWidth = Math.min(width - 16, 720);
  const cell = boardWidth / 9;
  const [board, setBoard] = useState<BoardGrid>(() => createInitialBoard());
  const [selected, setSelected] = useState<Position | null>(null);
  const [mode, setMode] = useState<DisplayMode>('military');
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>('normal');
  const [moveCount, setMoveCount] = useState(0);
  const [message, setMessage] = useState('1P READY');

  const effects = useMemo(() => {
    if (!selected) return [];
    const piece = board[selected.row][selected.col];
    return piece ? getValidMoves(board, selected, piece) : [];
  }, [board, selected]);

  const reset = () => {
    setBoard(createInitialBoard());
    setSelected(null);
    setMoveCount(0);
    setMessage('1P READY');
  };

  const cpuTurn = (afterPlayerMove: BoardGrid) => {
    const candidates = allCpuMoves(afterPlayerMove);
    if (!candidates.length) {
      setMessage('CPU NO MOVE');
      return;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setTimeout(() => {
      setBoard(applyMove(afterPlayerMove, pick.from, pick.to));
      setMoveCount((v) => v + 1);
      setMessage('1P READY');
    }, 350);
  };

  const onCell = (row: number, col: number) => {
    const pos = { row, col };
    const piece = board[row][col];
    if (selected) {
      const legal = effects.some((e) => samePos(e.position, pos));
      if (legal) {
        const next = applyMove(board, selected, pos);
        setBoard(next);
        setSelected(null);
        setMoveCount((v) => v + 1);
        setMessage('CPU THINKING');
        cpuTurn(next);
        return;
      }
    }
    if (piece?.player === 'black') {
      setSelected(pos);
      setMessage(`${mode === 'military' ? MILITARY[piece.type] : SHOGI[piece.type]} SELECTED`);
    } else {
      setSelected(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page} bounces={false}>
        <View style={styles.commandRow}>
          <View style={styles.segment}>
            {(['military', 'shogi'] as DisplayMode[]).map((value) => (
              <Pressable key={value} onPress={() => { setMode(value); setSelected(null); }} style={[styles.segmentButton, mode === value && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === value && styles.segmentTextActive]}>{value.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.segment}>
            {(['easy', 'normal', 'hard'] as CpuLevel[]).map((value) => (
              <Pressable key={value} onPress={() => setCpuLevel(value)} style={[styles.levelButton, cpuLevel === value && styles.segmentActive]}>
                <Text style={[styles.levelText, cpuLevel === value && styles.segmentTextActive]}>{value.slice(0, 1).toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.turnPanel}>
          <Text style={styles.turnText}>▼ 1P SENTE · {cpuLevel.toUpperCase()}</Text>
          <Text style={styles.moveText}>MOVES {moveCount}</Text>
        </View>

        <View style={[styles.board, { width: boardWidth, height: boardWidth }]}>
          {board.map((row, r) => row.map((piece, c) => {
            const pos = { row: r, col: c };
            const effect = effects.find((e) => samePos(e.position, pos));
            const isSelected = samePos(selected, pos);
            return (
              <Pressable
                key={`${r}-${c}`}
                onPress={() => onCell(r, c)}
                style={[
                  styles.cell,
                  { width: cell, height: cell },
                  effect?.kind === 'capture' ? styles.captureCell : effect ? styles.moveCell : null,
                  isSelected && styles.selectedCell,
                ]}
              >
                {effect && !piece ? <Text style={styles.moveGlyph}>{effect.kind === 'diagonal' ? '✦' : effect.kind === 'cross' ? '╋' : '◆'}</Text> : null}
                {piece ? <PieceView piece={piece} mode={mode} /> : null}
              </Pressable>
            );
          }))}
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.statusTitle}>TACTIC CHANNEL</Text>
          <Text style={styles.statusText}>{message}</Text>
        </View>

        <View style={styles.bottomBar}>
          <Pressable style={styles.tool}><Text style={styles.toolText}>◆ AI</Text></Pressable>
          <Pressable style={styles.tool}><Text style={styles.toolText}>□ GUIDE</Text></Pressable>
          <Pressable style={styles.tool} onPress={reset}><Text style={styles.toolText}>⚙ SET / RESET</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PieceView({ piece, mode }: { piece: Piece; mode: DisplayMode }) {
  const text = mode === 'military' ? MILITARY[piece.type] : SHOGI[piece.type];
  return (
    <View style={[styles.piece, piece.player === 'white' && styles.cpuPiece]}>
      <Text style={[styles.pieceText, mode === 'shogi' && styles.kanji]}>{text}</Text>
      {piece.promoted ? <Text style={styles.promoted}>UP</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050909' },
  page: { minHeight: '100%', alignItems: 'center', padding: 8, paddingBottom: 24, gap: 10 },
  commandRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: '#23544a', backgroundColor: '#07100f' },
  segmentButton: { paddingVertical: 8, paddingHorizontal: 10 },
  levelButton: { paddingVertical: 8, paddingHorizontal: 9 },
  segmentActive: { backgroundColor: '#14392f', borderColor: '#54e2c1' },
  segmentText: { color: '#7ba398', fontSize: 10, letterSpacing: 1 },
  levelText: { color: '#7ba398', fontSize: 11, fontWeight: '700' },
  segmentTextActive: { color: '#7fffe0' },
  turnPanel: { width: '100%', borderWidth: 1, borderColor: '#a54432', backgroundColor: '#160a08', padding: 10, flexDirection: 'row', justifyContent: 'space-between' },
  turnText: { color: '#ff7960', fontSize: 13, letterSpacing: 1.4, fontWeight: '700' },
  moveText: { color: '#a78780', fontSize: 11 },
  board: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 4, borderColor: '#332f1d', backgroundColor: '#5d5431' },
  cell: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#242113', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6a6139' },
  moveCell: { backgroundColor: '#b27322' },
  captureCell: { backgroundColor: '#7f251e' },
  selectedCell: { borderWidth: 3, borderColor: '#f6ef23' },
  moveGlyph: { color: '#ffd676', fontSize: 18, fontWeight: '900', position: 'absolute' },
  piece: { minWidth: '76%', minHeight: '58%', borderRadius: 6, borderWidth: 1, borderColor: '#d8cb6f', backgroundColor: '#1b2415', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  cpuPiece: { transform: [{ rotate: '180deg' }], borderColor: '#6dbef2', backgroundColor: '#161d25' },
  pieceText: { color: '#f2e88c', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  kanji: { fontSize: 20, letterSpacing: 0 },
  promoted: { position: 'absolute', right: -5, top: -8, color: '#fff', backgroundColor: '#b92f20', fontSize: 7, paddingHorizontal: 2 },
  statusPanel: { width: '100%', minHeight: 72, borderWidth: 1, borderColor: '#88392c', backgroundColor: '#050b0b', padding: 10 },
  statusTitle: { color: '#e86b55', fontSize: 10, letterSpacing: 2 },
  statusText: { color: '#98c9bb', marginTop: 8, fontSize: 12, letterSpacing: 1 },
  bottomBar: { width: '100%', flexDirection: 'row', gap: 8 },
  tool: { flex: 1, minHeight: 58, borderWidth: 1, borderColor: '#315b52', backgroundColor: '#07100f', alignItems: 'center', justifyContent: 'center' },
  toolText: { color: '#79d8c3', fontSize: 11, letterSpacing: 1 },
});
