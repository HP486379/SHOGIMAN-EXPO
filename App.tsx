import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
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
import { UNIT_GUIDE_PANEL_IMAGE } from './src/assets/unitGuidePanelImage';

const MILITARY: Record<PieceType, string> = {
  pawn: 'INF', lance: 'ART', knight: 'DRN', silver: 'SPC', gold: 'GRD', bishop: 'RKT', rook: 'TNK', king: 'HQ',
};
const SHOGI: Record<PieceType, string> = {
  pawn: '歩', lance: '香', knight: '桂', silver: '銀', gold: '金', bishop: '角', rook: '飛', king: '王',
};
const PROMOTED_SHOGI: Partial<Record<PieceType, string>> = {
  pawn: 'と', lance: '杏', knight: '圭', silver: '全', bishop: '馬', rook: '龍',
};
const GUIDE_CROP_WIDTH = 44.9;
const GUIDE_CROP_HEIGHT = 18.9;
const GUIDE_SOURCE_RATIO = 450 / 360;
const MINI_GUIDE_VISIBLE_MS = 1000;
const GUIDE_REGION: Record<PieceType, { left: number; top: number }> = {
  pawn: { left: 5.1, top: 15.9 },
  lance: { left: 51.4, top: 15.9 },
  knight: { left: 5.1, top: 36.2 },
  silver: { left: 51.4, top: 36.2 },
  gold: { left: 5.1, top: 56.4 },
  bishop: { left: 51.4, top: 56.4 },
  rook: { left: 5.1, top: 76.7 },
  king: { left: 51.4, top: 76.7 },
};

const EMPTY_HANDS: HandPieces = { black: [], white: [] };
const samePos = (a: Position | null, b: Position) => !!a && a.row === b.row && a.col === b.col;

type Sheet = 'guide' | 'settings' | null;
type MiniGuideState = { piece: Piece; pos: Position } | null;

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
  const [miniGuide, setMiniGuide] = useState<MiniGuideState>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const shakeX = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const impactOpacity = useRef(new Animated.Value(0)).current;
  const impactScale = useRef(new Animated.Value(0.6)).current;
  const miniGuideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (miniGuideTimer.current) clearTimeout(miniGuideTimer.current);
  }, []);

  const effects = useMemo<EffectCell[]>(() => {
    if (selectedHandPiece) return getDropEffects(board, selectedHandPiece, 'black');
    if (!selected) return [];
    const piece = board[selected.row][selected.col];
    return piece ? getLegalMoveEffects(board, hands, selected, piece) : [];
  }, [board, hands, selected, selectedHandPiece]);

  const activeGuideType = selectedHandPiece ?? miniGuide?.piece.type ?? (selected ? board[selected.row]?.[selected.col]?.type ?? null : null);

  const showMiniGuide = (piece: Piece, pos: Position) => {
    if (mode !== 'military') return;
    setMiniGuide({ piece: { ...piece }, pos: { ...pos } });
    if (miniGuideTimer.current) clearTimeout(miniGuideTimer.current);
    miniGuideTimer.current = setTimeout(() => setMiniGuide(null), MINI_GUIDE_VISIBLE_MS);
  };

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
    setMiniGuide(null);
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
    setMiniGuide(null);
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

    if (piece) showMiniGuide(piece, pos);

    if (piece?.player === 'black') {
      setSelected(pos);
      setSelectedHandPiece(null);
      setMessage(`${pieceLabel(piece, mode)} SELECTED`);
    } else if (!piece) {
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
              <Pressable key={value} onPress={() => { setMode(value); setSelected(null); setSelectedHandPiece(null); setMiniGuide(null); }} style={[styles.segmentButton, mode === value && styles.segmentActive]}>
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

        <View style={[styles.boardWrap, { width: boardWidth, height: boardWidth }]}>
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
          {mode === 'military' && miniGuide ? <MiniGuideOverlay state={miniGuide} boardWidth={boardWidth} /> : null}
        </View>

        <HandRow title="1P CAPTURED" items={hands.black} mode={mode} selected={selectedHandPiece} onSelect={selectHand} />

        <View style={styles.statusPanel}>
          <Text style={styles.statusTitle}>TACTIC CHANNEL</Text>
          <Text style={styles.statusText}>{message}</Text>
        </View>

        <View style={styles.bottomBar}>
          <Pressable style={styles.tool}><Text style={styles.toolText}>◆ AI</Text></Pressable>
          <Pressable style={styles.tool} onPress={() => setSheet('guide')}><Text style={styles.toolText}>▣ GUIDE</Text></Pressable>
          <Pressable style={styles.tool} onPress={() => setSheet('settings')}><Text style={styles.toolText}>⚙ SET</Text></Pressable>
        </View>
      </ScrollView>

      <SheetModal
        sheet={sheet}
        onClose={() => setSheet(null)}
        mode={mode}
        setMode={(value) => { setMode(value); setMiniGuide(null); }}
        cpuLevel={cpuLevel}
        setCpuLevel={setCpuLevel}
        reset={() => { reset(); setSheet(null); }}
        activeGuideType={activeGuideType}
        width={width}
      />
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

function GuideCrop({ type, width }: { type: PieceType; width: number }) {
  const region = GUIDE_REGION[type];
  const sourceWidth = width / (GUIDE_CROP_WIDTH / 100);
  const sourceHeight = sourceWidth * GUIDE_SOURCE_RATIO;
  const height = sourceHeight * (GUIDE_CROP_HEIGHT / 100);
  return (
    <View style={[styles.guideCrop, { width, height }]}>
      <Image
        source={{ uri: UNIT_GUIDE_PANEL_IMAGE }}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: sourceWidth,
          height: sourceHeight,
          left: -(region.left / 100) * sourceWidth,
          top: -(region.top / 100) * sourceHeight,
        }}
      />
    </View>
  );
}

function MiniGuideOverlay({ state, boardWidth }: { state: Exclude<MiniGuideState, null>; boardWidth: number }) {
  const width = Math.min(boardWidth * 0.56, 235);
  const sourceWidth = width / (GUIDE_CROP_WIDTH / 100);
  const guideHeight = sourceWidth * GUIDE_SOURCE_RATIO * (GUIDE_CROP_HEIGHT / 100);
  const leftPercent = Math.min(76, Math.max(24, ((state.pos.col + 0.5) / 9) * 100));
  const left = (leftPercent / 100) * boardWidth - width / 2;
  const showBelow = state.piece.player === 'black';
  const edge = showBelow
    ? ((state.pos.row + 1.12) / 9) * boardWidth
    : ((9 - state.pos.row + 0.12) / 9) * boardWidth;
  const position = showBelow ? { top: edge } : { bottom: edge };
  return (
    <View pointerEvents="none" style={[styles.miniGuide, { left, width, height: guideHeight }, position]}>
      <GuideCrop type={state.piece.type} width={width} />
      {state.piece.promoted ? <Text style={styles.miniGuideUpgrade}>UPGRADED</Text> : null}
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

function SheetModal({
  sheet,
  onClose,
  mode,
  setMode,
  cpuLevel,
  setCpuLevel,
  reset,
  activeGuideType,
  width,
}: {
  sheet: Sheet;
  onClose: () => void;
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
  cpuLevel: CpuLevel;
  setCpuLevel: (level: CpuLevel) => void;
  reset: () => void;
  activeGuideType: PieceType | null;
  width: number;
}) {
  const guideWidth = Math.min(width - 34, 420);
  const guideHeight = guideWidth * GUIDE_SOURCE_RATIO;
  const region = activeGuideType ? GUIDE_REGION[activeGuideType] : null;
  return (
    <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeading}>
            <Text style={styles.sheetTitle}>{sheet === 'guide' ? 'UNIT GUIDE' : 'SETTINGS'}</Text>
            <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          {sheet === 'guide' ? (
            <View style={[styles.fullGuideWrap, { width: guideWidth, height: guideHeight }]}>
              <Image source={{ uri: UNIT_GUIDE_PANEL_IMAGE }} resizeMode="stretch" style={styles.absoluteFill} />
              {region ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.fullGuideHighlight,
                    {
                      left: `${region.left}%`,
                      top: `${region.top}%`,
                      width: `${GUIDE_CROP_WIDTH}%`,
                      height: `${GUIDE_CROP_HEIGHT}%`,
                    },
                  ]}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.settingsBody}>
              <Text style={styles.settingLabel}>DISPLAY</Text>
              <View style={styles.settingSegment}>
                {(['military', 'shogi'] as DisplayMode[]).map((value) => (
                  <Pressable key={value} onPress={() => setMode(value)} style={[styles.settingButton, mode === value && styles.settingActive]}>
                    <Text style={styles.settingButtonText}>{value.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.settingLabel}>CPU LEVEL</Text>
              <View style={styles.settingSegment}>
                {(['easy', 'normal', 'hard'] as CpuLevel[]).map((value) => (
                  <Pressable key={value} onPress={() => setCpuLevel(value)} style={[styles.settingButton, cpuLevel === value && styles.settingActive]}>
                    <Text style={styles.settingButtonText}>{value.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.resetButton} onPress={reset}><Text style={styles.resetText}>RESET BATTLE</Text></Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
  boardWrap: { position: 'relative', overflow: 'visible' },
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
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  flashOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#fff5bf', zIndex: 50 },
  impact: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  impactGlyph: { color: '#ffdf45', fontSize: 42, fontWeight: '900', textShadowColor: '#ff4b19', textShadowRadius: 10 },
  guideCrop: { overflow: 'hidden', backgroundColor: '#070904' },
  miniGuide: { position: 'absolute', zIndex: 100, borderWidth: 2, borderColor: '#f6ef23', borderRadius: 10, overflow: 'hidden', shadowColor: '#f6ef23', shadowOpacity: 0.7, shadowRadius: 12, elevation: 12 },
  miniGuideUpgrade: { position: 'absolute', right: 5, top: 5, color: '#fff', backgroundColor: '#b92f20', fontSize: 8, fontWeight: '900', paddingHorizontal: 4, paddingVertical: 2 },
  statusPanel: { width: '100%', minHeight: 72, borderWidth: 1, borderColor: '#88392c', backgroundColor: '#050b0b', padding: 10 },
  statusTitle: { color: '#e86b55', fontSize: 10, letterSpacing: 2 },
  statusText: { color: '#98c9bb', marginTop: 8, fontSize: 12, letterSpacing: 1 },
  bottomBar: { width: '100%', flexDirection: 'row', gap: 8 },
  tool: { flex: 1, minHeight: 58, borderWidth: 1, borderColor: '#315b52', backgroundColor: '#07100f', alignItems: 'center', justifyContent: 'center' },
  toolText: { color: '#79d8c3', fontSize: 11, letterSpacing: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.62)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#07100f', borderTopWidth: 1, borderColor: '#3a6c60', padding: 16, paddingBottom: 28, alignItems: 'center' },
  sheetHandle: { width: 50, height: 4, borderRadius: 3, backgroundColor: '#58756d', marginBottom: 12 },
  sheetHeading: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { color: '#8ff6dc', fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  closeText: { color: '#8ff6dc', fontSize: 28, lineHeight: 30 },
  fullGuideWrap: { position: 'relative', backgroundColor: '#050704' },
  fullGuideHighlight: { position: 'absolute', borderWidth: 3, borderColor: '#f6ef23', backgroundColor: 'rgba(246,239,35,.08)' },
  settingsBody: { width: '100%', gap: 10 },
  settingLabel: { color: '#71968b', fontSize: 9, letterSpacing: 1.5, marginTop: 4 },
  settingSegment: { flexDirection: 'row', gap: 8 },
  settingButton: { flex: 1, borderWidth: 1, borderColor: '#315b52', paddingVertical: 12, alignItems: 'center', backgroundColor: '#0b1513' },
  settingActive: { borderColor: '#71f0d4', backgroundColor: '#14392f' },
  settingButtonText: { color: '#9ad7c8', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  resetButton: { marginTop: 10, borderWidth: 1, borderColor: '#a74534', backgroundColor: '#220c09', paddingVertical: 14, alignItems: 'center' },
  resetText: { color: '#ff7860', fontWeight: '800', letterSpacing: 1.4 },
});
