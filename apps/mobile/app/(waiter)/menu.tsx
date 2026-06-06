import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";
import type { MenuCategory, MenuItem } from "@kitchzing/core";

export interface BasketItem {
  item: MenuItem & { category_name: string };
  quantity: number;
  notes: string;
  allergyNote: string;
}

export default function MenuScreen() {
  const { deviceToken, sessionToken, staffName, clearSession } = useAuth();
  const token = sessionToken ?? deviceToken ?? "";
  const router = useRouter();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [tableRef, setTableRef] = useState("");
  const [activeCategory, setActiveCategory] = useState("");

  const fetchMenu = useCallback(async () => {
    try {
      const res = await api.getMenu(token);
      setCategories(res.categories);
      if (!activeCategory && res.categories.length > 0) {
        setActiveCategory(res.categories[0]?.id ?? "");
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clearSession();
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  function addToBasket(item: MenuItem, categoryName: string) {
    setBasket((prev) => {
      const existing = prev.find((b) => b.item.id === item.id);
      if (existing) return prev.map((b) => b.item.id === item.id ? { ...b, quantity: b.quantity + 1 } : b);
      return [...prev, { item: { ...item, category_name: categoryName }, quantity: 1, notes: "", allergyNote: "" }];
    });
  }

  const totalItems = basket.reduce((sum, b) => sum + b.quantity, 0);
  const activeItems = categories.find((c) => c.id === activeCategory)?.items ?? [];

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator size="large" color="#111827" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Menu</Text>
          <Text style={s.headerSub}>{staffName}</Text>
        </View>
        <TouchableOpacity onPress={clearSession}>
          <Text style={s.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tableRow}>
        <Text style={s.tableLabel}>Table</Text>
        <TextInput
          style={s.tableInput}
          value={tableRef}
          onChangeText={setTableRef}
          placeholder="e.g. T4"
          autoCapitalize="characters"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catBar} contentContainerStyle={s.catContent}>
        {categories.map((cat) => (
          <TouchableOpacity key={cat.id} style={[s.catPill, activeCategory === cat.id && s.catPillActive]} onPress={() => setActiveCategory(cat.id)}>
            <Text style={[s.catPillText, activeCategory === cat.id && s.catPillTextActive]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.list} refreshControl={<RefreshControl refreshing={false} onRefresh={fetchMenu} />}>
        {categories.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyText}>No menu items yet</Text>
            <Text style={s.emptySub}>Ask your manager to set up the menu</Text>
          </View>
        )}
        {activeItems.map((item) => {
          const inBasket = basket.find((b) => b.item.id === item.id);
          const categoryName = categories.find((c) => c.id === activeCategory)?.name ?? "";
          return (
            <TouchableOpacity
              key={item.id}
              style={[s.itemRow, !item.in_stock && s.itemRowOOS]}
              onPress={() => item.in_stock && addToBasket(item, categoryName)}
              disabled={!item.in_stock}
            >
              <View style={s.itemInfo}>
                <View style={s.itemNameRow}>
                  <Text style={[s.itemName, !item.in_stock && s.itemNameOOS]}>{item.name}</Text>
                  {!item.in_stock && <Text style={s.oosTag}>Out of stock</Text>}
                </View>
                {item.allergens.length > 0 && (
                  <Text style={s.allergenDots}>⚠ {item.allergens.join(", ")}</Text>
                )}
              </View>
              <View style={s.itemRight}>
                <Text style={s.itemPrice}>£{(item.price / 100).toFixed(2)}</Text>
                {inBasket && <Text style={s.inBasket}>×{inBasket.quantity}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {totalItems > 0 && (
        <TouchableOpacity
          style={[s.basketBar, !tableRef.trim() && s.basketBarDim]}
          onPress={() => {
            if (!tableRef.trim()) return;
            router.push({ pathname: "/(waiter)/order", params: { tableRef, basket: JSON.stringify(basket) } });
          }}
        >
          <Text style={s.basketText}>
            {tableRef.trim() ? `${totalItems} item${totalItems !== 1 ? "s" : ""} · Review order` : "Enter table number first"}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#111827" },
  headerSub: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  signOut: { fontSize: 14, color: "#9ca3af", marginTop: 4 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  tableLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  tableInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 16, minWidth: 80 },
  catBar: { maxHeight: 48 },
  catContent: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
  catPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#e5e7eb" },
  catPillActive: { backgroundColor: "#111827" },
  catPillText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  catPillTextActive: { color: "#fff" },
  list: { flex: 1, paddingTop: 8 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 18, fontWeight: "700", color: "#6b7280" },
  emptySub: { fontSize: 14, color: "#9ca3af", marginTop: 6 },
  itemRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 16 },
  itemRowOOS: { opacity: 0.5 },
  itemInfo: { flex: 1 },
  itemNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  itemNameOOS: { color: "#9ca3af" },
  oosTag: { fontSize: 11, color: "#ef4444", backgroundColor: "#fee2e2", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  allergenDots: { fontSize: 11, color: "#f59e0b", marginTop: 3 },
  itemRight: { alignItems: "flex-end", gap: 4 },
  itemPrice: { fontSize: 15, fontWeight: "700", color: "#111827" },
  inBasket: { fontSize: 13, color: "#6b7280", backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  basketBar: { margin: 16, backgroundColor: "#111827", borderRadius: 14, padding: 18, alignItems: "center" },
  basketBarDim: { backgroundColor: "#6b7280" },
  basketText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
