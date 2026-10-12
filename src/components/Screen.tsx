import { StatusBar } from "expo-status-bar";
import type { PropsWithChildren, ReactNode } from "react";
import {
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { tokens } from "@/src/theme/tokens";

type ScreenProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  subtitle: string;
  heroTopContent?: ReactNode;
  heroContent?: ReactNode;
  contentTopOffset?: number;
  heroBottomPadding?: number;
  heroMinHeight?: number;
}>;

export function Screen({
  eyebrow,
  title,
  subtitle,
  heroTopContent,
  heroContent,
  contentTopOffset = 20,
  heroBottomPadding = 34,
  heroMinHeight = 292,
  children,
}: ScreenProps) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground
        source={require("../../assets/bookmiz/hero-bg.jpg")}
        resizeMode="cover"
        style={[styles.hero, { minHeight: heroMinHeight }]}
        imageStyle={styles.heroImage}
      >
        <View style={[styles.heroOverlay, { paddingBottom: heroBottomPadding }]}>
          <SafeAreaView>
            <View style={styles.heroInner}>
              {heroTopContent ? <View style={styles.heroTopContent}>{heroTopContent}</View> : null}
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              {heroContent ? <View style={styles.heroContent}>{heroContent}</View> : null}
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>
      <View style={styles.sheet}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: contentTopOffset }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  hero: {
    minHeight: 292,
    backgroundColor: tokens.colors.ink,
  },
  heroImage: {
    opacity: 0.24,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: "rgba(12,29,54,0.78)",
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  heroInner: {
    paddingTop: 18,
    gap: 12,
  },
  heroTopContent: {
    marginBottom: 4,
  },
  eyebrow: {
    color: tokens.colors.gold,
    fontSize: 12,
    letterSpacing: 3,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  title: {
    color: "#fff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -1.3,
  },
  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    lineHeight: 23,
  },
  heroContent: {
    marginTop: 8,
  },
  sheet: {
    flex: 1,
    marginTop: -18,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: tokens.colors.surfaceSoft,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 120,
    gap: 20,
  },
});
