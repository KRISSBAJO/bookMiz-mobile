import { Tabs } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { BusinessProvider } from '@/src/store/business-context';
import { tokens } from '@/src/theme/tokens';
export default function BusinessLayout() {
  const pages = [{ name: 'index', title: 'Today', icon: 'house' }, { name: 'calendar', title: 'Calendar', icon: 'calendar-days' }, { name: 'requests', title: 'Requests', icon: 'inbox' }, { name: 'inbox', title: 'Messages', icon: 'comments' }, { name: 'manage', title: 'Business', icon: 'store' }] as const;
  return <BusinessProvider><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: tokens.colors.ink, tabBarInactiveTintColor: tokens.colors.muted, tabBarLabelStyle: { fontFamily: tokens.font.semibold, fontSize: 10 }, tabBarStyle: { backgroundColor: '#fff', borderTopColor: tokens.colors.border }, sceneStyle: { backgroundColor: tokens.colors.surface } }}>{pages.map(p => <Tabs.Screen key={p.name} name={p.name} options={{ title: p.title, tabBarIcon: ({ color }) => <FontAwesome6 name={p.icon} size={18} color={color} /> }} />)}<Tabs.Screen name="money" options={{ href: null, title: 'Money' }} /></Tabs></BusinessProvider>;
}
