// app/folder/_layout.tsx
import { Stack } from 'expo-router';

export default function FolderStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,   // <── disables the native header
      }}
    />
  );
}
