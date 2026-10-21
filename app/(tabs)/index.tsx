import { Redirect } from "expo-router";
import { HomeScreen } from "@/src/screens/HomeScreen";
import { useSession } from "@/src/store/session-context";
export default function TabIndexScreen() {
  const session = useSession();
  if (session.activePersona === "business" && session.canUseBusinessMode) return <Redirect href={"/business" as never} />;
  return <HomeScreen />;
}
