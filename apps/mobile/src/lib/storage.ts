import * as SecureStore from "expo-secure-store";

const DEVICE_TOKEN_KEY = "kz_device_token";
const RESTAURANT_KEY = "kz_restaurant";

export interface StoredRestaurant {
  id: string;
  name: string;
}

export const storage = {
  async getDeviceToken() {
    return SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
  },
  async setDeviceToken(token: string) {
    return SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
  },
  async clearDeviceToken() {
    return SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
  },

  async getRestaurant(): Promise<StoredRestaurant | null> {
    const raw = await SecureStore.getItemAsync(RESTAURANT_KEY);
    return raw ? (JSON.parse(raw) as StoredRestaurant) : null;
  },
  async setRestaurant(r: StoredRestaurant) {
    return SecureStore.setItemAsync(RESTAURANT_KEY, JSON.stringify(r));
  },
};
