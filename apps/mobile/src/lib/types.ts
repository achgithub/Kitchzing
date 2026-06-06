export interface RestaurantConfig {
  open_time: string;
  close_time: string;
  timezone: string;
  delivery_mode: "together" | "as_when";
  order_states: string[];
}

export interface PauseState {
  paused: boolean;
  reason: string | null;
  reason_text: string | null;
  paused_by: string | null;
  paused_at: number | null;
  resume_at: number | null;
}
