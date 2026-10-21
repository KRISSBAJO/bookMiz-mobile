import { createContext, useContext, useEffect, useState, useCallback, type PropsWithChildren } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSession } from './session-context';
import { getMerchantBootstrap, type Workspace } from '../lib/api/business';
import { canManageBusiness } from '../lib/business-policy';
import { Screen } from '../components/Screen';
import { getFriendlyApiError } from '../lib/api/error-display';
import { tokens } from '../theme/tokens';

type BusinessContext = { organizationId: string; workspace: Workspace; canManage: boolean; select: (id: string) => void; businesses: { id: string; displayName: string; role: string }[] };
const Context = createContext<BusinessContext | null>(null);
export function BusinessProvider({ children }: PropsWithChildren) {
  const session = useSession(), router = useRouter();
  const [selected, setSelected] = useState('');
  const organizationId = session.businesses.some(b => b.id === selected) ? selected : session.businesses[0]?.id ?? '';
  const [loaded, setLoaded] = useState<{ key: string; workspace: Workspace } | null>(null);
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const key = `${session.user?.id}:${organizationId}`;
  useEffect(() => {
    let active = true;
    setError('');
    if (organizationId) getMerchantBootstrap(organizationId).then(data => { if (active) setLoaded({ key, workspace: data.workspace }); }).catch(e => { if (active) setError(getFriendlyApiError(e, 'Could not open this business.')); });
    return () => { active = false; };
  }, [organizationId, key, attempt]);
  const select = useCallback((id: string) => { setLoaded(null); setSelected(id); }, []);
  if (session.isHydrating) return null;
  if (!session.isSignedIn) return <Redirect href="/login" />;
  if (!organizationId) return <Screen title="Business workspace"><Text>No business membership is linked to this account.</Text><Pressable onPress={() => router.replace('/(tabs)/account')}><Text>Back to account</Text></Pressable></Screen>;
  if (!loaded || loaded.key !== key || error) return <Screen title="Opening your business" subtitle="Loading your current workspace and permissions.">{error ? <><Text accessibilityRole="alert">{error}</Text>{/workspace not found/i.test(error)&&session.businesses.some(b=>b.id===organizationId&&["ORG_ADMIN","SERVICE_PROVIDER"].includes(b.role))?<Pressable accessibilityRole="button" onPress={()=>router.push({pathname:"/merchant-signup",params:{organizationId}} as never)}><Text style={{color:tokens.colors.ink,fontFamily:tokens.font.semibold,paddingVertical:12}}>Finish business setup →</Text></Pressable>:null}<Pressable onPress={() => setAttempt(a => a + 1)}><Text>Try again</Text></Pressable></> : <ActivityIndicator color={tokens.colors.ink} />}<Pressable onPress={() => router.replace('/(tabs)/account')}><Text>Back to account</Text></Pressable></Screen>;
  return <Context.Provider key={key} value={{ organizationId, workspace: loaded.workspace, canManage: canManageBusiness(session.businesses.find(b => b.id === organizationId)?.role), select, businesses: session.businesses }}>{children}</Context.Provider>;
}
export function useBusiness() {
  const value = useContext(Context);
  if (!value) throw new Error('Business workspace is not ready.');
  return value;
}
export function BusinessSelector() {
  const business = useBusiness();
  if (business.businesses.length < 2) return null;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
    {business.businesses.map(b => <Pressable key={b.id} accessibilityRole="button" accessibilityState={{ selected: b.id === business.organizationId }} onPress={() => business.select(b.id)} style={{ borderRadius: 12, padding: 12, minHeight: 44, backgroundColor: b.id === business.organizationId ? tokens.colors.inkDeep : '#fff', borderWidth: 1, borderColor: tokens.colors.border }}><Text style={{ color: b.id === business.organizationId ? '#fff' : tokens.colors.ink, fontFamily: tokens.font.semibold, fontSize: 13 }}>{b.id === business.organizationId ? business.workspace.displayName : b.displayName}</Text></Pressable>)}
  </ScrollView>;
}
