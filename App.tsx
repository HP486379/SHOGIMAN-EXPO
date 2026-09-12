import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  BoardGrid,
  CpuLevel,
  DisplayMode,
  EffectCell,
  HandPieces,
  Piece,
  PieceType,
  Position,
} from './src/types/shogi';
import { createInitialBoard } from './src/utils/initialBoard';
import { mustPromote, moveTouchesPromotionZone } from './src/utils/moveRules';
import {
  GameMove,
  applyMoveToBoard,
  cloneHands,
  getCheckStatus,
  getCheckmateWinner,
  getDropEffects,
  getLegalMoveEffects,
} from './src/utils/shogiEngine';
import { chooseCpuMove } from './src/utils/cpuPlayer';

const MILITARY: Record<PieceType, string> = {
  pawn: 'INF', lance: 'ART', knight: 'DRN', silver: 'SPC', gold: 'GRD', bishop: 'RKT', rook: 'TNK', king: 'HQ',
};
const SHOGI: Record<PieceType, string> = {
  pawn: '歩', lance: '香', knight: '桂', silver: '銀', gold: '金', bishop: '角', rook: '飛', king: '王',
};
const PROMOTED_SHOGI: Partial<Record<PieceType, string>> = {
  pawn: 'と', lance: '杏', knight: '圭', silver: '全', bishop: '馬', rook: '龍',
};

const EMPTY_HANDS: HandPieces = { black: [], white: [] };
const samePos = (a: Position | null, b: Position) => !!a && a.row === b.row && a.col === b.col;

function removeOne(items: PieceType[], target: PieceType): PieceType[] {
  const index = items.indexOf(target);
  if (index < 0) return items;
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

function nextHandsAfterMove(board: BoardGrid, hands: HandPieces, move: GameMove, player: 'black' | 'white'): HandPieces {
  const next = cloneHands(hands);
  if (move.dropPiece) {
    next[player] = removeOne(next[player], move.dropPiece);
    return next;
  }
  const captured = board[move.to.row][move.to.col];
  if (captured && captured.type !== 'king') next[player].push(captured.type);
  return next;
}

function handCounts(items: PieceType[]) {
  return items.reduce<Partial<Record<PieceType, number>>>((acc, type) => {
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});
}

export default function App() {
  const { width } = useWindowDimensions();
  const boardWidth = Math.min(width - 16, 720);
  const cell = boardWidth / 9;
  const [board, setBoard] = useState<BoardGrid>(() => createInitialBoard());
  const [hands, setHands] = useState<HandPieces>(() => cloneHands(EMPTY_HANDS));
  const [selected, setSelected] = useState<Position | null>(null);
  const [selectedHandPiece, setSelectedHandPiece] = useState<PieceType | null>(null);
  const [mode, setMode] = useState<DisplayMode>('military');
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>('normal');
  const [moveCount, setMoveCount] = useState(0);
  const [message, setMessage] = useState('1P READY');
  const [cpuThinking, setCpuThinking] = useState(false);
  const [winner, setWinner] = useState<'black' | 'white' | null>(null);

  const effects = useMemo<EffectCell[]>(() => {
    if (selectedHandPiece) return getDropEffects(board, selectedHandPiece, 'black');
    if (!selected) return [];
    const piece = board[selected.row][selected.col];
    return piece ? getLegalMoveEffects(board, hands, selected, piece) : [];
  }, [board, hands, selected, selectedHandPiece]);

  const reset = () => {
    setBoard(createInitialBoard());
    setHands(cloneHands(EMPTY_HANDS));
    setSelected(null);
    setSelectedHandPiece(null);
    setMoveCount(0);
    setCpuThinking(false);
    setWinner(null);
    setMessage('1P READY');
  };

  const finishCpuMove = (sourceBoard: BoardGrid, sourceHands: HandPieces, move: GameMove) => {
    const nextHands = nextHandsAfterMove(sourceBoard, sourceHands, move, 'white');
    const nextBoard = applyMoveToBoard(sourceBoard, move, 'white');
    const nextWinner = getCheckmateWinner(nextBoard, nextHands);
    const checked = getCheckStatus(nextBoard);
    setBoard(nextBoard);
    setHands(nextHands);
    setMoveCount((v) => v + 1);
    setCpuThinking(false);
    setWinner(nextWinner);
    if (nextWinner === 'white') setMessage('HQ LOST · CPU VICTORY');
    else if (nextWinner === 'black') setMessage('CPU HQ LOST · 1P VICTORY');
    else if (checked === 'black') setMessage('WARNING · HQ UNDER ATTACK');
    else setMessage('1P READY');
  };

  const scheduleCpuTurn = (sourceBoard: BoardGrid, sourceHands: HandPieces) => {
    const immediateWinner = getCheckmateWinner(sourceBoard, sourceHands);
    if (immediateWinner) {
      setWinner(immediateWinner);
      setCpuThinking(false);
      setMessage(immediateWinner === 'black' ? 'CPU HQ LOST · 1P VICTORY' : 'HQ LOST · CPU VICTORY');
      return;
    }
    setCpuThinking(true);
    setMessage('CPU THINKING');
    setTimeout(() => {
      const move = chooseCpuMove(sourceBoard, sourceHands, cpuLevel);
      if (!move) {
        setCpuThinking(false);
        setMessage('CPU NO LEGAL MOVE');
        return;
      }
      finishCpuMove(sourceBoard, sourceHands, move);
    }, 360);
  };

  const executePlayerMove = (move: GameMove) => {
    const nextHands = nextHandsAfterMove(board, hands, move, 'black');
    const nextBoard = applyMoveToBoard(board, move, 'black');
    const nextWinner = getCheckmateWinner(nextBoard, nextHands);
    const checked = getCheckStatus(nextBoard);
    setBoard(nextBoard);
    setHands(nextHands);
    setSelected(null);
    setSelectedHandPiece(null);
    setMoveCount((v) => v + 1);
    setWinner(nextWinner);
    if (nextWinner) {
      setMessage(nextWinner === 'black' ? 'CPU HQ LOST · 1P VICTORY' : 'HQ LOST · CPU VICTORY');
      return;
    }
    if (checked === 'white') setMessage('ENEMY HQ UNDER ATTACK');
    scheduleCpuTurn(nextBoard, nextHands);
  };

  const onCell = (row: number, col: number) => {
    if (cpuThinking || winner) return;
    const pos = { row, col };
    const piece = board[row][col];
    const legal = effects.some((e) => samePos(e.position, pos));

    if (selectedHandPiece && legal) {
      executePlayerMove({ to: pos, dropPiece: selectedHandPiece, promote: false });
      return;
    }

    if (selected && legal) {
      const moving = board[selected.row][selected.col];
      if (!moving) return;
      const forced = mustPromote(moving, pos);
      const optional = !forced && moveTouchesPromotionZone(moving, selected, pos);
      const base: GameMove = { from: selected, to: pos, promote: forced };
      if (optional) {
        Alert.alert(
          mode === 'shogi' ? '成りますか？' : 'UPGRADE UNIT?',
          mode === 'shogi' ? 'この駒を成ることができます。' : 'Promotion zone reached.',
          [
            { text: mode === 'shogi' ? '成らない' : 'KEEP', onPress: () => executePlayerMove({ ...base, promote: false }) },
            { text: mode === 'shogi' ? '成る' : 'UPGRADE', onPress: () => executePlayerMove({ ...base, promote: true }) },
          ],
        );
      } else {
        executePlayerMove(base);
      }
      return;
    }

    if (piece?.player === 'black') {
      setSelected(pos);
      setSelectedHandPiece(null);
      setMessage(`${pieceLabel(piece, mode)} SELECTED`);
    } else {
      setSelected(null);
      setSelectedHandPiece(null);
      setMessage('1P READY');
    }
  };

  const selectHand = (type: PieceType) => {
    if (cpuThinking || winner) return;
    setSelected(null);
    setSelectedHandPiece((current) => current === type ? null : type);
    setMessage(`${mode === 'military' ? MILITARY[type] : SHOGI[type]} DEPLOY`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page} bounces={false}>
        <View style={styles.commandRow}>
          <View style={styles.segment}>
            {(['military', 'shogi'] as DisplayMode[]).map((value) => (
              <Pressable key={value} onPress={() => { setMode(value); setSelected(null); setSelectedHandPiece(null); }} style={[styles.segmentButton, mode === value && styles.segmentActive]}>
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
          <Text style={styles.turnText}>{cpuThinking ? '▼ CPU GOTE' : '▼ 1P SENTE'} · {cpuLevel.toUpperCase()}</Text>
          <Text style={styles.moveText}>MOVES {moveCount}</Text>
        </View>

        <HandRow title="CPU CAPTURED" items={hands.white} mode={mode} cpu compact />

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
                  effect?.kind === 'capture' ? styles.captureCell : effect?.kind === 'cross' ? styles.crossCell : effect?.kind === 'diagonal' ? styles.diagonalCell : effect ? styles.moveCell : null,
                  isSelected && styles.selectedCell,
                ]}
              >
                {effect && !piece ? <Text style={styles.moveGlyph}>{effect.kind === 'diagonal' ? '✦' : effect.kind === 'cross' ? '╋' : '◆'}</Text> : null}
                {piece ? <PieceView piece={piece} mode={mode} /> : null}
              </Pressable>
            );
          }))}
        </View>

        <HandRow title="1P CAPTURED" items={hands.black} mode={mode} selected={selectedHandPiece} onSelect={selectHand} />

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

function pieceLabel(piece: Piece, mode: DisplayMode) {
  if (mode === 'military') return MILITARY[piece.type];
  if (piece.promoted && PROMOTED_SHOGI[piece.type]) return PROMOTED_SHOGI[piece.type]!;
  return SHOGI[piece.type];
}

function PieceView({ piece, mode }: { piece: Piece; mode: DisplayMode }) {
  const text = pieceLabel(piece, mode);
  return (
    <View style={[styles.piece, piece.player === 'white' && styles.cpuPiece]}>
      <Text style={[styles.pieceText, mode === 'shogi' && styles.kanji]}>{text}</Text>
      {piece.promoted && mode === 'military' ? <Text style={styles.promoted}>UP</Text> : null}
    </View>
  );
}

function HandRow({
  title,
  items,
  mode,
  selected,
  onSelect,
  cpu,
  compact,
}: {
  title: string;
  items: PieceType[];
  mode: DisplayMode;
  selected?: PieceType | null;
  onSelect?: (type: PieceType) => void;
  cpu?: boolean;
  compact?: boolean;
}) {
  const counts = handCounts(items);
  const types = Object.keys(counts) as PieceType[];
  return (
    <View style={[styles.handPanel, compact && styles.handPanelCompact]}>
      <Text style={styles.handTitle}>{title}</Text>
      <View style={[styles.handPieces, cpu && styles.cpuHandPieces]}>
        {types.length === 0 ? <Text style={styles.handEmpty}>—</Text> : types.map((type) => (
          <Pressable
            key={type}
            disabled={!onSelect}
            onPress={() => onSelect?.(type)}
            style={[styles.handChip, selected === type && styles.handChipSelected, cpu && styles.cpuHandChip]}
          >
            <Text style={[styles.handChipText, mode === 'shogi' && styles.handKanji]}>{mode === 'military' ? MILITARY[type] : SHOGI[type]}</Text>
            {(counts[type] ?? 0) > 1 ? <Text style={styles.handCount}>×{counts[type]}</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050909' },
  page: { minHeight: '100%', alignItems: 'center', padding: 8, paddingBottom: 24, gap: 8 },
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
  handPanel: { width: '100%', minHeight: 58, borderWidth: 1, borderColor: '#4b4930', backgroundColor: '#0b0e09', padding: 6 },
  handPanelCompact: { minHeight: 48 },
  handTitle: { color: '#7b8160', fontSize: 8, letterSpacing: 1.5, marginBottom: 4 },
  handPieces: { minHeight: 30, flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  cpuHandPieces: { transform: [{ rotate: '180deg' }] },
  handEmpty: { color: '#42483a', fontSize: 13 },
  handChip: { minWidth: 42, minHeight: 30, borderWidth: 1, borderColor: '#a99a50', backgroundColor: '#1b2415', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  cpuHandChip: { borderColor: '#5b91b0', backgroundColor: '#151d23' },
  handChipSelected: { borderWidth: 2, borderColor: '#f6ef23', backgroundColor: '#3e4514' },
  handChipText: { color: '#f2e88c', fontSize: 9, fontWeight: '900' },
  handKanji: { fontSize: 16 },
  handCount: { position: 'absolute', right: 2, bottom: 0, color: '#fff', fontSize: 7 },
  board: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 4, borderColor: '#332f1d', backgroundColor: '#5d5431' },
  cell: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#242113', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6a6139' },
  moveCell: { backgroundColor: '#b27322' },
  captureCell: { backgroundColor: '#7f251e' },
  crossCell: { backgroundColor: '#315b78' },
  diagonalCell: { backgroundColor: '#3f6638' },
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
