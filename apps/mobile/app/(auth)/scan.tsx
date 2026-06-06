import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";

export default function ScanScreen() {
  const { setDevice } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleScan({ data }: { data: string }) {
    if (scanned || loading) return;
    setScanned(true);

    // Expected format: kitchzing://join?code=XXXX&token=YYYYYY
    try {
      const url = new URL(data);
      const code = url.searchParams.get("code");
      const token = url.searchParams.get("token");

      if (!code || !token) throw new Error("Invalid QR code");

      setLoading(true);
      const res = await api.register({
        restaurant_code: code,
        device_name: "Mobile Device",
        one_time_token: token,
      });
      setDevice(res.device_token, res.restaurant_name);
      router.replace("/(auth)/pin");
    } catch (e) {
      Alert.alert(
        "Invalid QR code",
        e instanceof ApiError ? e.message : "This QR code is not valid or has expired",
        [{ text: "Try again", onPress: () => setScanned(false) }]
      );
    } finally {
      setLoading(false);
    }
  }

  if (!permission) return <View style={s.container} />;

  if (!permission.granted) {
    return (
      <View style={s.container}>
        <Text style={s.permText}>Camera permission is needed to scan QR codes</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>Allow camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>Enter code manually instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />

      {/* Overlay */}
      <View style={s.overlay}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.overlayTitle}>Scan QR code</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={s.viewfinder}>
          <View style={[s.corner, s.cornerTL]} />
          <View style={[s.corner, s.cornerTR]} />
          <View style={[s.corner, s.cornerBL]} />
          <View style={[s.corner, s.cornerBR]} />
          {loading && <ActivityIndicator size="large" color="#fff" />}
        </View>

        <Text style={s.hint}>Point your camera at the QR code shown by your manager</Text>

        <TouchableOpacity style={s.manualBtn} onPress={() => router.replace("/(auth)/onboarding")}>
          <Text style={s.manualBtnText}>Enter code manually instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const CORNER = 28;
const BORDER = 4;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  permText: { color: "#fff", fontSize: 16, textAlign: "center", marginHorizontal: 40, marginBottom: 20 },
  permBtn: { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: "#111827", fontWeight: "700", fontSize: 16 },
  backBtn: { marginTop: 16 },
  backText: { color: "#9ca3af", fontSize: 15 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingBottom: 48 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 20, paddingTop: 60 },
  cancel: { color: "#fff", fontSize: 17, width: 60 },
  overlayTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  viewfinder: { width: 260, height: 260, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: "#fff" },
  cornerTL: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  cornerTR: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },
  hint: { color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center", marginHorizontal: 40 },
  manualBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  manualBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
