import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
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
import { getBattlefieldPieceTypeIcon, getBattlefieldUnitIcon } from './src/assets/battlefieldUnitIcons';

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

function svgXmlFromDataUri(uri: string): string {
  const comma = uri.indexOf(',');
  return decodeURIComponent(comma >= 0 ? uri.slice(comma + 1) : uri);
}

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
  const [impactPos, setImpactPos] = useState<Position | null>(null);

  const shakeX = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const impactOpacity = useRef(new Animated.Value(0)).current;
  const impactScale = useRef(new Animated.Value(0.6)).current;

  const effects = useMemo<EffectCell[]>(() => {
    if (selectedHandPiece) return getDropEffects(board, selectedHandPiece, 'black');
    if (!selected) return [];
    const piece = board[selected.row][selected.col];
    return piece ? getLegalMoveEffects(board, hands, selected, piece) : [];
  }, [board, hands, selected, selectedHandPiece]);

  const playImpact = (pos: Position) => {
    setImpactPos(pos);
    shakeX.setValue(0);
    flashOpacity.setValue(0);
    impactOpacity.setValue(1);
    impactScale.setValue(0.55);
    Vibration.vibrate(35);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -5, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 5, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -3, duration: 35, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.45, duration: 45, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(impactScale, { toValue: 1.65, duration: 180, useNativeDriver: true }),
        Animated.timing(impactOpacity, { toValue: 0, duration: 230, useNativeDriver: true }),
      ]),
    ]).start(() => setImpactPos(null));
  };

  const reset = () => {
    setBoard(createInitialBoard());
    setHands(cloneHands(EMPTY_HANDS));
    setSelected(null);
    setSelectedHandPiece(null);
    setMoveCount(0);
    setCpuThinking(false);
    setWinner(null);
    setImpactPos(null);
    setMessage('1P READY');
  };

  const finishCpuMove = (sourceBoard: BoardGrid, sourceHands: HandPieces, move: GameMove) => {
    const captured = sourceBoard[move.to.row][move.to.col];
    const nextHands = nextHandsAfterMove(sourceBoard, sourceHands, move, 'white');
    const nextBoard = applyMoveToBoard(sourceBoard, move, 'white');
    const nextWinner = getCheckmateWinner(nextBoard, nextHands);
    const checked = getCheckStatus(nextBoard);
    if (captured) playImpact(move.to);
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
    const captured = board[move.to.row][move.to.col];
    const nextHands = nextHandsAfterMove(board, hands, move, 'black');
    const nextBoard = applyMoveToBoard(board, move, 'black');
    const nextWinner = getCheckmateWinner(nextBoard, nextHands);
    const checked = getCheckStatus(nextBoard);
    if (captured) playImpact(move.to);
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

        <Animated.View style={[styles.board, { width: boardWidth, height: boardWidth, transform: [{ translateX: shakeX }] }]}>
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

          <Animated.View pointerEvents="none" style={[styles.flashOverlay, { opacity: flashOpacity }]} />
          {impactPos ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.impact,
                {
                  left: impactPos.col * cell + cell / 2 - 22,
                  top: impactPos.row * cell + cell / 2 - 22,
                  opacity: impactOpacity,
                  transform: [{ scale: impactScale }],
                },
              ]}
            >
              <Text style={styles.impactGlyph}>✹</Text>
            </Animated.View>
          ) : null}
        </Animated.View>

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

function MilitaryArtwork({ piece }: { piece: Piece }) {
  return <SvgXml xml={svgXmlFromDataUri(getBattlefieldUnitIcon(piece))} width="100%" height="100%" />;
}

function HandMilitaryArtwork({ type }: { type: PieceType }) {
  return <SvgXml xml={svgXmlFromDataUri(getBattlefieldPieceTypeIcon(type))} width="100%" height="100%" />;
}

function PieceView({ piece, mode }: { piece: Piece; mode: DisplayMode }) {
  const text = pieceLabel(piece, mode);
  return (
    <View style={[styles.pieceWrap, piece.player === 'white' && styles.cpuPiece]}>
      {mode === 'military' ? (
        <>
          <View style={styles.pieceArtwork}><MilitaryArtwork piece={piece} /></View>
          <Text style={styles.militaryBadge}>{text}</Text>
          {piece.promoted ? <Text style={styles.promoted}>UP</Text> : null}
        </>
      ) : (
        <View style={styles.shogiPiece}>
          <Text style={styles.kanji}>{text}</Text>
        </View>
      )}
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
            {mode === 'military' ? (
              <>
                <View style={styles.handArtwork}><HandMilitaryArtwork type={type} /></View>
                <Text style={styles.handMilitaryLabel}>{MILITARY[type]}</Text>
              </>
            ) : (
              <Text style={styles.handKanji}>{SHOGI[type]}</Text>
            )}
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
  handChip: { width: 45, height: 36, borderWidth: 1, borderColor: '#a99a50', backgroundColor: '#10170d', alignItems: 'center', justifyContent: 'center' },
  cpuHandChip: { borderColor: '#5b91b0', backgroundColor: '#10161b' },
  handChipSelected: { borderWidth: 2, borderColor: '#f6ef23', backgroundColor: '#3e4514' },
  handArtwork: { width: 34, height: 30 },
  handMilitaryLabel: { position: 'absolute', bottom: 1, color: '#fff6a8', backgroundColor: '#11170d', borderWidth: 1, borderColor: '#d7c965', fontSize: 6, paddingHorizontal: 2 },
  handKanji: { color: '#f2e88c', fontSize: 18, fontWeight: '800' },
  handCount: { position: 'absolute', right: 1, top: 0, color: '#fff', backgroundColor: '#8d2c20', fontSize: 7, paddingHorizontal: 2 },
  board: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 4, borderColor: '#332f1d', backgroundColor: '#5d5431', overflow: 'hidden' },
  cell: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#242113', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6a6139' },
  moveCell: { backgroundColor: '#b27322' },
  captureCell: { backgroundColor: '#7f251e' },
  crossCell: { backgroundColor: '#315b78' },
  diagonalCell: { backgroundColor: '#3f6638' },
  selectedCell: { borderWidth: 3, borderColor: '#f6ef23' },
  moveGlyph: { color: '#ffd676', fontSize: 18, fontWeight: '900', position: 'absolute', zIndex: 1 },
  pieceWrap: { width: '96%', height: '96%', alignItems: 'center', justifyContent: 'center' },
  cpuPiece: { transform: [{ rotate: '180deg' }] },
  pieceArtwork: { width: '94%', height: '94%' },
  militaryBadge: { position: 'absolute', bottom: 1, color: '#f7ed8d', backgroundColor: '#10150c', borderWidth: 1, borderColor: '#d9ca67', fontSize: 6.5, fontWeight: '900', paddingHorizontal: 2 },
  shogiPiece: { width: '78%', height: '78%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d9b85f', borderWidth: 1.5, borderColor: '#543f15' },
  kanji: { color: '#241906', fontSize: 20, fontWeight: '900' },
  promoted: { position: 'absolute', right: -1, top: 0, color: '#fff', backgroundColor: '#b92f20', fontSize: 6, paddingHorizontal: 2 },
  flashOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff5bf', zIndex: 50 },
  impact: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  impactGlyph: { color: '#ffdf45', fontSize: 42, fontWeight: '900', textShadowColor: '#ff4b19', textShadowRadius: 10 },
  statusPanel: { width: '100%', minHeight: 72, borderWidth: 1, borderColor: '#88392c', backgroundColor: '#050b0b', padding: 10 },
  statusTitle: { color: '#e86b55', fontSize: 10, letterSpacing: 2 },
  statusText: { color: '#98c9bb', marginTop: 8, fontSize: 12, letterSpacing: 1 },
  bottomBar: { width: '100%', flexDirection: 'row', gap: 8 },
  tool: { flex: 1, minHeight: 58, borderWidth: 1, borderColor: '#315b52', backgroundColor: '#07100f', alignItems: 'center', justifyContent: 'center' },
  toolText: { color: '#79d8c3', fontSize: 11, letterSpacing: 1 },
});
