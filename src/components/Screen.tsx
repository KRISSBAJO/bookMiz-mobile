import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { tokens } from "@/src/theme/tokens";

type ScreenProps = PropsWithChildren<{
  /** Small muted line above the title, e.g. "3 upcoming". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned control next to the title (icon button, chip). */
  action?: ReactNode;
  /** Content under the title inside the header (search bar, segmented control). */
  heroContent?: ReactNode;
  /** @deprecated kept for older screens; rendered above the title. */
  heroTopContent?: ReactNode;
  /** Shows a back chevron when the router can go back. Default: true on stack screens. */
  showBack?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentTopOffset?: number;
  /** @deprecated no-op, kept so older call sites compile. */
  heroBottomPadding?: number;
  /** @deprecated no-op, kept so older call sites compile. */
  heroMinHeight?: number;
}>;

/**
 * Standard screen: light page, big title, optional action and header content,
 * then a scrolling body. Tab screens pass `showBack={false}`.
 */
export function Screen({
  eyebrow,
  title,
  subtitle,
  action,
  heroContent,
  heroTopContent,
  showBack = true,
  refreshing = false,
  onRefresh,
  contentTopOffset = 4,
  children,
}: ScreenProps) {
  const router = useRouter();
  const canGoBack = showBack && router.canGoBack();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={styles.flex}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: contentTopOffset }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.inkDeep} />
            ) : undefined
          }
        >
          <View style={styles.header}>
            {heroTopContent ? <View style={styles.heroTopContent}>{heroTopContent}</View> : null}
            <View style={styles.titleRow}>
              {canGoBack ? (
                <Pressable
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  style={styles.backButton}
                >
                  <FontAwesome6 name="chevron-left" size={16} color={tokens.colors.ink} />
                </Pressable>
              ) : null}
              <View style={styles.titleBlock}>
                {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
                <Text style={styles.title} numberOfLines={2}>
                  {title}
                </Text>
              </View>
              {action ? <View style={styles.action}>{action}</View> : null}
            </View>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {heroContent ? <View style={styles.heroContent}>{heroContent}</View> : null}
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 20,
  },
  header: {
    paddingTop: 8,
    gap: 8,
  },
  heroTopContent: {
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  action: {
    flexShrink: 0,
  },
  eyebrow: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: tokens.font.display,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: tokens.font.regular,
  },
  heroContent: {
    marginTop: 6,
  },
});
