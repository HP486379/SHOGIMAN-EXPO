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
  Player,
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
import { useExpoAdvisor } from './src/hooks/useExpoAdvisor';
import { OpenAiAdvice } from './src/utils/openAiAdvisor';

const MILITARY: Record<PieceType, string> = {
  pawn: 'INF', lance: 'ART', knight: 'DRN', silver: 'SPC', gold: 'GRD', bishop: 'RKT', rook: 'TNK', king: 'HQ',
};
const SHOGI: Record<PieceType, string> = {
  pawn: '歩', lance: '香', knight: '桂', silver: '銀', gold: '金', bishop: '角', rook: '飛', king: '王',
};
const PROMOTED_SHOGI: Partial<Record<PieceType, string>> = {
  pawn: 'と', lance: '杏', knight: '圭', silver: '全', bishop: '馬', rook: '龍',
};
const PIECE_ORDER: PieceType[] = ['pawn', 'lance', 'knight', 'silver', 'gold', 'bishop', 'rook', 'king'];

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

type Sheet = 'ai' | 'guide' | 'settings' | null;
type MiniGuideState = { piece: Piece; pos: Position } | null;
type AdvisorSource = 'idle' | 'loading' | 'openai' | 'error';

function svgXmlFromDataUri(uri: string): string {
  const comma = uri.indexOf(',');
  return decodeURIComponent(comma >= 0 ? uri.slice(comma + 1) : uri);
}

function removeOne(items: PieceType[], target: PieceType): PieceType[] {
  const index = items.indexOf(target);
  if (index < 0) return items;
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

function nextHandsAfterMove(board: BoardGrid, hands: HandPieces, move: GameMove, player: Player): HandPieces {
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

function pieceLabel(piece: Piece, mode: DisplayMode) {
  if (mode === 'military') return MILITARY[piece.type];
  if (piece.promoted && PROMOTED_SHOGI[piece.type]) return PROMOTED_SHOGI[piece.type]!;
  return SHOGI[piece.type];
}

export default function App() {
  const { width } = useWindowDimensions();

  // SHOGIMAN-IOS is the source of truth: the battle UI is an iPhone-width shell.
  const shellWidth = Math.min(width, 480);
  const contentWidth = Math.max(304, shellWidth - 16);
  const boardWidth = contentWidth;
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
  const [winner, setWinner] = useState<Player | null>(null);
  const [lastMovePlayer, setLastMovePlayer] = useState<Player | null>(null);
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

  const checkPlayer = useMemo(() => getCheckStatus(board), [board]);
  const advisor = useExpoAdvisor({ board, hands, moveCount, cpuThinking, winner, checkPlayer, lastMovePlayer });
  const activeGuideType = selectedHandPiece ?? miniGuide?.piece.type ?? (selected ? board[selected.row]?.[selected.col]?.type ?? null : null);
  const score = String(moveCount * 100).padStart(6, '0');
  const turn = cpuThinking ? 'CPU' : '1P';

  const openAi = () => {
    advisor.markRead();
    advisor.dismissTransmission();
    setSheet('ai');
  };

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
    setLastMovePlayer(null);
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
    setLastMovePlayer('white');
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
    setLastMovePlayer('black');
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

  const switchMode = (value: DisplayMode) => {
    setMode(value);
    setSelected(null);
    setSelectedHandPiece(null);
    setMiniGuide(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.page, { width: shellWidth }]}
        bounces={false}
      >
        <View style={styles.battleControls}>
          <ControlRow label="MODE">
            {(['military', 'shogi'] as DisplayMode[]).map((value) => (
              <SegmentButton
                key={value}
                text={value.toUpperCase()}
                active={mode === value}
                onPress={() => switchMode(value)}
              />
            ))}
          </ControlRow>

          <ControlRow label="CPU">
            {(['easy', 'normal', 'hard'] as CpuLevel[]).map((value) => (
              <SegmentButton
                key={value}
                text={value.toUpperCase()}
                active={cpuLevel === value}
                onPress={() => setCpuLevel(value)}
              />
            ))}
          </ControlRow>

          <View style={styles.statusRow}>
            <StatusItem label="TURN" value={turn} accent="#ff765e" />
            <StatusItem label="MOVES" value={String(moveCount).padStart(3, '0')} />
            <StatusItem label="SCORE" value={score} accent="#54e8a7" />
          </View>
        </View>

        <HandRow title="CPU CAPTURED" items={hands.white} mode={mode} cpu />

        <View style={[styles.turnBanner, cpuThinking ? styles.cpuTurnBanner : styles.playerTurnBanner]}>
          <Text style={[styles.turnBannerText, cpuThinking ? styles.cpuTurnText : styles.playerTurnText]}>
            {cpuThinking ? '▲ CPU SENTE' : '▼ 1P SENTE'} · {cpuLevel.toUpperCase()}
          </Text>
        </View>

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
                    effect?.kind === 'capture' ? styles.captureCell
                      : effect?.kind === 'cross' ? styles.crossCell
                        : effect?.kind === 'diagonal' ? styles.diagonalCell
                          : effect ? styles.moveCell : null,
                    isSelected && styles.selectedCell,
                  ]}
                >
                  {effect && !piece ? (
                    <Text style={styles.moveGlyph}>
                      {effect.kind === 'diagonal' ? '✦' : effect.kind === 'cross' ? '╋' : effect.kind === 'capture' ? '✕' : '◆'}
                    </Text>
                  ) : null}
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

        <View style={styles.gateMeter}>
          <Text style={styles.gateText}>▽ 1P GOTE ▰▰▰▰▰▰ 100%</Text>
        </View>

        <HandRow
          title="1P CAPTURED"
          items={hands.black}
          mode={mode}
          selected={selectedHandPiece}
          onSelect={selectHand}
        />

        {checkPlayer === 'black' ? (
          <View style={styles.radioAlert}>
            <Text style={styles.radioAlertText}>⚡ TACTIC ALERT · HQ UNDER DIRECT ATTACK</Text>
          </View>
        ) : null}

        {winner ? (
          <View style={[styles.radioAlert, styles.victoryAlert]}>
            <Text style={[styles.radioAlertText, styles.victoryText]}>
              {winner === 'black' ? 'MISSION COMPLETE · 1P VICTORY' : 'MISSION FAILED · CPU VICTORY'}
            </Text>
          </View>
        ) : null}

        <View style={styles.statusPanel}>
          <Text style={styles.statusTitle}>TACTIC CHANNEL · {advisor.evaluation}</Text>
          <Text style={styles.statusText}>{message}</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={[styles.bottomBar, { width: shellWidth }]}>
        <Pressable style={[styles.tool, styles.aiTool, advisor.unread && styles.toolUnread]} onPress={openAi}>
          <Text style={[styles.toolIcon, styles.aiToolText]}>◆</Text>
          <Text style={[styles.toolText, styles.aiToolText]}>AI</Text>
          {advisor.unread ? <View style={styles.unreadDot} /> : null}
        </Pressable>
        <Pressable style={styles.tool} onPress={() => setSheet('guide')}>
          <Text style={styles.toolIcon}>▣</Text>
          <Text style={styles.toolText}>GUIDE</Text>
        </Pressable>
        <Pressable style={styles.tool} onPress={() => setSheet('settings')}>
          <Text style={styles.toolIcon}>⚙</Text>
          <Text style={styles.toolText}>SET</Text>
        </Pressable>
      </View>

      {advisor.transmission ? (
        <Pressable
          style={[
            styles.transmission,
            { width: Math.max(280, shellWidth - 24), left: (width - Math.max(280, shellWidth - 24)) / 2 },
          ]}
          onPress={openAi}
        >
          <View style={styles.transmissionHead}>
            <Text style={styles.transmissionTitle}>⚡ TACTIC ADVISOR</Text>
            <Text style={styles.transmissionEval}>{advisor.evaluation}</Text>
          </View>
          <Text style={styles.transmissionText}>{advisor.transmission.summary}</Text>
          {advisor.transmission.bullets[0] ? <Text style={styles.transmissionText}>{advisor.transmission.bullets[0]}</Text> : null}
          <Text style={styles.transmissionHint}>TAP TO OPEN · AUTO CLOSE</Text>
        </Pressable>
      ) : null}

      <SheetModal
        sheet={sheet}
        onClose={() => setSheet(null)}
        mode={mode}
        setMode={switchMode}
        cpuLevel={cpuLevel}
        setCpuLevel={setCpuLevel}
        reset={() => { reset(); setSheet(null); }}
        activeGuideType={activeGuideType}
        width={shellWidth}
        advisor={{
          evaluation: advisor.evaluation,
          latestAdvice: advisor.latestAdvice,
          source: advisor.source,
          analyze: advisor.analyze,
          canAnalyze: !cpuThinking && !winner,
        }}
      />
    </SafeAreaView>
  );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.controlRow}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.segment}>{children}</View>
    </View>
  );
}

function SegmentButton({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{text}</Text>
    </Pressable>
  );
}

function StatusItem({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statusItem}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
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
          <Text style={[styles.militaryBadge, piece.player === 'white' && styles.cpuBadge]}>{text}</Text>
          {piece.promoted ? <Text style={styles.promoted}>UP</Text> : null}
        </>
      ) : (
        <View style={[styles.shogiPiece, piece.player === 'white' && styles.cpuShogiPiece]}>
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
  const width = Math.min(boardWidth * 0.46, 176);
  const sourceWidth = width / (GUIDE_CROP_WIDTH / 100);
  const guideHeight = sourceWidth * GUIDE_SOURCE_RATIO * (GUIDE_CROP_HEIGHT / 100);
  const leftPercent = Math.min(76, Math.max(24, ((state.pos.col + 0.5) / 9) * 100));
  const left = (leftPercent / 100) * boardWidth - width / 2;
  const showBelow = state.piece.player === 'black';
  const edge = showBelow
    ? ((state.pos.row + 1.2) / 9) * boardWidth
    : ((9 - state.pos.row + 0.2) / 9) * boardWidth;
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
}: {
  title: string;
  items: PieceType[];
  mode: DisplayMode;
  selected?: PieceType | null;
  onSelect?: (type: PieceType) => void;
  cpu?: boolean;
}) {
  const counts = handCounts(items);
  const types = PIECE_ORDER.filter((type) => (counts[type] ?? 0) > 0);
  return (
    <View style={[styles.handPanel, cpu ? styles.cpuHandPanel : styles.playerHandPanel]}>
      <Text style={[styles.handTitle, cpu ? styles.cpuHandTitle : styles.playerHandTitle]}>{title}</Text>
      <View style={[styles.handPieces, cpu && styles.cpuHandPieces]}>
        {types.length === 0 ? <Text style={styles.handEmpty}>EMPTY</Text> : types.map((type) => (
          <Pressable
            key={type}
            disabled={!onSelect}
            onPress={() => onSelect?.(type)}
            style={[styles.handChip, selected === type && styles.handChipSelected]}
          >
            {mode === 'military' ? (
              <>
                <View style={styles.handArtwork}><HandMilitaryArtwork type={type} /></View>
                <Text style={styles.handMilitaryLabel}>{MILITARY[type]}</Text>
              </>
            ) : (
              <Text style={styles.handKanji}>{SHOGI[type]}</Text>
            )}
            <Text style={styles.handCount}>×{counts[type]}</Text>
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
  advisor,
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
  advisor: {
    evaluation: string;
    latestAdvice: OpenAiAdvice | null;
    source: AdvisorSource;
    analyze: () => void;
    canAnalyze: boolean;
  };
}) {
  const guideWidth = Math.min(width - 34, 420);
  const guideHeight = guideWidth * GUIDE_SOURCE_RATIO;
  const region = activeGuideType ? GUIDE_REGION[activeGuideType] : null;
  const sourceLabel = advisor.source === 'loading' ? 'ANALYZING...'
    : advisor.source === 'openai' ? 'GPT-5.4 MINI'
      : advisor.source === 'error' ? 'API ERR' : 'STANDBY';
  const title = sheet === 'ai' ? 'AI TACTIC ADVISOR' : sheet === 'guide' ? 'UNIT GUIDE' : 'SETTINGS';

  return (
    <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { width }]} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeading}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
          </View>

          {sheet === 'ai' ? (
            <View style={styles.advisorBody}>
              <View style={styles.advisorState}>
                <Text style={styles.advisorSource}>{sourceLabel}</Text>
                <Text style={styles.advisorEvaluation}>{advisor.evaluation}</Text>
              </View>
              {advisor.latestAdvice ? (
                <View style={styles.advisorCopy}>
                  <Text style={styles.advisorText}>{advisor.latestAdvice.summary}</Text>
                  {advisor.latestAdvice.bullets[0] ? <Text style={styles.advisorText}>{advisor.latestAdvice.bullets[0]}</Text> : null}
                </View>
              ) : (
                <Text style={styles.advisorEmpty}>
                  重要な局面変化を検知した時だけAI参謀が自動介入します。必要ならANALYZEで現在局面を確認できます。
                </Text>
              )}
              <Pressable
                disabled={!advisor.canAnalyze || advisor.source === 'loading'}
                onPress={advisor.analyze}
                style={[styles.analyzeButton, (!advisor.canAnalyze || advisor.source === 'loading') && styles.analyzeDisabled]}
              >
                <Text style={styles.analyzeText}>{advisor.source === 'loading' ? 'ANALYZING...' : 'ANALYZE'}</Text>
              </Pressable>
            </View>
          ) : sheet === 'guide' ? (
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
                  <SegmentButton key={value} text={value.toUpperCase()} active={mode === value} onPress={() => setMode(value)} />
                ))}
              </View>

              <Text style={styles.settingLabel}>CPU LEVEL</Text>
              <View style={styles.settingSegment}>
                {(['easy', 'normal', 'hard'] as CpuLevel[]).map((value) => (
                  <SegmentButton key={value} text={value.toUpperCase()} active={cpuLevel === value} onPress={() => setCpuLevel(value)} />
                ))}
              </View>

              <Pressable style={styles.resetButton} onPress={reset}>
                <Text style={styles.resetText}>RESET BATTLE</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030507' },
  scroll: { flex: 1 },
  page: {
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 86,
    backgroundColor: '#050809',
  },

  battleControls: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#6b5f18',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#090c09',
    marginBottom: 8,
  },
  controlRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  controlLabel: { width: 44, color: '#8d986f', fontSize: 11, letterSpacing: 0.8 },
  segment: { flex: 1, flexDirection: 'row', gap: 5 },
  segmentButton: {
    flex: 1,
    minHeight: 34,
    borderWidth: 1,
    borderColor: '#3d4934',
    borderRadius: 4,
    backgroundColor: '#0b110d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  segmentActive: { borderColor: '#22d87d', backgroundColor: '#09301d' },
  segmentText: { color: '#a9b396', fontSize: 10, letterSpacing: 0.5, fontWeight: '700' },
  segmentTextActive: { color: '#60ffb0' },

  statusRow: {
    width: '100%',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2a3122',
    paddingTop: 8,
    gap: 6,
  },
  statusItem: { flex: 1, gap: 2 },
  statusLabel: { color: '#7e8973', fontSize: 9, letterSpacing: 0.5 },
  statusValue: { color: '#d6dba7', fontSize: 13, fontWeight: '800' },

  handPanel: {
    width: '100%',
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 9,
    backgroundColor: '#040809',
    marginBottom: 7,
  },
  cpuHandPanel: { borderColor: '#1e6ba5' },
  playerHandPanel: { borderColor: '#b54a31', marginTop: 0 },
  handTitle: { fontSize: 11, marginBottom: 6, letterSpacing: 0.3 },
  cpuHandTitle: { color: '#58b9ff' },
  playerHandTitle: { color: '#ff7862' },
  handPieces: { minHeight: 28, flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  cpuHandPieces: { transform: [{ rotate: '180deg' }] },
  handEmpty: { color: '#77755e', marginLeft: 'auto', fontSize: 11 },
  handChip: {
    height: 32,
    minWidth: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: '#4e5520',
    borderRadius: 4,
    backgroundColor: '#0b100a',
  },
  handChipSelected: { borderColor: '#ffe73b', borderWidth: 2 },
  handArtwork: { width: 25, height: 25 },
  handMilitaryLabel: { color: '#e7dc72', fontSize: 8 },
  handKanji: { color: '#e7dc72', fontSize: 17, fontWeight: '900' },
  handCount: { color: '#e7dc72', fontSize: 9, fontWeight: '800' },

  turnBanner: {
    maxWidth: '100%',
    alignSelf: 'center',
    marginVertical: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 4,
  },
  playerTurnBanner: { borderColor: '#b44a31', backgroundColor: '#1d0805' },
  cpuTurnBanner: { borderColor: '#1e6ba5', backgroundColor: '#040d14' },
  turnBannerText: { fontSize: 11, letterSpacing: 0.5, fontWeight: '700' },
  playerTurnText: { color: '#ff755c' },
  cpuTurnText: { color: '#57b9ff' },

  boardWrap: { position: 'relative', overflow: 'visible' },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 5,
    borderColor: '#4c3a18',
    backgroundColor: '#6e592c',
    overflow: 'hidden',
  },
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#1f170a',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#746039',
  },
  moveCell: { backgroundColor: '#9a6726' },
  captureCell: { backgroundColor: '#8e2d22' },
  crossCell: { backgroundColor: '#32677d' },
  diagonalCell: { backgroundColor: '#3c7048' },
  selectedCell: { borderWidth: 2, borderColor: '#ffe534', backgroundColor: '#7d7132' },
  moveGlyph: { color: '#ffd676', fontSize: 18, fontWeight: '900', position: 'absolute', zIndex: 1 },
  pieceWrap: { width: '96%', height: '96%', alignItems: 'center', justifyContent: 'center' },
  cpuPiece: { transform: [{ rotate: '180deg' }] },
  pieceArtwork: { width: '92%', height: '92%' },
  militaryBadge: {
    position: 'absolute',
    bottom: 1,
    color: '#f2e770',
    backgroundColor: '#090b08',
    borderWidth: 1,
    borderColor: '#f2e770',
    fontSize: 6,
    fontWeight: '900',
    paddingHorizontal: 2,
  },
  cpuBadge: { color: '#86cbff', borderColor: '#86cbff' },
  shogiPiece: {
    width: '78%',
    height: '78%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d7b860',
    borderWidth: 1,
    borderColor: '#543f15',
  },
  cpuShogiPiece: { backgroundColor: '#bdb1d8', borderColor: '#4a3f64' },
  kanji: { color: '#151009', fontSize: 22, fontWeight: '900' },
  promoted: { position: 'absolute', right: 1, top: 1, color: '#ff684e', backgroundColor: '#190402', fontSize: 6, paddingHorizontal: 2 },

  gateMeter: {
    alignSelf: 'center',
    marginTop: 7,
    marginBottom: 7,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#b44a31',
    borderRadius: 4,
    backgroundColor: '#1d0805',
  },
  gateText: { color: '#ff765e', fontSize: 11, letterSpacing: 0.5 },

  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  flashOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#fff5bf', zIndex: 50 },
  impact: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  impactGlyph: { color: '#ffdf45', fontSize: 42, fontWeight: '900', textShadowColor: '#ff4b19', textShadowRadius: 10 },

  guideCrop: { overflow: 'hidden', backgroundColor: '#070904' },
  miniGuide: {
    position: 'absolute',
    zIndex: 100,
    borderWidth: 2,
    borderColor: '#efd72c',
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: '#070907',
    shadowColor: '#efd72c',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 12,
  },
  miniGuideUpgrade: {
    position: 'absolute',
    right: 4,
    top: 4,
    color: '#fff',
    backgroundColor: '#b92f20',
    fontSize: 7,
    fontWeight: '900',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  radioAlert: {
    width: '100%',
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#18d9c7',
    borderRadius: 5,
    backgroundColor: '#032323',
  },
  radioAlertText: { color: '#76fff0', fontSize: 10 },
  victoryAlert: { borderColor: '#ffe253', backgroundColor: '#261f04' },
  victoryText: { color: '#ffe253' },

  statusPanel: {
    width: '100%',
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#38493d',
    borderRadius: 5,
    backgroundColor: '#050b0b',
    padding: 10,
    marginTop: 8,
  },
  statusTitle: { color: '#e86b55', fontSize: 9, letterSpacing: 1.1 },
  statusText: { color: '#98c9bb', marginTop: 8, fontSize: 11, letterSpacing: 0.7 },

  bottomSpacer: { height: 12 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#263528',
    backgroundColor: '#020507',
  },
  tool: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#274538',
    borderRadius: 7,
    backgroundColor: '#08100d',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTool: { borderColor: '#176e80' },
  toolUnread: { borderColor: '#4cf0d0' },
  toolText: { color: '#8cd9b4', fontSize: 11 },
  toolIcon: { color: '#8cd9b4', fontSize: 15 },
  aiToolText: { color: '#63dfff' },
  unreadDot: { position: 'absolute', right: 10, top: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffe336' },

  transmission: {
    position: 'absolute',
    bottom: 72,
    zIndex: 180,
    borderWidth: 1,
    borderColor: '#e55e47',
    backgroundColor: '#050b0b',
    padding: 11,
    borderRadius: 5,
    elevation: 20,
  },
  transmissionHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  transmissionTitle: { color: '#ff7960', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  transmissionEval: { color: '#d9b85f', fontSize: 9, fontWeight: '800' },
  transmissionText: { color: '#b9ddd4', fontSize: 11, lineHeight: 16, marginTop: 2 },
  transmissionHint: { color: '#647f78', fontSize: 7, letterSpacing: 1.1, marginTop: 7 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.62)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    maxHeight: '78%',
    backgroundColor: '#07100f',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#506039',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    alignItems: 'center',
  },
  sheetHandle: { width: 46, height: 4, borderRadius: 3, backgroundColor: '#506052', marginBottom: 10 },
  sheetHeading: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { color: '#e1d867', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  closeText: { color: '#889184', fontSize: 26, lineHeight: 30 },
  fullGuideWrap: { position: 'relative', backgroundColor: '#050704' },
  fullGuideHighlight: { position: 'absolute', borderWidth: 3, borderColor: '#f6ef23', backgroundColor: 'rgba(246,239,35,.08)' },

  advisorBody: { width: '100%', gap: 12 },
  advisorState: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#284e46',
    backgroundColor: '#050b0b',
    padding: 10,
  },
  advisorSource: { color: '#54f3a5', fontSize: 10 },
  advisorEvaluation: { color: '#f0e35b', fontSize: 10, fontWeight: '800' },
  advisorCopy: { borderWidth: 1, borderColor: '#253d35', backgroundColor: '#050807', padding: 11, gap: 8 },
  advisorText: { color: '#cbe0d4', lineHeight: 20, fontSize: 12 },
  advisorEmpty: { color: '#cbe0d4', lineHeight: 20, fontSize: 12 },
  analyzeButton: {
    width: '100%',
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#1fd57c',
    borderRadius: 5,
    backgroundColor: '#082418',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeDisabled: { opacity: 0.55 },
  analyzeText: { color: '#58f9a8', fontWeight: '800', letterSpacing: 0.5 },

  settingsBody: { width: '100%', gap: 9 },
  settingLabel: { color: '#8f9a7e', fontSize: 10, marginTop: 4 },
  settingSegment: { width: '100%', flexDirection: 'row', gap: 5 },
  resetButton: {
    width: '100%',
    minHeight: 44,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c64a3a',
    borderRadius: 5,
    backgroundColor: '#230806',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: { color: '#ff806d', fontWeight: '800' },
});
