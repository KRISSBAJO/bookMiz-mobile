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
    <View style={styles.shell} accessibilityRole="tablist">
      <Pressable
        onPress={() => onChange("customer")}
        accessibilityRole="tab"
        accessibilityState={{ selected: activePersona === "customer" }}
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
        accessibilityRole="tab"
        accessibilityState={{ selected: activePersona === "agent", disabled: !canUseAgentMode }}
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
    backgroundColor: tokens.colors.navySoft,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 4,
    gap: 4,
  },
  segment: {
    minHeight: 40,
    minWidth: 104,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "#ffffff",
  },
  segmentDisabled: {
    opacity: 0.4,
  },
  segmentText: {
    color: tokens.colors.onNavyMuted,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  segmentTextActive: {
    color: tokens.colors.inkDeep,
    fontFamily: tokens.font.bold,
  },
});
