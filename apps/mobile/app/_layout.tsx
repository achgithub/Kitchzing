import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../src/context/auth";

function RootNavigator() {
  const { deviceToken, sessionToken, role, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === "(auth)";
    const inWaiter = segments[0] === "(waiter)";
    const inKitchen = segments[0] === "(kitchen)";

    if (!deviceToken) {
      // No device registered — go to onboarding
      if (!inAuth) router.replace("/(auth)/onboarding");
    } else if (!sessionToken) {
      // Device registered but no session — go to PIN
      if (!inAuth) router.replace("/(auth)/pin");
    } else {
      // Logged in — route by role
      if (role === "kitchen" || role === "manager") {
        if (!inKitchen) router.replace("/(kitchen)/queue");
      } else if (role === "waiter") {
        if (!inWaiter) router.replace("/(waiter)/menu");
      }
    }
  }, [deviceToken, sessionToken, role, loading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(waiter)" />
      <Stack.Screen name="(kitchen)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
