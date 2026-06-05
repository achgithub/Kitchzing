import { API_URL } from "./config";
import type {
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
  LoginRequest,
  LoginResponse,
  CreateOrderRequest,
  Order,
} from "@kitchzing/core";

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
