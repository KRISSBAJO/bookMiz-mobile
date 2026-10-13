import { FontAwesome6 } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { View, type ColorValue } from "react-native";

import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

function TabIcon({
  color,
  name,
  focused,
}: {
  color: ColorValue;
  name: React.ComponentProps<typeof FontAwesome6>["name"];
  focused: boolean;
}) {
  return (
    <View
      style={{
        width: 44,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? tokens.colors.brandSoft : "transparent",
      }}
    >
      <FontAwesome6 name={name} size={17} color={color} />
    </View>
  );
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
        tabBarActiveTintColor: tokens.colors.inkDeep,
        tabBarInactiveTintColor: tokens.colors.muted,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: tokens.colors.border,
          height: 84,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="house" />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="compass" />,
        }}
      />
      <Tabs.Screen
        name="workbench"
        options={{
          title: workbenchTitle,
          tabBarLabel: workbenchTitle,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={color}
              focused={focused}
              name={session.activePersona === "agent" ? "briefcase" : "list-check"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="comment-dots" />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="user-large" />,
        }}
      />
    </Tabs>
  );
}
