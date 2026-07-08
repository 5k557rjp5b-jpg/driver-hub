export type Shift = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  created_at: string;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Dashboard: undefined;
};
