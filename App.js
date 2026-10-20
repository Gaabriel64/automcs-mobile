import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { Inconsolata_400Regular, Inconsolata_500Medium, Inconsolata_700Bold } from '@expo-google-fonts/inconsolata';
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

import { colors, fonts } from './src/theme';
import { Icon } from './src/components/ui';

const Stack = createStackNavigator();

// Dark navigation theme (avoids white flashes between screens)
const navTheme = {
  dark: true,
  colors: {
    primary: colors.accent,
    background: colors.bg,
    card: colors.bgCard,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function App() {
  // Figtree (UI) and Inconsolata (console) are the desktop app fonts; family names must
  // match theme.fonts, since weights are resolved by family on Android.
  const [fontsLoaded] = useFonts({
    [fonts.regular]: Figtree_400Regular,
    [fonts.medium]: Figtree_500Medium,
    [fonts.semibold]: Figtree_600SemiBold,
    [fonts.bold]: Figtree_700Bold,
    [fonts.extraBold]: Figtree_800ExtraBold,
    [fonts.mono]: Inconsolata_400Regular,
    [fonts.monoMedium]: Inconsolata_500Medium,
    [fonts.monoBold]: Inconsolata_700Bold,
  });

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(colors.bg);
      NavigationBar.setButtonStyleAsync('light');
    }
  }, [])

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.bgCard, elevation: 0, shadowOpacity: 0,
            borderBottomWidth: 1, borderBottomColor: colors.border,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18 },
          headerBackTitleVisible: false,
          headerBackImage: ({ tintColor }) => (
            <Icon name="arrow-back" size={24} color={tintColor} style={{ marginLeft: 14 }} />
          ),
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
