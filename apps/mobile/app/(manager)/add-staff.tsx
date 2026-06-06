import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Share, Alert } from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";

export default function AddStaff() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [restaurantCode, setRestaurantCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(600);

  async function generate() {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await api.generateStaffToken(sessionToken);
      setToken(res.token);
      setRestaurantCode(res.restaurant_code);
      setExpiresAt(Date.now() + res.expires_in * 1000);
      setSecondsLeft(res.expires_in);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not generate token");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { generate(); }, []);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const qrPayload = `kitchzing://join?code=${restaurantCode}&token=${token}`;
  const expired = secondsLeft === 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  async function share() {
    await Share.share({
      message: `Join ${restaurantCode} on KitchZing\nRestaurant code: ${restaurantCode}\nStaff code: ${token}\n\nOpen KitchZing and tap "I have a code"`,
    });
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Add staff</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ flex: 1 }} />
      ) : expired ? (
        <View style={s.center}>
          <Text style={s.expiredText}>Code expired</Text>
          <TouchableOpacity style={s.refreshBtn} onPress={generate}>
            <Text style={s.refreshBtnText}>Generate new code</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.content}>
          <Text style={s.instruction}>Show this QR code to the new staff member</Text>

          <View style={s.qrBox}>
            <QRCode value={qrPayload} size={220} backgroundColor="#fff" />
          </View>

          <View style={s.timer}>
            <Text style={[s.timerText, secondsLeft < 60 && s.timerWarning]}>
              Expires in {mins}:{secs.toString().padStart(2, "0")}
            </Text>
          </View>

          <View style={s.manualBox}>
            <Text style={s.manualLabel}>Or share codes manually</Text>
            <View style={s.codeRow}>
              <View style={s.codeItem}>
                <Text style={s.codeLabel}>Restaurant code</Text>
                <Text style={s.code}>{restaurantCode}</Text>
              </View>
              <View style={s.codeItem}>
                <Text style={s.codeLabel}>Staff code</Text>
                <Text style={s.code}>{token ? `${token.slice(0, 6)} ${token.slice(6)}` : ""}</Text>
              </View>
            </View>
            <TouchableOpacity style={s.shareBtn} onPress={share}>
              <Text style={s.shareBtnText}>Share via Messages / WhatsApp…</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.refreshBtn} onPress={generate}>
            <Text style={s.refreshBtnText}>Generate new code</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  back: { fontSize: 18, color: "#6b7280" },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  instruction: { fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 24 },
  qrBox: { backgroundColor: "#fff", padding: 20, borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  timer: { marginTop: 16, marginBottom: 20 },
  timerText: { fontSize: 15, color: "#6b7280", fontWeight: "600" },
  timerWarning: { color: "#ef4444" },
  manualBox: { width: "100%", backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16 },
  manualLabel: { fontSize: 13, fontWeight: "600", color: "#9ca3af", marginBottom: 12 },
  codeRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  codeItem: { flex: 1, backgroundColor: "#f9fafb", borderRadius: 10, padding: 12 },
  codeLabel: { fontSize: 11, color: "#9ca3af", marginBottom: 4 },
  code: { fontSize: 18, fontWeight: "800", color: "#111827", letterSpacing: 2 },
  shareBtn: { backgroundColor: "#f3f4f6", borderRadius: 10, padding: 12, alignItems: "center" },
  shareBtnText: { fontSize: 14, color: "#374151", fontWeight: "600" },
  expiredText: { fontSize: 20, fontWeight: "700", color: "#6b7280" },
  refreshBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  refreshBtnText: { fontSize: 15, color: "#6b7280", fontWeight: "600" },
});
