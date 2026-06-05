import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "../lib/storage";
import type { Role } from "@kitchzing/core";

interface AuthState {
  deviceToken: string | null;
  sessionToken: string | null;
  restaurantName: string | null;
  staffName: string | null;
  role: Role | null;
  loading: boolean;
}

interface AuthActions {
  setDevice(token: string, restaurantName: string): void;
  setSession(token: string, staffName: string, role: Role): void;
  clearSession(): void;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    deviceToken: null,
    sessionToken: null,
    restaurantName: null,
    staffName: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    (async () => {
      const [token, restaurant] = await Promise.all([
        storage.getDeviceToken(),
        storage.getRestaurant(),
      ]);
      setState((s) => ({
        ...s,
        deviceToken: token,
        restaurantName: restaurant?.name ?? null,
        loading: false,
      }));
    })();
  }, []);

  function setDevice(token: string, restaurantName: string) {
    storage.setDeviceToken(token);
    storage.setRestaurant({ id: "", name: restaurantName });
    setState((s) => ({ ...s, deviceToken: token, restaurantName }));
  }

  function setSession(token: string, staffName: string, role: Role) {
    setState((s) => ({ ...s, sessionToken: token, staffName, role }));
  }

  function clearSession() {
    setState((s) => ({ ...s, sessionToken: null, staffName: null, role: null }));
  }

  return (
    <AuthContext.Provider value={{ ...state, setDevice, setSession, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
