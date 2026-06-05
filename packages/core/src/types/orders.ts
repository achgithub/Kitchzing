import type { DeliveryMode } from "./restaurant";

export type OrderStatus = "open" | "complete" | "cancelled";

export type ItemState = string;

export interface Order {
  id: string;
  restaurant_id: string;
  created_by: string;
  table_ref: string;
  delivery_mode: DeliveryMode;
  status: OrderStatus;
  created_at: number;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  notes: string;
  allergy_note: string;
  state: ItemState;
  state_updated_by: string | null;
  state_updated_at: number | null;
  choices: OrderItemChoice[];
}

export interface OrderItemChoice {
  id: string;
  order_item_id: string;
  choice_id: string;
  name: string;
  price_delta: number;
}

export interface CreateOrderRequest {
  table_ref: string;
  delivery_mode: DeliveryMode;
  items: CreateOrderItem[];
}

export interface CreateOrderItem {
  menu_item_id: string | null;
  name: string;
  quantity: number;
  notes: string;
  allergy_note: string;
  choices: { choice_id: string; name: string; price_delta: number }[];
}

export interface AdvanceItemStateRequest {
  state: ItemState;
}

export interface KitchenPause {
  paused: boolean;
  reason: string | null;
  reason_text: string | null;
  paused_by: string | null;
  paused_at: number | null;
  resume_at: number | null;
}
