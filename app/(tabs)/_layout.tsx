import { FontAwesome6 } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

function TabIcon({
  color,
  name,
}: {
  color: ColorValue;
  name: React.ComponentProps<typeof FontAwesome6>["name"];
}) {
  return <FontAwesome6 name={name} size={18} color={color} />;
}

export default function TabLayout() {
  const session = useSession();

  if (session.isHydrating) {
    return null;
  }

  if (!session.isSignedIn) {
    return <Redirect href="/welcome" />;
  }

  const workbenchTitle =
    session.activePersona === "agent" ? "Agent" : "Requests";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.ink,
        tabBarInactiveTintColor: tokens.colors.muted,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: tokens.colors.border,
          height: 86,
          paddingTop: 10,
          paddingBottom: 14,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon color={color} name="house" />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <TabIcon color={color} name="compass" />,
        }}
      />
      <Tabs.Screen
        name="workbench"
        options={{
          title: workbenchTitle,
          tabBarLabel: workbenchTitle,
          tabBarIcon: ({ color }) => (
            <TabIcon
              color={color}
              name={session.activePersona === "agent" ? "briefcase" : "list-check"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color }) => <TabIcon color={color} name="comment-dots" />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <TabIcon color={color} name="user-large" />,
        }}
      />
    </Tabs>
  );
}
