import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import ConnectScreen from './src/screens/ConnectScreen';
import ServersScreen from './src/screens/ServersScreen';
import ServerDetailScreen from './src/screens/ServerDetailScreen';
import ServerSettingsScreen from './src/screens/ServerSettingsScreen';
import ModDetailScreen from './src/screens/ModDetailScreen';
import BackupListScreen from './src/screens/BackupListScreen';
import CreateServerScreen from './src/screens/CreateServerScreen';

import { colors } from './src/theme';

const Stack = createStackNavigator();

export default function App() {

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(colors.bg);
      NavigationBar.setButtonStyleAsync('light');
    }
  }, [])

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
          sceneContainerStyle: { backgroundColor: colors.bg },
          animationEnabled: false,
        }}
      >
        <Stack.Screen name="Connect" component={ConnectScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Servers" component={ServersScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ServerDetail" component={ServerDetailScreen} options={{ title: 'Server' }} />
        <Stack.Screen name="ServerSettings" component={ServerSettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="ModDetail" component={ModDetailScreen} options={{ title: 'Mod details' }} />
        <Stack.Screen name="BackupList" component={BackupListScreen} options={{ title: 'Backups' }} />
        <Stack.Screen name="CreateServer" component={CreateServerScreen} options={{ title: 'New server' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
