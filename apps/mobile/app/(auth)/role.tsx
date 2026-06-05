import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";
import type { Role } from "@kitchzing/core";

const ROLES: { role: Role; label: string; description: string; emoji: string }[] = [
  { role: "waiter", label: "Waiter", description: "Take orders at the table", emoji: "🛎" },
  { role: "kitchen", label: "Kitchen", description: "Manage the order queue", emoji: "👨‍🍳" },
  { role: "deliverer", label: "Deliverer", description: "Deliver ready orders", emoji: "🏃" },
  { role: "manager", label: "Manager", description: "Full access to everything", emoji: "👔" },
];

export default function RoleSelector() {
  const { setSession, sessionToken, staffName } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<Role | null>(null);

  async function pick(role: Role) {
    if (!sessionToken || !staffName) return;
    setLoading(role);
    try {
      const res = await api.switchRole(role, sessionToken);
      setSession(res.session_token, staffName, role);
      if (role === "kitchen" || role === "manager") {
        router.replace("/(kitchen)/queue");
      } else if (role === "waiter") {
        router.replace("/(waiter)/menu");
      } else {
        router.replace("/(kitchen)/queue");
      }
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not switch role");
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.greeting}>Hi, {staffName}</Text>
      <Text style={s.title}>What's your role today?</Text>
      <View style={s.list}>
        {ROLES.map((r) => (
          <TouchableOpacity key={r.role} style={s.card} onPress={() => pick(r.role)}>
            <Text style={s.emoji}>{r.emoji}</Text>
            <View style={s.cardText}>
              <Text style={s.roleLabel}>{r.label}</Text>
              <Text style={s.roleDesc}>{r.description}</Text>
            </View>
            {loading === r.role ? <ActivityIndicator size="small" /> : <Text style={s.chevron}>›</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 24, justifyContent: "center" },
  greeting: { fontSize: 16, color: "#6b7280", marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827", marginBottom: 32 },
  list: { gap: 12 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 18, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  emoji: { fontSize: 28, marginRight: 16 },
  cardText: { flex: 1 },
  roleLabel: { fontSize: 17, fontWeight: "700", color: "#111827" },
  roleDesc: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  chevron: { fontSize: 24, color: "#d1d5db" },
});
