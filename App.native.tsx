import React, { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getInjectedAudioScript } from './src/injectedAudio';
import { getShogimanHtml } from './src/shogimanHtml';

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);

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
              onPress={() => setHasStarted(true)}
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
      <WebView
        originWhitelist={['*']}
        source={{ html: getShogimanHtml(), baseUrl: 'https://shogiman.local/' }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        injectedJavaScript={getInjectedAudioScript()}
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
