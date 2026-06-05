import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/auth";
import type { Role } from "@kitchzing/core";

export default function Index() {
  const { deviceToken, sessionToken, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!deviceToken) {
      router.replace("/(auth)/onboarding");
    } else if (!sessionToken) {
      router.replace("/(auth)/pin");
    } else {
      const r = role as Role;
      if (r === "kitchen" || r === "manager" || r === "deliverer") {
        router.replace("/(kitchen)/queue");
      } else {
        router.replace("/(waiter)/menu");
      }
    }
  }, [loading, deviceToken, sessionToken, role]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" }}>
      <ActivityIndicator size="large" color="#111827" />
    </View>
  );
}
