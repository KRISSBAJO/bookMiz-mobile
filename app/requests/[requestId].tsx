import { Redirect, useLocalSearchParams } from 'expo-router';
import { WorkbenchScreen } from '@/src/screens/WorkbenchScreen';
import { useSession } from '@/src/store/session-context';

export default function RequestDetailsRoute() {
  const { requestId } = useLocalSearchParams<{requestId: string}>();
  const session = useSession();
  if (session.isHydrating) return null;
  if (!session.isSignedIn) return <Redirect href="/welcome" />;
  return <WorkbenchScreen requestId={requestId} />;
}
