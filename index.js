const React = require('react');

// Web preview must emulate the iPhone-width shell used by SHOGIMAN-IOS.
// Do this before React Native / Expo initialize their Dimensions module.
if (typeof window !== 'undefined' && window.innerWidth > 480) {
  Object.defineProperty(window, 'innerWidth', {
    value: 480,
    configurable: true,
  });
}

const { registerRootComponent } = require('expo');
const { View } = require('react-native');
const App = require('./App').default;

function Root() {
  return React.createElement(
    View,
    {
      style: {
        flex: 1,
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
        backgroundColor: '#030507',
      },
    },
    React.createElement(App),
  );
}

registerRootComponent(Root);
