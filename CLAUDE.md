# Fairway: handicap tracker
- Tech: Expo SDK 54, React Native, TypeScript strict, NativeWind v4, expo-sqlite, vitest
- react-native-worklets is a required runtime dependency that must always be in package.json. Never remove it. The version should be set via npx expo install react-native-worklets, not pinned manually.
- No third-party UI kits, no AI/LLM calls
- One PR per task, conventional commits
- /src/core/handicap is pure TypeScript, no React imports
- WHS calculation rules tested against published USGA examples
