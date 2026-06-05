export interface DeviceRegistrationRequest {
  restaurant_code: string;
  device_name: string;
  one_time_token?: string;
}

export interface DeviceRegistrationResponse {
  device_token: string;
  restaurant_id: string;
  restaurant_name: string;
}

export interface LoginRequest {
  pin: string;
}

export interface LoginResponse {
  session_token: string;
  staff_id: string;
  name: string;
  role: string;
}

export interface RecoveryRequest {
  email: string;
  recovery_code: string;
}
