import React from 'react';
import { View } from 'react-native';
import { getShogimanHtml } from './src/shogimanHtml';

export default function App() {
  return (
    <View style={{ flex: 1, width: '100%', backgroundColor: '#030507' }}>
      {React.createElement('iframe' as any, {
        srcDoc: getShogimanHtml(),
        title: 'SHOGIMAN-IOS',
        style: {
          width: '100%',
          height: '100vh',
          border: 0,
          display: 'block',
          background: '#030507',
        },
      })}
    </View>
  );
}
