import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";
import { POLL_INTERVAL_MS } from "../../src/lib/config";
import { RoleSwitcher } from "../../src/components/RoleSwitcher";
import type { Order, OrderItem } from "@kitchzing/core";

export default function DeliverScreen() {
  const { sessionToken, clearSession } = useAuth();
  const router = useRouter();
  const token = sessionToken ?? "";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [delivering, setDelivering] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function signOut() { clearSession(); router.replace("/(auth)/pin"); }

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getActiveOrders(token);
      setOrders(res.orders);
    } catch {
      // silent fail on poll
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

  async function markDelivered(item: OrderItem) {
    if (!sessionToken) return;
    setDelivering((prev) => new Set(prev).add(item.id));
    try {
      await api.advanceItemState(item.id, "delivered", sessionToken);
      setOrders((prev) =>
        prev
          .map((o) => ({ ...o, items: o.items.map((i) => i.id === item.id ? { ...i, state: "delivered" } : i) }))
          .filter((o) => o.items.some((i) => i.state === "ready"))
      );
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not mark as delivered");
    } finally {
      setDelivering((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  }

  // Only show orders that still have ready items
  const readyOrders = orders
    .map((o) => ({ ...o, items: o.items.filter((i) => i.state === "ready") }))
    .filter((o) => o.items.length > 0);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Ready to deliver</Text>
          <Text style={s.sub}>{readyOrders.length} table{readyOrders.length !== 1 ? "s" : ""} waiting</Text>
        </View>
        <View style={s.headerRight}>
          <RoleSwitcher />
          <TouchableOpacity onPress={signOut}>
            <Text style={s.signOut}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ flex: 1 }} />
      ) : (
        <ScrollView
          style={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
        >
          {readyOrders.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyText}>Nothing ready yet</Text>
              <Text style={s.emptySub}>Pull to refresh</Text>
            </View>
          )}

          {readyOrders.map((order) => (
            <View key={order.id} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.table}>Table {order.table_ref}</Text>
                <Text style={s.time}>
                  {new Date(order.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>

              {order.items.map((item) => (
                <View key={item.id} style={s.itemRow}>
                  <View style={s.itemLeft}>
                    <Text style={s.itemName}>{item.quantity}× {item.name}</Text>
                    {item.allergy_note ? (
                      <Text style={s.allergyNote}>⚠ {item.allergy_note}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={s.deliverBtn}
                    onPress={() => markDelivered(item)}
                    disabled={delivering.has(item.id)}
                  >
                    {delivering.has(item.id)
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.deliverBtnText}>Delivered</Text>}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "800", color: "#111827" },
  sub: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  headerRight: { alignItems: "flex-end", gap: 8 },
  signOut: { fontSize: 14, color: "#9ca3af" },
  list: { flex: 1 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 20, fontWeight: "700", color: "#6b7280" },
  emptySub: { fontSize: 14, color: "#9ca3af", marginTop: 8 },
  card: { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 },
  table: { fontSize: 20, fontWeight: "800", color: "#111827" },
  time: { fontSize: 13, color: "#9ca3af" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  allergyNote: { fontSize: 12, color: "#f59e0b", marginTop: 3 },
  deliverBtn: { backgroundColor: "#22c55e", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, minWidth: 90, alignItems: "center" },
  deliverBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
