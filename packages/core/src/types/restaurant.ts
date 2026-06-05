export type SubscriptionTier = "starter" | "standard" | "plus";

export type DeliveryMode = "together" | "as_when";

export interface Restaurant {
  id: string;
  name: string;
  code: string;
  tier: SubscriptionTier;
  active: boolean;
  created_at: number;
}

export interface RestaurantConfig {
  open_time: string;
  close_time: string;
  timezone: string;
  delivery_mode: DeliveryMode;
  order_states: string[];
}

export interface Staff {
  id: string;
  restaurant_id: string;
  name: string;
  default_role: Role;
  active: boolean;
}

export interface Device {
  id: string;
  restaurant_id: string;
  name: string;
  last_seen: number;
  registered_at: number;
  active: boolean;
}

export type Role = "waiter" | "kitchen" | "deliverer" | "manager";
