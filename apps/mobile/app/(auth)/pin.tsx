import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";
import type { Role } from "@kitchzing/core";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export default function PinScreen() {
  const { deviceToken, restaurantName, setSession } = useAuth();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  function press(d: string) {
    if (d === "⌫") { setPin((p) => p.slice(0, -1)); return; }
    if (d === "") return;
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) submit(next);
  }

  async function submit(code: string) {
    if (!deviceToken) return;
    setLoading(true);
    try {
      const res = await api.login({ pin: code }, deviceToken);
      // Session token contains default_role — role selector will re-issue with chosen role
      setSession(res.session_token, res.name, res.role as Role);
      router.replace("/(auth)/role");
    } catch (e) {
      setPin("");
      Alert.alert("Incorrect PIN", e instanceof ApiError ? e.message : "Please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.restaurant}>{restaurantName}</Text>
      <Text style={s.title}>Enter your PIN</Text>

      <View style={s.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.dot, pin.length > i && s.dotFilled]} />
        ))}
      </View>

      <View style={s.grid}>
        {DIGITS.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[s.key, d === "" && s.keyEmpty]}
            onPress={() => press(d)}
            disabled={loading || d === ""}
          >
            <Text style={[s.keyText, d === "⌫" && s.keyBackspace]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center", padding: 24 },
  restaurant: { fontSize: 14, color: "#6b7280", marginBottom: 4 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 40 },
  dots: { flexDirection: "row", gap: 16, marginBottom: 48 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#d1d5db", backgroundColor: "transparent" },
  dotFilled: { backgroundColor: "#111827", borderColor: "#111827" },
  grid: { flexDirection: "row", flexWrap: "wrap", width: 264, gap: 12 },
  key: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  keyEmpty: { backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  keyText: { fontSize: 24, fontWeight: "600", color: "#111827" },
  keyBackspace: { fontSize: 20 },
});
