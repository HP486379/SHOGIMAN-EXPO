import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { getShogimanHtml } from './src/shogimanHtml';

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#030507" />
      <WebView
        originWhitelist={['*']}
        source={{ html: getShogimanHtml(), baseUrl: 'https://shogiman.local/' }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030507' },
  webview: { flex: 1, backgroundColor: '#030507' },
});
