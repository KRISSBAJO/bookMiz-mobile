import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { tokens } from "@/src/theme/tokens";

type AuthShellProps = PropsWithChildren<{
  /** Short headline drawn over the photo. One line is ideal. */
  title: string;
  /** Optional one-line helper under the title, on the white sheet. */
  subtitle?: string;
  heroImage?: any;
  /** Replaces the photo hero entirely (Welcome uses this). */
  heroMedia?: ReactNode;
  heroHeight?: number;
  showBack?: boolean;
  footer?: ReactNode;
}>;

export function BrandMark({ size = 30, light = true }: { size?: number; light?: boolean }) {
  return (
    <View style={styles.brandRow}>
      <View style={[styles.brandMark, { width: size, height: size, borderRadius: size * 0.3 }]}>
        <Image
          source={require("../../../assets/bookmiz/logo.png")}
          style={{ width: size * 0.6, height: size * 0.6, resizeMode: "contain" }}
        />
      </View>
      <Text style={[styles.brandTitle, { fontSize: size * 0.7, color: light ? "#ffffff" : tokens.colors.ink }]}>
        Book<Text style={{ color: tokens.colors.brand }}>Miz</Text>
      </Text>
    </View>
  );
}

export function AuthShell({
  title,
  subtitle,
  heroImage,
  heroMedia,
  heroHeight = 300,
  showBack = true,
  footer,
  children,
}: AuthShellProps) {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={[styles.hero, { height: heroHeight }]}>
            {heroMedia ? (
              heroMedia
            ) : heroImage ? (
              <Image source={heroImage} style={styles.heroImage} />
            ) : null}
            <View style={styles.heroShadeTop} />
            <View style={styles.heroShadeBottom} />

            <SafeAreaView edges={["top"]} style={styles.heroSafe}>
              <View style={styles.heroTopRow}>
                {showBack && router.canGoBack() ? (
                  <Pressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    style={styles.backButton}
                  >
                    <FontAwesome6 name="chevron-left" size={16} color="#ffffff" />
                  </Pressable>
                ) : (
                  <View style={styles.backButtonSpacer} />
                )}
                <BrandMark />
                <View style={styles.backButtonSpacer} />
              </View>
            </SafeAreaView>

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>{title}</Text>
            </View>
          </View>

          <View style={styles.sheet}>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.inkDeep,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    backgroundColor: tokens.colors.navySoft,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heroShadeTop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16,39,72,0.35)",
  },
  heroShadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 130,
    backgroundColor: "rgba(16,39,72,0.55)",
  },
  heroSafe: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonSpacer: {
    width: 40,
    height: 40,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontFamily: tokens.font.displayBold,
    letterSpacing: -0.5,
  },
  heroTitleWrap: {
    paddingHorizontal: 24,
    paddingBottom: 44,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 32,
    fontFamily: tokens.font.display,
    letterSpacing: -1,
  },
  sheet: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: tokens.font.regular,
    marginBottom: 4,
  },
  body: {
    marginTop: 12,
    gap: 16,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 24,
  },
});
