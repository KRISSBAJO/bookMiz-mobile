import { FontAwesome6 } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { tokens } from "@/src/theme/tokens";

type AuthShellProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  subtitle: string;
  brandTagline?: string;
  heroImage?: any;
  heroMedia?: ReactNode;
  topAccent?: ReactNode;
  footer?: ReactNode;
}>;

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  brandTagline = "Beauty, wellness & care",
  heroImage,
  heroMedia,
  topAccent,
  footer,
  children,
}: AuthShellProps) {
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
          bounces={false}
        >
          <View style={styles.hero}>
            <SafeAreaView>
              <View style={styles.heroInner}>
                <View style={styles.brandChip}>
                  <View style={styles.brandMark}>
                    <Image
                      source={require("../../../assets/bookmiz/logo.png")}
                      style={styles.brandLogo}
                    />
                  </View>
                  <View style={styles.brandBody}>
                    <Text style={styles.brandTitle}>BookMiz</Text>
                    <Text style={styles.brandCaption}>{brandTagline}</Text>
                  </View>
                </View>

                {heroMedia ? (
                  <View style={styles.heroFrame}>{heroMedia}</View>
                ) : heroImage ? (
                  <View style={styles.heroFrame}>
                    <Image source={heroImage} style={styles.heroImage} />
                    <View style={styles.heroImageOverlay} />
                    <View style={styles.heroBubbleLeft}>
                      <FontAwesome6
                        name="store"
                        size={16}
                        color="#7a2cf2"
                      />
                    </View>
                    <View style={styles.heroBubbleRight}>
                      <FontAwesome6
                        name="sliders"
                        size={16}
                        color="#6f5e1c"
                      />
                    </View>
                  </View>
                ) : null}

                {topAccent ? <View style={styles.topAccent}>{topAccent}</View> : null}
              </View>
            </SafeAreaView>
          </View>

          <View style={styles.sheet}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
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
    backgroundColor: tokens.colors.surface,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    backgroundColor: tokens.colors.inkDeep,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 34,
  },
  heroInner: {
    gap: 18,
  },
  brandChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogo: {
    width: 19,
    height: 19,
    resizeMode: "contain",
  },
  brandBody: {
    gap: 2,
  },
  brandTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  brandCaption: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 11,
    fontWeight: "700",
  },
  heroFrame: {
    height: 286,
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: "#20304d",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12,29,54,0.12)",
  },
  heroBubbleLeft: {
    position: "absolute",
    left: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBubbleRight: {
    position: "absolute",
    right: 18,
    top: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff6d8",
    alignItems: "center",
    justifyContent: "center",
  },
  topAccent: {
    marginTop: -4,
  },
  sheet: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 34,
  },
  eyebrow: {
    color: tokens.colors.gold,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontWeight: "800",
    marginBottom: 10,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 10,
    color: tokens.colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  body: {
    marginTop: 24,
    gap: 16,
  },
  footer: {
    marginTop: 22,
  },
});
