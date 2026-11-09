import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppProvider } from './src/store';
import { C } from './src/ui';
import * as S from './src/screens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const icon = e => ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{e}</Text>;

function Main() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: C.g, headerTitleStyle: { color: C.g } }}>
      <Tab.Screen name="Home" component={S.Home} options={{ tabBarIcon: icon('🏠') }} />
      <Tab.Screen name="Monitor" component={S.Monitor} options={{ tabBarIcon: icon('📡') }} />
      <Tab.Screen name="Records" component={S.Records} options={{ tabBarIcon: icon('📋') }} />
      <Tab.Screen name="Profile" component={S.Profile} options={{ tabBarIcon: icon('👤') }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerTintColor: C.g }}>
          <Stack.Screen name="Splash" component={S.Splash} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={S.Login} options={{ headerShown: false }} />
          <Stack.Screen name="Main" component={Main} options={{ headerShown: false }} />
          <Stack.Screen name="Connect" component={S.Connect} options={{ title: 'Connect device' }} />
          <Stack.Screen name="Area" component={S.Area} />
          <Stack.Screen name="Average" component={S.Average} options={{ title: 'Average soil analysis' }} />
          <Stack.Screen name="Crops" component={S.Crops} options={{ title: 'Crop recommendation' }} />
          <Stack.Screen name="Amend" component={S.Amend} options={{ title: 'Soil amendments' }} />
          <Stack.Screen name="Sync" component={S.Sync} options={{ title: 'Sync data' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
