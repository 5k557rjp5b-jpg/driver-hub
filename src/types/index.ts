export type Shift = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  notes: string | null;
  created_at: string;
};

export type WageSettings = {
  user_id: string;
  hourly_rate: number;
  overtime_rate: number;
  overtime_threshold_hours: number;
  currency: string;
  updated_at: string;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Profile: undefined;
};

export type HistoryStackParamList = {
  ShiftHistory: undefined;
  ShiftDetails: { shiftId: string };
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
