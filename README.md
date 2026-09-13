# SHOGIMAN-EXPO

Expo / React Native iOS implementation of SHOGI FRONTLINE.

## Current migration status

- Expo SDK 57 / React Native 0.86
- EAS build configuration
- portrait-only iPhone layout
- MILITARY / SHOGI modes
- EASY / NORMAL / HARD CPU
- captures, hands, drops, promotion, check/checkmate
- original military unit artwork
- original UNIT GUIDE panel and 1-second mini guide
- capture flash / shake / vibration feedback
- GUIDE / SETTINGS bottom sheets

## AI advisor

The Expo app must call a public backend endpoint. Keep `OPENAI_API_KEY` on the server only. Configure the mobile app with `EXPO_PUBLIC_ADVICE_API_URL`; see `.env.example`.

## Next

- port AI TACTIC ADVISOR client/transmission UI
- bind Expo project with `eas init`
- configure credentials and TestFlight build
