import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ShiftDetailsScreen } from '../screens/ShiftDetailsScreen';
import { ShiftHistoryScreen } from '../screens/ShiftHistoryScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import type {
  AuthStackParamList,
  HistoryStackParamList,
  MainTabParamList,
  RootStackParamList,
} from '../types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
  );
}

function HistoryNavigator() {
  return (
    <HistoryStack.Navigator>
      <HistoryStack.Screen
        component={ShiftHistoryScreen}
        name="ShiftHistory"
        options={{ headerShown: false }}
      />
      <HistoryStack.Screen
        component={ShiftDetailsScreen}
        name="ShiftDetails"
        options={{
          headerBackTitle: 'History',
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerTintColor: '#1D4ED8',
          headerTitle: 'Shift Details',
        }}
      />
    </HistoryStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1D4ED8',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen
        component={DashboardScreen}
        name="Dashboard"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Dashboard" />,
        }}
      />
      <Tab.Screen
        component={HistoryNavigator}
        name="History"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="History" />,
        }}
      />
      <Tab.Screen
        component={ProfileScreen}
        name="Profile"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Profile" />,
        }}
      />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen component={LoginScreen} name="Login" />
      <AuthStack.Screen component={SignUpScreen} name="SignUp" />
    </AuthStack.Navigator>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1D4ED8" size="large" />
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <RootStack.Screen component={MainTabs} name="Main" />
      ) : (
        <RootStack.Screen component={AuthNavigator} name="Auth" />
      )}
    </RootStack.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flex: 1,
    justifyContent: 'center',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelFocused: {
    color: '#1D4ED8',
  },
});
