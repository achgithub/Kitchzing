import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { api, ApiError } from "../../src/lib/api";
import { isWithinHours } from "../../src/lib/hours";
import type { MenuItem, Allergen } from "@kitchzing/core";
import type { RestaurantConfig } from "../../src/lib/types";
import type { BasketItem } from "./menu";

function effectiveAllergens(item: MenuItem, selectedChoices: Record<string, string[]>): Allergen[] {
  const set = new Set<Allergen>(item.allergens);
  for (const group of item.option_groups) {
    const picked = selectedChoices[group.id] ?? [];
    for (const choice of group.choices) {
      if (picked.includes(choice.id)) {
        for (const a of choice.allergens) set.add(a);
      }
    }
  }
  return Array.from(set);
}

export default function OrderScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ tableRef: string; basket: string }>();
  const [basket, setBasket] = useState<BasketItem[]>(JSON.parse(params.basket ?? "[]"));
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<RestaurantConfig | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    api.getConfig(sessionToken).then((res) => setConfig(res.config)).catch(() => {});
  }, [sessionToken]);

  const tableRef = params.tableRef ?? "";

  function updateNotes(itemId: string, notes: string) {
    setBasket((prev) => prev.map((b) => b.item.id === itemId ? { ...b, notes } : b));
  }

  function updateAllergyNote(itemId: string, allergyNote: string) {
    setBasket((prev) => prev.map((b) => b.item.id === itemId ? { ...b, allergyNote } : b));
  }

  function changeQty(itemId: string, delta: number) {
    setBasket((prev) =>
      prev
        .map((b) => b.item.id === itemId ? { ...b, quantity: b.quantity + delta } : b)
        .filter((b) => b.quantity > 0)
    );
  }

  function toggleChoice(itemId: string, groupId: string, choiceId: string, isSingle: boolean) {
    setBasket((prev) =>
      prev.map((b) => {
        if (b.item.id !== itemId) return b;
        const current = b.selectedChoices[groupId] ?? [];
        let next: string[];
        if (isSingle) {
          next = current.includes(choiceId) ? current : [choiceId];
        } else {
          next = current.includes(choiceId)
            ? current.filter((id) => id !== choiceId)
            : [...current, choiceId];
        }
        return { ...b, selectedChoices: { ...b.selectedChoices, [groupId]: next } };
      })
    );
  }

  async function submit() {
    if (!sessionToken) return;
    if (!tableRef.trim()) { Alert.alert("Table required", "Enter a table number before submitting"); return; }
    if (basket.length === 0) { router.back(); return; }

    // Warn if outside opening hours
    if (config && !isWithinHours(config)) {
      const proceed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          "Kitchen is closed",
          `Opening hours are ${config.open_time}–${config.close_time}. Send order anyway?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Send anyway", onPress: () => resolve(true) },
          ]
        )
      );
      if (!proceed) return;
    }

    // Validate required option groups
    for (const b of basket) {
      for (const group of b.item.option_groups) {
        if (group.required && (b.selectedChoices[group.id] ?? []).length === 0) {
          Alert.alert("Missing option", `Please choose ${group.name} for ${b.item.name}`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await api.createOrder(
        {
          table_ref: tableRef,
          delivery_mode: "together",
          items: basket.map((b) => {
            const choices = b.item.option_groups.flatMap((group) =>
              (b.selectedChoices[group.id] ?? []).map((choiceId) => {
                const choice = group.choices.find((c) => c.id === choiceId);
                return { choice_id: choiceId, name: choice?.name ?? "", price_delta: choice?.price_delta ?? 0 };
              })
            );
            return {
              menu_item_id: b.item.id,
              name: b.item.name,
              quantity: b.quantity,
              notes: b.notes,
              allergy_note: b.allergyNote,
              choices,
            };
          }),
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
        {basket.map((b) => {
          const allergens = effectiveAllergens(b.item, b.selectedChoices);
          return (
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

              {/* Option groups */}
              {b.item.option_groups.map((group) => (
                <View key={group.id} style={s.groupBlock}>
                  <View style={s.groupLabelRow}>
                    <Text style={s.groupName}>{group.name}</Text>
                    {group.required && <Text style={s.requiredBadge}>Required</Text>}
                    {group.type === "multi" && <Text style={s.typeBadge}>Choose multiple</Text>}
                  </View>
                  <View style={s.choiceRow}>
                    {group.choices.map((choice) => {
                      const selected = (b.selectedChoices[group.id] ?? []).includes(choice.id);
                      const oos = !choice.in_stock;
                      return (
                        <TouchableOpacity
                          key={choice.id}
                          style={[s.choicePill, selected && s.choicePillActive, oos && s.choicePillOOS]}
                          onPress={() => !oos && toggleChoice(b.item.id, group.id, choice.id, group.type === "single")}
                          disabled={oos}
                        >
                          <Text style={[s.choicePillText, selected && s.choicePillTextActive]}>
                            {choice.name}
                            {choice.price_delta !== 0
                              ? ` ${choice.price_delta > 0 ? "+" : ""}£${(choice.price_delta / 100).toFixed(2)}`
                              : ""}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* Allergens — live updated from item base + selected choices */}
              {allergens.length > 0 && (
                <Text style={s.allergens}>⚠ Contains: {allergens.join(", ")}</Text>
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
          );
        })}
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
  groupBlock: { marginTop: 10 },
  groupLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  groupName: { fontSize: 13, fontWeight: "700", color: "#374151" },
  requiredBadge: { fontSize: 11, color: "#ef4444", backgroundColor: "#fee2e2", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadge: { fontSize: 11, color: "#6b7280", backgroundColor: "#f3f4f6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choicePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f3f4f6", borderWidth: 1.5, borderColor: "transparent" },
  choicePillActive: { backgroundColor: "#eff6ff", borderColor: "#3b82f6" },
  choicePillOOS: { opacity: 0.4 },
  choicePillText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  choicePillTextActive: { color: "#1d4ed8" },
  allergens: { fontSize: 12, color: "#f59e0b", marginTop: 10, marginBottom: 4 },
  notesInput: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, color: "#374151", marginTop: 8 },
  allergyInput: { borderColor: "#fcd34d", backgroundColor: "#fffbeb" },
  submitBtn: { margin: 16, backgroundColor: "#111827", borderRadius: 14, padding: 18, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
