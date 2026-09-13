# SHOGIMAN-EXPO parity source

`reference/shogiman-ios` is the frozen source-of-truth implementation for the Expo port.

Pinned source:
- repository: `HP486379/SHOGIMAN-IOS`
- branch at capture: `main`
- commit: `62a70b84a4315fd0315b0440564e6c2945fac397`

## Port rule

Do not redesign from memory. Compare the Expo implementation against the reference implementation and preserve the reference behavior unless a native constraint requires a deliberate change.

Priority parity checklist:

- iPhone-width shell (`max-width: 480px`) and centered web preview
- battle controls: MODE, CPU, TURN, MOVES, SCORE
- order: CPU CAPTURED -> turn banner -> board -> gate meter -> 1P CAPTURED
- military artwork and SHOGI kanji mode
- CPU pieces rotate 180 degrees, including kanji
- original UNIT GUIDE panel artwork
- 1-second mini guide; 1P guide below, CPU guide above
- legal move highlight semantics
- capture explosion / screen feedback
- bottom fixed AI / GUIDE / SET navigation
- AI TACTIC ADVISOR transmission behavior
- GUIDE and SETTINGS bottom sheets

The reference folder is intentionally not application runtime code. Expo-native code lives at repository root / `src`.
