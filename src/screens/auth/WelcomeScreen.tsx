import { Redirect, useRouter } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthShell } from "@/src/components/auth/AuthShell";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";
import { getFriendlyApiError } from "@/src/lib/api/error-display";

const slides = [
  {
    id: "beauty",
    title: "Find trusted beauty and care",
    subtitle:
      "Discover polished services, compare clearly, and book without the rushed feel of a marketplace.",
    image: require("../../../assets/bookmiz/manicure.png"),
    badgeLeft: "nails",
    badgeRight: "tune",
  },
  {
    id: "booking",
    title: "Book fast and keep it elegant",
    subtitle:
      "From first search to final confirmation, every step is built to feel cleaner, warmer, and easier on mobile.",
    image: require("../../../assets/bookmiz/barber.png"),
    badgeLeft: "calendar-check",
    badgeRight: "sparkles",
  },
  {
    id: "trust",
    title: "Come back to providers you trust",
    subtitle:
      "High-quality profiles, fast replies, and a calmer way to manage appointments that fit your routine.",
    image: require("../../../assets/bookmiz/hospital.png"),
    badgeLeft: "heart-circle-check",
    badgeRight: "shield-heart",
  },
] as const;

export function WelcomeScreen() {
  const router = useRouter();
  const session = useSession();
  const scrollRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const frameWidth = Math.max(width - 40, 280);
  const slide = useMemo(() => slides[activeIndex], [activeIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % slides.length;
        scrollRef.current?.scrollTo({ x: frameWidth * next, animated: true });
        return next;
      });
    }, 3600);

    return () => clearInterval(timer);
  }, [frameWidth]);

  if (session.isHydrating) {
    return null;
  }

  if (session.isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / frameWidth);
    setActiveIndex(nextIndex);
  };

  return (
    <AuthShell
      brandTagline="Book beautifully"
      heroMedia={
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {slides.map((item) => (
            <View key={item.id} style={[styles.slide, { width: frameWidth }]}>
              <View style={styles.slideFrame}>
                <View style={styles.badgeLeft}>
                  <IconBadge name={item.badgeLeft} color="#7a2cf2" />
                </View>
                <View style={styles.badgeRight}>
                  <IconBadge name={item.badgeRight} color="#6f5e1c" warm />
                </View>
                <View style={styles.slideImageWrap}>
                  <View style={styles.slideImageShell}>
                    <View style={styles.slideImageInset}>
                      <Image source={item.image} style={styles.slideImage} />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      }
      topAccent={
        <View style={styles.progressRow}>
          {slides.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setActiveIndex(index);
                scrollRef.current?.scrollTo({ x: frameWidth * index, animated: true });
              }}
              style={[
                styles.progressDot,
                index === activeIndex ? styles.progressDotActive : null,
              ]}
            />
          ))}
        </View>
      }
      title={slide.title}
      subtitle={slide.subtitle}
    >
      {session.authError ? <View style={{gap:8}}>
        <Text accessibilityRole="alert">{retryError || session.authError}</Text>
        <AuthButton label={retrying ? "Reconnecting…" : "Retry connection"} disabled={retrying} variant="secondary" onPress={async()=>{
          setRetrying(true);setRetryError(null);
          try { await session.refreshProfile(); }
          catch(error) { setRetryError(getFriendlyApiError(error,"Could not reconnect. Please try again.")); }
          finally { setRetrying(false); }
        }}/>
      </View> : null}
      <AuthButton label="Get Started" onPress={() => router.push("/signup")} />
      <AuthButton
        label="Login"
        variant="secondary"
        onPress={() => router.push("/login")}
      />
    </AuthShell>
  );
}

function IconBadge({
  name,
  color,
  warm = false,
}: {
  name: React.ComponentProps<typeof FontAwesome6>["name"];
  color: string;
  warm?: boolean;
}) {
  return (
    <View style={[styles.badgeShell, warm ? styles.badgeShellWarm : styles.badgeShellCool]}>
      <FontAwesome6 name={name} size={16} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    height: 286,
  },
  slideFrame: {
    flex: 1,
    justifyContent: "center",
  },
  slideImageWrap: {
    flex: 1,
    justifyContent: "center",
  },
  slideImageShell: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  slideImageInset: {
    flex: 1,
    borderRadius: 34,
    overflow: "hidden",
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  badgeShell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0d1830",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  badgeShellCool: {
    backgroundColor: "#ffffff",
  },
  badgeShellWarm: {
    backgroundColor: "#fff6d8",
  },
  badgeLeft: {
    position: "absolute",
    left: 18,
    bottom: 18,
    zIndex: 3,
  },
  badgeRight: {
    position: "absolute",
    right: 18,
    top: 18,
    zIndex: 3,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  progressDotActive: {
    width: 28,
    backgroundColor: tokens.colors.brand,
  },
});
