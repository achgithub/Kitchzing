import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";
import type { BasketItem } from "./menu";

export default function OrderScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ tableRef: string; basket: string }>();
  const [basket, setBasket] = useState<BasketItem[]>(JSON.parse(params.basket ?? "[]"));
  const [submitting, setSubmitting] = useState(false);

  const tableRef = params.tableRef ?? "";

  function updateNotes(itemId: string, notes: string) {
    setBasket((prev) => prev.map((b) => b.item.id === itemId ? { ...b, notes } : b));
  }

  function updateAllergyNote(itemId: string, allergyNote: string) {
    setBasket((prev) => prev.map((b) => b.item.id === itemId ? { ...b, allergyNote } : b));
  }

  function changeQty(itemId: string, delta: number) {
    setBasket((prev) => prev
      .map((b) => b.item.id === itemId ? { ...b, quantity: b.quantity + delta } : b)
      .filter((b) => b.quantity > 0)
    );
  }

  async function submit() {
    if (!sessionToken) return;
    if (!tableRef.trim()) { Alert.alert("Table required", "Enter a table number before submitting"); return; }
    if (basket.length === 0) { router.back(); return; }

    setSubmitting(true);
    try {
      const res = await api.createOrder(
        {
          table_ref: tableRef,
          delivery_mode: "together",
          items: basket.map((b) => ({
            menu_item_id: b.item.id,
            name: b.item.name,
            quantity: b.quantity,
            notes: b.notes,
            allergy_note: b.allergyNote,
            choices: [],
          })),
        },
        sessionToken
      );

      if (res.warning === "kitchen_paused") {
        Alert.alert(
          "Kitchen paused",
          `${res.pause_reason ?? "Kitchen is paused"}. Order sent anyway.`,
          [{ text: "OK", onPress: () => router.replace("/(waiter)/menu") }]
        );
      } else {
        Alert.alert("Order sent!", `Table ${tableRef} order is in the kitchen.`, [
          { text: "OK", onPress: () => router.replace("/(waiter)/menu") },
        ]);
      }
    } catch (e) {
      Alert.alert("Failed", e instanceof ApiError ? e.message : "Could not send order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>‹ Menu</Text>
        </TouchableOpacity>
        <Text style={s.title}>Table {tableRef}</Text>
      </View>

      <ScrollView style={s.list}>
        {basket.map((b) => (
          <View key={b.item.id} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.itemName}>{b.item.name}</Text>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => changeQty(b.item.id, -1)}>
                  <Text style={s.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.qty}>{b.quantity}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => changeQty(b.item.id, 1)}>
                  <Text style={s.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            {b.item.allergens.length > 0 && (
              <Text style={s.allergens}>Contains: {b.item.allergens.join(", ")}</Text>
            )}
            <TextInput
              style={s.notesInput}
              value={b.notes}
              onChangeText={(t) => updateNotes(b.item.id, t)}
              placeholder="Notes (no pickles, well done...)"
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={[s.notesInput, s.allergyInput]}
              value={b.allergyNote}
              onChangeText={(t) => updateAllergyNote(b.item.id, t)}
              placeholder="⚠ Allergy note (customer told you)"
              placeholderTextColor="#f59e0b"
            />
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={s.submitBtn} onPress={submit} disabled={submitting || basket.length === 0}>
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.submitText}>Send to kitchen</Text>
        }
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  back: { fontSize: 18, color: "#6b7280" },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  list: { flex: 1 },
  card: { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemName: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 20, color: "#111827", lineHeight: 24 },
  qty: { fontSize: 18, fontWeight: "700", color: "#111827", minWidth: 24, textAlign: "center" },
  allergens: { fontSize: 12, color: "#f59e0b", marginBottom: 8 },
  notesInput: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, color: "#374151", marginBottom: 8 },
  allergyInput: { borderColor: "#fcd34d", backgroundColor: "#fffbeb" },
  submitBtn: { margin: 16, backgroundColor: "#111827", borderRadius: 14, padding: 18, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
