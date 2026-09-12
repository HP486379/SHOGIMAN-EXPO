import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardGrid, HandPieces, PieceType, Player } from '../types/shogi';
import { AdvisorTrigger, OpenAiAdvice, requestOpenAiAdvice } from '../utils/openAiAdvisor';

type AdvisorSource = 'idle' | 'loading' | 'openai' | 'error';
type AutoEvent = Exclude<AdvisorTrigger, 'manual' | 'periodic' | 'multiple'>;

export interface ExpoAdvisorState {
  board: BoardGrid;
  hands: HandPieces;
  moveCount: number;
  cpuThinking: boolean;
  winner: Player | null;
  checkPlayer: Player | null;
  lastMovePlayer: Player | null;
}

const AUTO_INTERVAL_MOVES = 5;
const VALUES: Record<PieceType, number> = { king: 0, rook: 120, bishop: 105, gold: 72, silver: 63, knight: 42, lance: 34, pawn: 10 };
const SCORE_RANK: Record<string, number> = { 'CPU ADVANTAGE': -2, 'CPU SLIGHT LEAD': -1, BALANCED: 0, '1P SLIGHT LEAD': 1, '1P ADVANTAGE': 2 };

function promotedCount(board: BoardGrid) {
  let total = 0;
  board.forEach(row => row.forEach(piece => { if (piece?.promoted) total += 1; }));
  return total;
}

function materialScore(board: BoardGrid, hands: HandPieces) {
  let score = 0;
  board.forEach(row => row.forEach(piece => {
    if (!piece) return;
    const value = VALUES[piece.type] + (piece.promoted ? 18 : 0);
    score += piece.player === 'black' ? value : -value;
  }));
  score += hands.black.reduce((sum, type) => sum + VALUES[type] * 0.75, 0);
  score -= hands.white.reduce((sum, type) => sum + VALUES[type] * 0.75, 0);
  return score;
}

function scoreLabel(board: BoardGrid, hands: HandPieces) {
  const score = materialScore(board, hands);
  if (score >= 110) return '1P ADVANTAGE';
  if (score >= 38) return '1P SLIGHT LEAD';
  if (score <= -110) return 'CPU ADVANTAGE';
  if (score <= -38) return 'CPU SLIGHT LEAD';
  return 'BALANCED';
}

function shifted(previous: string, current: string) {
  return Math.abs((SCORE_RANK[previous] ?? 0) - (SCORE_RANK[current] ?? 0)) >= 2;
}

function chooseTrigger(events: Set<AutoEvent>, periodic: boolean): AdvisorTrigger | null {
  if (events.size > 1) return 'multiple';
  if (events.has('hq_attack')) return 'hq_attack';
  if (events.has('promotion')) return 'promotion';
  if (events.has('capture')) return 'capture';
  if (events.has('evaluation_swing')) return 'evaluation_swing';
  if (periodic) return 'periodic';
  return null;
}

export function useExpoAdvisor(state: ExpoAdvisorState) {
  const evaluation = useMemo(() => scoreLabel(state.board, state.hands), [state.board, state.hands]);
  const [latestAdvice, setLatestAdvice] = useState<OpenAiAdvice | null>(null);
  const [transmission, setTransmission] = useState<OpenAiAdvice | null>(null);
  const [source, setSource] = useState<AdvisorSource>('idle');
  const [unread, setUnread] = useState(false);

  const previousBoardRef = useRef(state.board);
  const previousHandsRef = useRef(state.hands);
  const previousCheckRef = useRef(state.checkPlayer);
  const previousScoreRef = useRef(evaluation);
  const previousMoveCountRef = useRef(state.moveCount);
  const pendingEventsRef = useRef<Set<AutoEvent>>(new Set());
  const lastAdviceMoveRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const transmissionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalysis = useCallback((trigger: AdvisorTrigger, automatic = false) => {
    if (state.cpuThinking || state.winner) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    lastAdviceMoveRef.current = state.moveCount;
    setSource('loading');

    void requestOpenAiAdvice({
      board: state.board,
      hands: state.hands,
      currentPlayer: 'black',
      checkPlayer: state.checkPlayer,
      lastMovePlayer: state.lastMovePlayer,
      language: 'ja',
      trigger,
    }, controller.signal).then(advice => {
      if (controller.signal.aborted) return;
      setLatestAdvice(advice);
      setSource('openai');
      if (automatic) {
        setTransmission(advice);
        setUnread(true);
        if (transmissionTimerRef.current) clearTimeout(transmissionTimerRef.current);
        transmissionTimerRef.current = setTimeout(() => setTransmission(null), 4800);
      }
    }).catch(() => {
      if (controller.signal.aborted) return;
      setSource('error');
    });
  }, [state.board, state.checkPlayer, state.cpuThinking, state.hands, state.lastMovePlayer, state.moveCount, state.winner]);

  useEffect(() => {
    const previousMoveCount = previousMoveCountRef.current;
    const reset = state.moveCount < previousMoveCount || (state.moveCount === 0 && previousMoveCount !== 0);
    if (reset) {
      controllerRef.current?.abort();
      pendingEventsRef.current.clear();
      lastAdviceMoveRef.current = 0;
      setLatestAdvice(null);
      setTransmission(null);
      setUnread(false);
      setSource('idle');
      previousBoardRef.current = state.board;
      previousHandsRef.current = state.hands;
      previousCheckRef.current = state.checkPlayer;
      previousScoreRef.current = evaluation;
      previousMoveCountRef.current = state.moveCount;
      return;
    }

    if (state.moveCount !== previousMoveCount) {
      const previousHands = previousHandsRef.current;
      if (state.hands.black.length > previousHands.black.length || state.hands.white.length > previousHands.white.length) pendingEventsRef.current.add('capture');
      if (promotedCount(state.board) > promotedCount(previousBoardRef.current)) pendingEventsRef.current.add('promotion');
      if (state.checkPlayer && state.checkPlayer !== previousCheckRef.current) pendingEventsRef.current.add('hq_attack');
      if (shifted(previousScoreRef.current, evaluation)) pendingEventsRef.current.add('evaluation_swing');

      previousBoardRef.current = state.board;
      previousHandsRef.current = state.hands;
      previousCheckRef.current = state.checkPlayer;
      previousScoreRef.current = evaluation;
      previousMoveCountRef.current = state.moveCount;
    }

    if (state.cpuThinking || state.winner || state.moveCount === 0) return;
    const periodic = state.moveCount - lastAdviceMoveRef.current >= AUTO_INTERVAL_MOVES;
    const trigger = chooseTrigger(pendingEventsRef.current, periodic);
    if (!trigger) return;
    pendingEventsRef.current.clear();
    const timer = setTimeout(() => runAnalysis(trigger, true), 240);
    return () => clearTimeout(timer);
  }, [evaluation, runAnalysis, state.board, state.checkPlayer, state.cpuThinking, state.hands, state.moveCount, state.winner]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    if (transmissionTimerRef.current) clearTimeout(transmissionTimerRef.current);
  }, []);

  return {
    evaluation,
    latestAdvice,
    transmission,
    source,
    unread,
    analyze: () => runAnalysis('manual', false),
    markRead: () => setUnread(false),
    dismissTransmission: () => setTransmission(null),
  };
}
