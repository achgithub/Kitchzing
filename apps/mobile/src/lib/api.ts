import { API_URL } from "./config";
import type {
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
  LoginRequest,
  LoginResponse,
  CreateOrderRequest,
  Order,
  MenuCategory,
} from "@kitchzing/core";
import type { RestaurantConfig, PauseState } from "./types";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, (data as { error: string }).error ?? "Request failed");
  return data as T;
}

export const api = {
  register(body: DeviceRegistrationRequest) {
    return request<DeviceRegistrationResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  login(body: LoginRequest & { role?: string }, deviceToken: string) {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
      token: deviceToken,
    });
  },

  createOrder(body: CreateOrderRequest, sessionToken: string) {
    return request<{ order_id: string; warning?: string; pause_reason?: string }>(
      "/orders",
      { method: "POST", body: JSON.stringify(body), token: sessionToken }
    );
  },

  getActiveOrders(token: string) {
    return request<{ orders: Order[] }>("/orders/active", { token });
  },

  getMenu(token: string) {
    return request<{ categories: MenuCategory[] }>("/menu", { token });
  },

  getConfig(token: string) {
    return request<{ config: RestaurantConfig; pause: PauseState }>("/config", { token });
  },

  pauseKitchen(body: { reason: string; reason_text?: string; resume_in_minutes?: number }, sessionToken: string) {
    return request<{ ok: boolean }>("/config/pause", {
      method: "POST",
      body: JSON.stringify(body),
      token: sessionToken,
    });
  },

  resumeKitchen(sessionToken: string) {
    return request<{ ok: boolean }>("/config/pause", { method: "DELETE", token: sessionToken });
  },

  toggleItemStock(itemId: string, in_stock: boolean, sessionToken: string) {
    return request<{ ok: boolean }>(`/menu/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ in_stock }),
      token: sessionToken,
    });
  },

  toggleOptionStock(choiceId: string, in_stock: boolean, sessionToken: string) {
    return request<{ ok: boolean }>(`/menu/options/${choiceId}`, {
      method: "PATCH",
      body: JSON.stringify({ in_stock }),
      token: sessionToken,
    });
  },

  generateStaffToken(sessionToken: string) {
    return request<{ token: string; restaurant_code: string; expires_in: number }>("/auth/staff-token", {
      method: "POST",
      token: sessionToken,
    });
  },

  switchRole(role: string, sessionToken: string) {
    return request<{ session_token: string; role: string }>("/auth/role", {
      method: "POST",
      body: JSON.stringify({ role }),
      token: sessionToken,
    });
  },

  advanceItemState(itemId: string, state: string, sessionToken: string) {
    return request<{ ok: boolean }>(`/orders/items/${itemId}/state`, {
      method: "PATCH",
      body: JSON.stringify({ state }),
      token: sessionToken,
    });
  },
};

export { ApiError };
