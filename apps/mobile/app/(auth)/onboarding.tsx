import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";

export default function Onboarding() {
  const { setDevice } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function register() {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    setLoading(true);
    try {
      const res = await api.register({ restaurant_code: cleaned, device_name: "Mobile Device" });
      setDevice(res.device_token, res.restaurant_name);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not register device");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.logo}>KitchZing</Text>
      <Text style={s.subtitle}>Kitchen order management</Text>

      <View style={s.card}>
        <Text style={s.label}>Restaurant code</Text>
        <TextInput
          style={s.input}
          value={code}
          onChangeText={setCode}
          placeholder="e.g. PIZZA-4821"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity style={s.button} onPress={register} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Connect</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { fontSize: 36, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 16, color: "#6b7280", marginTop: 4, marginBottom: 40 },
  card: { width: "100%", backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 14, fontSize: 18, letterSpacing: 2, marginBottom: 16, textAlign: "center" },
  button: { backgroundColor: "#111827", borderRadius: 10, padding: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
