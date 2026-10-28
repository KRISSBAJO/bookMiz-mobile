import { useLocalSearchParams } from 'expo-router';
import { WorkbenchScreen } from '@/src/screens/WorkbenchScreen';

export default function RequestDetailsRoute() {
  const { requestId } = useLocalSearchParams<{requestId: string}>();
  return <WorkbenchScreen requestId={requestId} />;
}
