import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import ConnectScreen from './src/screens/ConnectScreen';
import ServersScreen from './src/screens/ServersScreen';
import ServerDetailScreen from './src/screens/ServerDetailScreen';
import ServerSettingsScreen from './src/screens/ServerSettingsScreen';
import ModDetailScreen from './src/screens/ModDetailScreen';

import { colors } from './src/theme';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bgCard, elevation: 0, shadowOpacity: 0 },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitleVisible: false,
          cardStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="Connect" component={ConnectScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Servers" component={ServersScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ServerDetail" component={ServerDetailScreen} options={{ title: 'Serveur' }} />
        <Stack.Screen name="ServerSettings" component={ServerSettingsScreen} options={{ title: 'Paramètres' }} />
        <Stack.Screen name="ModDetail" component={ModDetailScreen} options={{ title: 'Détails du mod' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
