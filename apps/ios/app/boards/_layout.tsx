import { Stack } from 'expo-router';

export default function BoardsStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* "새 여행" slides up as a Mozi-style modal sheet over the tabs. */}
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
