import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl, Alert } from "react-native";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";
import { POLL_INTERVAL_MS } from "../../src/lib/config";
import type { Order, OrderItem } from "@kitchzing/core";

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

export default function KitchenQueue() {
  const { sessionToken, deviceToken, staffName, clearSession } = useAuth();
  const token = sessionToken ?? deviceToken ?? "";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getActiveOrders(token);
      setOrders(res.orders);
    } catch {
      // Silent fail on poll — network blip shouldn't clear the screen
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
    intervalRef.current = setInterval(() => fetchOrders(true), POLL_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchOrders]);

  async function advance(item: OrderItem) {
    const next = nextState(item.state);
    if (!next || !sessionToken) return;
    try {
      await api.advanceItemState(item.id, next, sessionToken);
      setOrders((prev) =>
        prev.map((o) => ({
          ...o,
          items: o.items.map((i) => i.id === item.id ? { ...i, state: next } : i),
        }))
      );
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not update item");
    }
  }

  const activeOrders = orders.filter((o) =>
    o.items.some((i) => i.state !== "delivered")
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Kitchen</Text>
          <Text style={s.sub}>{activeOrders.length} active order{activeOrders.length !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity onPress={clearSession}>
          <Text style={s.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
      >
        {activeOrders.length === 0 && !loading && (
          <View style={s.empty}>
            <Text style={s.emptyText}>No active orders</Text>
            <Text style={s.emptySub}>Pull to refresh or wait for the next poll</Text>
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#111827" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff" },
  sub: { fontSize: 14, color: "#9ca3af", marginTop: 2 },
  signOut: { fontSize: 14, color: "#6b7280", marginTop: 4 },
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
});
