import { Pressable, StyleSheet, Text, View } from "react-native";

import { tokens } from "@/src/theme/tokens";
import type { PersonaMode } from "@/src/types/mobile";

export function PersonaSwitcher({
  activePersona,
  canUseAgentMode,
  onChange,
}: {
  activePersona: PersonaMode;
  canUseAgentMode: boolean;
  onChange: (persona: PersonaMode) => void;
}) {
  return (
    <View style={styles.shell}>
      <Pressable
        onPress={() => onChange("customer")}
        style={[
          styles.segment,
          activePersona === "customer" ? styles.segmentActive : null,
        ]}
      >
        <Text
          style={[
            styles.segmentText,
            activePersona === "customer" ? styles.segmentTextActive : null,
          ]}
        >
          Customer
        </Text>
      </Pressable>
      <Pressable
        disabled={!canUseAgentMode}
        onPress={() => onChange("agent")}
        style={[
          styles.segment,
          activePersona === "agent" ? styles.segmentActive : null,
          !canUseAgentMode ? styles.segmentDisabled : null,
        ]}
      >
        <Text
          style={[
            styles.segmentText,
            activePersona === "agent" ? styles.segmentTextActive : null,
          ]}
        >
          Agent
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 5,
    gap: 5,
  },
  segment: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  segmentActive: {
    backgroundColor: "#ffffff",
  },
  segmentDisabled: {
    opacity: 0.4,
  },
  segmentText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  segmentTextActive: {
    color: tokens.colors.ink,
  },
});
