import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl, Alert, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";
import { POLL_INTERVAL_MS } from "../../src/lib/config";
import { isWithinHours } from "../../src/lib/hours";
import { RoleSwitcher } from "../../src/components/RoleSwitcher";
import type { Order, OrderItem } from "@kitchzing/core";
import type { RestaurantConfig, PauseState } from "../../src/lib/types";

const STATE_SEQUENCE = ["new", "preparing", "ready", "delivered"];

function nextState(current: string): string | null {
  const idx = STATE_SEQUENCE.indexOf(current);
  if (idx === -1 || idx >= STATE_SEQUENCE.length - 1) return null;
  return STATE_SEQUENCE[idx + 1] ?? null;
}

function stateColour(state: string): string {
  switch (state) {
    case "new": return "#e5e7eb";
    case "preparing": return "#fef3c7";
    case "ready": return "#d1fae5";
    case "delivered": return "#f3f4f6";
    default: return "#e5e7eb";
  }
}

const PAUSE_REASONS = [
  { key: "too_busy", label: "Too busy" },
  { key: "closed_early", label: "Closing early" },
  { key: "other", label: "Other" },
] as const;

const RESUME_OPTIONS = [
  { label: "Manual", minutes: undefined },
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "60 min", minutes: 60 },
] as const;

export default function KitchenQueue() {
  const { sessionToken, deviceToken, staffName, role, clearSession } = useAuth();
  const router = useRouter();
  const token = sessionToken ?? deviceToken ?? "";

  function signOut() { clearSession(); router.replace("/(auth)/pin"); }
  const [orders, setOrders] = useState<Order[]>([]);
  const [pause, setPause] = useState<PauseState | null>(null);
  const [config, setConfig] = useState<RestaurantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState<string>("too_busy");
  const [resumeMinutes, setResumeMinutes] = useState<number | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRef = useRef<RestaurantConfig | null>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ordersRes, configRes] = await Promise.all([
        api.getActiveOrders(token),
        api.getConfig(token),
      ]);
      setOrders(ordersRes.orders);
      setPause(configRes.pause);
      setConfig(configRes.config);
      configRef.current = configRes.config;
    } catch {
      // Silent fail on poll
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
    intervalRef.current = setInterval(() => {
      if (configRef.current && !isWithinHours(configRef.current)) return;
      fetchOrders(true);
    }, POLL_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchOrders]);

  async function advance(item: OrderItem) {
    const next = nextState(item.state);
    if (!next || !sessionToken) return;
    try {
      await api.advanceItemState(item.id, next, sessionToken);
      setOrders((prev) =>
        prev.map((o) => ({ ...o, items: o.items.map((i) => i.id === item.id ? { ...i, state: next } : i) }))
      );
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not update item");
    }
  }

  async function submitPause() {
    if (!sessionToken) return;
    try {
      const res = await api.pauseKitchen({ reason: pauseReason, resume_in_minutes: resumeMinutes }, sessionToken);
      setShowPauseModal(false);
      setPause(res as unknown as PauseState);
      fetchOrders(true);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not pause");
    }
  }

  async function resume() {
    if (!sessionToken) return;
    try {
      await api.resumeKitchen(sessionToken);
      setPause((p) => p ? { ...p, paused: false } : p);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not resume");
    }
  }

  const canPause = role === "kitchen" || role === "manager";
  const activeOrders = orders.filter((o) => o.items.some((i) => i.state !== "delivered"));
  const isOpen = config ? isWithinHours(config) : true;

  return (
    <SafeAreaView style={s.safe}>
      {/* Closed banner */}
      {!isOpen && config && (
        <View style={s.closedBanner}>
          <Text style={s.closedBannerText}>Kitchen closed · Opens {config.open_time}</Text>
        </View>
      )}

      {/* Pause banner */}
      {pause?.paused && (
        <View style={s.pauseBanner}>
          <View style={s.pauseBannerText}>
            <Text style={s.pauseBannerTitle}>Kitchen paused</Text>
            <Text style={s.pauseBannerSub}>{pause.reason_text ?? pause.reason}</Text>
          </View>
          {canPause && (
            <TouchableOpacity style={s.resumeBtn} onPress={resume}>
              <Text style={s.resumeBtnText}>Resume</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={s.header}>
        <View>
          <Text style={s.title}>Kitchen</Text>
          <Text style={s.sub}>{activeOrders.length} active order{activeOrders.length !== 1 ? "s" : ""}</Text>
        </View>
        <View style={s.headerActions}>
          {canPause && !pause?.paused && (
            <TouchableOpacity style={s.pauseBtn} onPress={() => setShowPauseModal(true)}>
              <Text style={s.pauseBtnText}>Pause</Text>
            </TouchableOpacity>
          )}
          <RoleSwitcher dark />
          <TouchableOpacity onPress={signOut}>
            <Text style={s.signOut}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#6b7280" onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
      >
        {activeOrders.length === 0 && !loading && (
          <View style={s.empty}>
            <Text style={s.emptyText}>No active orders</Text>
            <Text style={s.emptySub}>Pull to refresh</Text>
          </View>
        )}

        {activeOrders.map((order) => {
          const hasAllergyNote = order.items.some((i) => i.allergy_note);
          return (
            <View key={order.id} style={[s.card, hasAllergyNote && s.cardAllergy]}>
              {hasAllergyNote && (
                <View style={s.allergyBar}>
                  <Text style={s.allergyBarText}>⚠ ALLERGY ORDER</Text>
                  {order.items.filter((i) => i.allergy_note).map((i) => (
                    <Text key={i.id} style={s.allergyNote}>{i.name}: {i.allergy_note}</Text>
                  ))}
                </View>
              )}
              <View style={s.cardHeader}>
                <Text style={s.table}>Table {order.table_ref}</Text>
                <Text style={s.time}>{new Date(order.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
              {order.items.filter((i) => i.state !== "delivered").map((item) => (
                <View key={item.id} style={s.itemRow}>
                  <View style={s.itemLeft}>
                    <Text style={s.itemName}>{item.quantity}× {item.name}</Text>
                    {item.notes ? <Text style={s.itemNotes}>{item.notes}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={[s.statePill, { backgroundColor: stateColour(item.state) }]}
                    onPress={() => advance(item)}
                    disabled={!sessionToken}
                  >
                    <Text style={s.stateText}>{item.state}</Text>
                    {nextState(item.state) && <Text style={s.stateArrow}> →</Text>}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* Pause modal */}
      <Modal visible={showPauseModal} transparent animationType="slide" onRequestClose={() => setShowPauseModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Pause kitchen</Text>

            <Text style={s.modalLabel}>Reason</Text>
            <View style={s.optionRow}>
              {PAUSE_REASONS.map((r) => (
                <TouchableOpacity key={r.key} style={[s.optionPill, pauseReason === r.key && s.optionPillActive]} onPress={() => setPauseReason(r.key)}>
                  <Text style={[s.optionPillText, pauseReason === r.key && s.optionPillTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.modalLabel}>Auto-resume</Text>
            <View style={s.optionRow}>
              {RESUME_OPTIONS.map((r) => (
                <TouchableOpacity key={r.label} style={[s.optionPill, resumeMinutes === r.minutes && s.optionPillActive]} onPress={() => setResumeMinutes(r.minutes)}>
                  <Text style={[s.optionPillText, resumeMinutes === r.minutes && s.optionPillTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.pauseSubmitBtn} onPress={submitPause}>
              <Text style={s.pauseSubmitText}>Pause kitchen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPauseModal(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#111827" },
  closedBanner: { backgroundColor: "#1e3a5f", padding: 12, paddingHorizontal: 20 },
  closedBannerText: { color: "#93c5fd", fontWeight: "700", fontSize: 13, textAlign: "center" },
  pauseBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#78350f", padding: 14, paddingHorizontal: 20 },
  pauseBannerText: { flex: 1 },
  pauseBannerTitle: { color: "#fbbf24", fontWeight: "800", fontSize: 14 },
  pauseBannerSub: { color: "#fde68a", fontSize: 13, marginTop: 2 },
  resumeBtn: { backgroundColor: "#fbbf24", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  resumeBtnText: { color: "#78350f", fontWeight: "700", fontSize: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff" },
  sub: { fontSize: 14, color: "#9ca3af", marginTop: 2 },
  headerActions: { alignItems: "flex-end", gap: 8 },
  pauseBtn: { backgroundColor: "#374151", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  pauseBtnText: { color: "#f9fafb", fontWeight: "600", fontSize: 14 },
  signOut: { fontSize: 14, color: "#6b7280" },
  list: { flex: 1 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 20, fontWeight: "700", color: "#6b7280" },
  emptySub: { fontSize: 14, color: "#4b5563", marginTop: 8 },
  card: { backgroundColor: "#1f2937", marginHorizontal: 16, marginBottom: 12, borderRadius: 16, overflow: "hidden" },
  cardAllergy: { borderWidth: 2, borderColor: "#f59e0b" },
  allergyBar: { backgroundColor: "#78350f", padding: 12 },
  allergyBarText: { color: "#fbbf24", fontWeight: "800", fontSize: 13, marginBottom: 4 },
  allergyNote: { color: "#fde68a", fontSize: 13 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 },
  table: { fontSize: 18, fontWeight: "800", color: "#fff" },
  time: { fontSize: 13, color: "#9ca3af" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#374151" },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "600", color: "#f9fafb" },
  itemNotes: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  statePill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  stateText: { fontSize: 13, fontWeight: "700", color: "#111827" },
  stateArrow: { fontSize: 13, color: "#374151" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#1f2937", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: "600", color: "#9ca3af", marginBottom: 10, marginTop: 4 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  optionPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#374151" },
  optionPillActive: { backgroundColor: "#f59e0b" },
  optionPillText: { fontSize: 14, fontWeight: "600", color: "#d1d5db" },
  optionPillTextActive: { color: "#111827" },
  pauseSubmitBtn: { backgroundColor: "#f59e0b", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  pauseSubmitText: { color: "#111827", fontSize: 16, fontWeight: "700" },
  cancelBtn: { padding: 14, alignItems: "center" },
  cancelText: { color: "#9ca3af", fontSize: 16 },
});
