import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { HARDCODED_MENU, type HardcodedItem } from "../../src/lib/hardcoded-menu";
import { useAuth } from "../../src/context/auth";

export interface BasketItem {
  item: HardcodedItem;
  quantity: number;
  notes: string;
  allergyNote: string;
}

export default function MenuScreen() {
  const { staffName, clearSession } = useAuth();
  const router = useRouter();
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [tableRef, setTableRef] = useState("");
  const [activeCategory, setActiveCategory] = useState(HARDCODED_MENU[0]?.id ?? "");

  function addToBasket(item: HardcodedItem) {
    setBasket((prev) => {
      const existing = prev.find((b) => b.item.id === item.id);
      if (existing) {
        return prev.map((b) => b.item.id === item.id ? { ...b, quantity: b.quantity + 1 } : b);
      }
      return [...prev, { item, quantity: 1, notes: "", allergyNote: "" }];
    });
  }

  const totalItems = basket.reduce((sum, b) => sum + b.quantity, 0);

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
        {HARDCODED_MENU.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[s.catPill, activeCategory === cat.id && s.catPillActive]}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Text style={[s.catPillText, activeCategory === cat.id && s.catPillTextActive]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.list}>
        {HARDCODED_MENU.filter((c) => c.id === activeCategory).map((cat) =>
          cat.items.map((item) => {
            const inBasket = basket.find((b) => b.item.id === item.id);
            return (
              <TouchableOpacity key={item.id} style={s.itemRow} onPress={() => addToBasket(item)}>
                <View style={s.itemInfo}>
                  <Text style={s.itemName}>{item.name}</Text>
                  {item.allergens.length > 0 && (
                    <Text style={s.allergenDots}>{item.allergens.map(() => "⚠").join(" ")} {item.allergens.join(", ")}</Text>
                  )}
                </View>
                <View style={s.itemRight}>
                  <Text style={s.itemPrice}>£{(item.price / 100).toFixed(2)}</Text>
                  {inBasket && <Text style={s.inBasket}>×{inBasket.quantity}</Text>}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {totalItems > 0 && (
        <TouchableOpacity
          style={s.basketBar}
          onPress={() => router.push({ pathname: "/(waiter)/order", params: { tableRef, basket: JSON.stringify(basket) } })}
        >
          <Text style={s.basketText}>{totalItems} item{totalItems !== 1 ? "s" : ""} · Review order</Text>
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
  itemRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 16 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  allergenDots: { fontSize: 11, color: "#f59e0b", marginTop: 3 },
  itemRight: { alignItems: "flex-end", gap: 4 },
  itemPrice: { fontSize: 15, fontWeight: "700", color: "#111827" },
  inBasket: { fontSize: 13, color: "#6b7280", backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  basketBar: { margin: 16, backgroundColor: "#111827", borderRadius: 14, padding: 18, alignItems: "center" },
  basketText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
