import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { getInjectedAdviceBridgeScript } from './src/injectedAdviceBridge';
import { getInjectedNativeEventsScript } from './src/injectedNativeEvents';
import { getShogimanHtml } from './src/shogimanHtml';

const NativeWebView = WebView as unknown as React.ComponentClass<any>;
const BGM_SOURCE = require('./assets/audio/frontline_command_v4_heroic.m4a');

interface AdviceBridgeRequest {
  type: 'shogiman-advice-request';
  id: string;
  method?: string;
  body?: string | null;
}

interface AdviceBridgeResponse {
  id: string;
  ok?: boolean;
  status?: number;
  body?: string;
  error?: string;
}

interface NativeGameEvent {
  type: 'shogiman-native-event';
  event: 'capture';
}

interface WebViewHandle {
  injectJavaScript(script: string): void;
}

interface WebViewMessageLike {
  nativeEvent: { data: string };
}

function parseJsonRecord(data: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object') return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseAdviceBridgeRequest(data: string): AdviceBridgeRequest | null {
  const record = parseJsonRecord(data);
  if (!record) return null;
  if (record.type !== 'shogiman-advice-request' || typeof record.id !== 'string') return null;
  return {
    type: 'shogiman-advice-request',
    id: record.id,
    method: typeof record.method === 'string' ? record.method : 'POST',
    body: typeof record.body === 'string' ? record.body : null,
  };
}

function parseNativeGameEvent(data: string): NativeGameEvent | null {
  const record = parseJsonRecord(data);
  if (!record) return null;
  if (record.type !== 'shogiman-native-event' || record.event !== 'capture') return null;
  return { type: 'shogiman-native-event', event: 'capture' };
}

function serializeForInjectedJavaScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const webViewRef = useRef<WebViewHandle | null>(null);
  const adviceApiUrl = process.env.EXPO_PUBLIC_ADVICE_API_URL;
  const bgmPlayer = useAudioPlayer(BGM_SOURCE, { downloadFirst: true });

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    });

    bgmPlayer.loop = true;
    bgmPlayer.volume = 0.42;
  }, [bgmPlayer]);

  function startGame() {
    bgmPlayer.play();
    setHasStarted(true);
  }

  function sendAdviceBridgeResponse(payload: AdviceBridgeResponse) {
    const serialized = serializeForInjectedJavaScript(payload);
    webViewRef.current?.injectJavaScript(
      `window.__shogimanResolveAdvice && window.__shogimanResolveAdvice(${serialized}); true;`,
    );
  }

  async function handleWebViewMessage(data: string) {
    const nativeEvent = parseNativeGameEvent(data);
    if (nativeEvent?.event === 'capture') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    const request = parseAdviceBridgeRequest(data);
    if (!request) return;

    if (!adviceApiUrl || !adviceApiUrl.startsWith('https://')) {
      sendAdviceBridgeResponse({
        id: request.id,
        error: 'EXPO_PUBLIC_ADVICE_API_URL is not configured',
      });
      return;
    }

    try {
      const response = await fetch(adviceApiUrl, {
        method: request.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: request.body ?? undefined,
      });
      const body = await response.text();
      sendAdviceBridgeResponse({
        id: request.id,
        ok: response.ok,
        status: response.status,
        body,
      });
    } catch (error) {
      sendAdviceBridgeResponse({
        id: request.id,
        error: error instanceof Error ? error.message : 'AI advisor request failed',
      });
    }
  }

  if (!hasStarted) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#030507" />
        <View style={styles.titleScreen}>
          <View style={styles.titlePanel}>
            <Text style={styles.title}>★ SHOGI FRONTLINE ★</Text>
            <Text style={styles.subtitle}>将棋戦線</Text>
            <Text style={styles.tagline}>TACTICAL SHOGI BATTLE</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="ゲーム開始"
              onPress={startGame}
              style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
            >
              <Text style={styles.startButtonText}>START</Text>
            </Pressable>
            <Text style={styles.help}>TAP START TO DEPLOY</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#030507" />
      <NativeWebView
        ref={webViewRef as any}
        originWhitelist={['*']}
        source={{ html: getShogimanHtml(), baseUrl: 'https://shogiman.local/' }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        injectedJavaScriptBeforeContentLoaded={getInjectedAdviceBridgeScript()}
        injectedJavaScript={getInjectedNativeEventsScript()}
        onMessage={(event: WebViewMessageLike) => { void handleWebViewMessage(event.nativeEvent.data); }}
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        style={styles.webview}
        containerStyle={styles.webviewContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#030507',
  },
  titleScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#030507',
  },
  titlePanel: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 34,
    borderWidth: 2,
    borderColor: '#62ff78',
    backgroundColor: '#07100a',
  },
  title: {
    color: '#62ff78',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: '#f4f7f5',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: 5,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 18,
    color: '#8aa291',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.2,
    textAlign: 'center',
  },
  startButton: {
    minWidth: 190,
    marginTop: 34,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#62ff78',
    backgroundColor: '#0b1f10',
  },
  startButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  startButtonText: {
    color: '#62ff78',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  help: {
    marginTop: 18,
    color: '#627168',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#030507',
  },
  webview: {
    flex: 1,
    backgroundColor: '#030507',
  },
});
