import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";
import type { RestaurantConfig, PauseState } from "../../src/lib/types";

export default function ManagerDashboard() {
  const { sessionToken, staffName, restaurantName, clearSession } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<RestaurantConfig | null>(null);
  const [pause, setPause] = useState<PauseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pauseLoading, setPauseLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await api.getConfig(sessionToken);
      setConfig(res.config);
      setPause(res.pause);
    } catch {
      // non-fatal — dashboard still usable without config
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  async function togglePause() {
    if (!sessionToken || !pause) return;
    if (pause.paused) {
      setPauseLoading(true);
      try {
        await api.resumeKitchen(sessionToken);
        setPause((p) => p ? { ...p, paused: false, reason: null, resume_at: null } : p);
      } catch (e) {
        Alert.alert("Error", e instanceof ApiError ? e.message : "Could not resume kitchen");
      } finally {
        setPauseLoading(false);
      }
    } else {
      Alert.alert(
        "Pause kitchen",
        "Stop accepting new orders?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Pause",
            style: "destructive",
            onPress: async () => {
              setPauseLoading(true);
              try {
                await api.pauseKitchen({ reason: "other" }, sessionToken);
                setPause((p) => p ? { ...p, paused: true, reason: "other" } : p);
              } catch (e) {
                Alert.alert("Error", e instanceof ApiError ? e.message : "Could not pause kitchen");
              } finally {
                setPauseLoading(false);
              }
            },
          },
        ]
      );
    }
  }

  function signOut() {
    Alert.alert("Sign out", "This will return to the PIN screen.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => { clearSession(); router.replace("/(auth)/pin"); } },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <View>
            <Text style={s.restaurantName}>{restaurantName ?? "KitchZing"}</Text>
            <Text style={s.staffName}>Manager · {staffName ?? ""}</Text>
          </View>
          <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
            <Text style={s.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Kitchen status card */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Kitchen</Text>
          <View style={[s.card, pause?.paused && s.cardWarning]}>
            {loading ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <>
                <View style={s.cardRow}>
                  <View style={[s.statusDot, { backgroundColor: pause?.paused ? "#ef4444" : "#22c55e" }]} />
                  <Text style={s.cardTitle}>{pause?.paused ? "Orders paused" : "Accepting orders"}</Text>
                </View>
                {pause?.paused && pause.reason_text && (
                  <Text style={s.cardSub}>{pause.reason_text}</Text>
                )}
                {pause?.paused && pause.resume_at && (
                  <Text style={s.cardSub}>
                    Auto-resumes at {new Date(pause.resume_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                )}
                <TouchableOpacity
                  style={[s.actionBtn, pause?.paused ? s.actionBtnGreen : s.actionBtnRed]}
                  onPress={togglePause}
                  disabled={pauseLoading}
                >
                  {pauseLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.actionBtnText}>{pause?.paused ? "Resume kitchen" : "Pause kitchen"}</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity style={s.card} onPress={() => router.push("/(kitchen)/queue")}>
            <Text style={s.cardTitle}>View kitchen queue</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Staff section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Staff</Text>
          <TouchableOpacity style={s.card} onPress={() => router.push("/(manager)/add-staff")}>
            <Text style={s.cardTitle}>Add staff member</Text>
            <Text style={s.cardSub}>Generate a QR code or share a code</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Config section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Opening hours</Text>
          <View style={s.card}>
            {loading || !config ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={s.cardTitle}>{config.open_time} – {config.close_time}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  restaurantName: { fontSize: 24, fontWeight: "800", color: "#111827" },
  staffName: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  signOutBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#f3f4f6" },
  signOutText: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardWarning: { backgroundColor: "#fef2f2" },
  cardRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: "#111827" },
  cardSub: { width: "100%", fontSize: 13, color: "#6b7280", marginTop: 4 },
  chevron: { fontSize: 22, color: "#9ca3af" },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  actionBtn: { marginTop: 14, width: "100%", borderRadius: 10, padding: 12, alignItems: "center" },
  actionBtnRed: { backgroundColor: "#ef4444" },
  actionBtnGreen: { backgroundColor: "#22c55e" },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
