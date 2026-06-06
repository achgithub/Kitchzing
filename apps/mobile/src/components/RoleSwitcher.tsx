import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/auth";
import { api, ApiError } from "../lib/api";
import type { Role } from "@kitchzing/core";

const ROLES: { key: Role; label: string }[] = [
  { key: "waiter",    label: "Waiter" },
  { key: "kitchen",   label: "Kitchen" },
  { key: "deliverer", label: "Deliverer" },
  { key: "manager",   label: "Manager" },
];

const ROLE_LABELS: Record<string, string> = {
  waiter: "Waiter", kitchen: "Kitchen", deliverer: "Deliverer", manager: "Manager",
};

function destinationFor(role: Role): string {
  if (role === "manager") return "/(manager)/";
  if (role === "kitchen" || role === "deliverer") return "/(kitchen)/queue";
  return "/(waiter)/menu";
}

interface Props {
  /** Whether the parent screen has a dark background (kitchen uses dark theme) */
  dark?: boolean;
}

export function RoleSwitcher({ dark = false }: Props) {
  const { sessionToken, role, setSession, staffName } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [switching, setSwitching] = useState<Role | null>(null);

  async function switchTo(next: Role) {
    if (!sessionToken || next === role) { setVisible(false); return; }
    setSwitching(next);
    try {
      const res = await api.switchRole(next, sessionToken);
      setSession(res.session_token, staffName ?? "", res.role as Role);
      setVisible(false);
      router.replace(destinationFor(res.role as Role));
    } catch (e) {
      Alert.alert("Can't switch", e instanceof ApiError ? e.message : "Could not switch role");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <>
      <TouchableOpacity style={[s.pill, dark && s.pillDark]} onPress={() => setVisible(true)}>
        <Text style={[s.pillText, dark && s.pillTextDark]}>{ROLE_LABELS[role ?? ""] ?? role}</Text>
        <Text style={[s.pillChevron, dark && s.pillTextDark]}>⌄</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Switch role</Text>
            {ROLES.map((r) => {
              const isCurrent = r.key === role;
              const isLoading = switching === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[s.roleRow, isCurrent && s.roleRowActive]}
                  onPress={() => switchTo(r.key)}
                  disabled={isCurrent || switching !== null}
                >
                  <Text style={[s.roleLabel, isCurrent && s.roleLabelActive]}>{r.label}</Text>
                  {isCurrent && <Text style={s.currentBadge}>Current</Text>}
                  {isLoading && <ActivityIndicator size="small" color="#6b7280" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f3f4f6", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  pillDark: { backgroundColor: "#374151" },
  pillText: { fontSize: 13, fontWeight: "700", color: "#374151" },
  pillTextDark: { color: "#d1d5db" },
  pillChevron: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  sheet: { backgroundColor: "#fff", borderRadius: 20, width: 280, overflow: "hidden" },
  sheetTitle: { fontSize: 13, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, padding: 16, paddingBottom: 8 },
  roleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  roleRowActive: { backgroundColor: "#f9fafb" },
  roleLabel: { flex: 1, fontSize: 17, color: "#111827", fontWeight: "500" },
  roleLabelActive: { fontWeight: "700" },
  currentBadge: { fontSize: 12, color: "#6b7280", backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
});
