import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getShogimanHtml } from './src/shogimanHtml';

export default function App() {
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
  root: { flex: 1, backgroundColor: '#030507' },
  webviewContainer: { flex: 1, backgroundColor: '#030507' },
  webview: { flex: 1, backgroundColor: '#030507' },
});
