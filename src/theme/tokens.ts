export const tokens = {
  colors: {
    ink: "#132849",
    inkDeep: "#102748",
    navySoft: "#17335c",
    surface: "#f3f6fa",
    surfaceSoft: "#f7f9fc",
    panel: "#ffffff",
    border: "#e3e9f2",
    borderStrong: "#d9e1ec",
    muted: "#55647f",
    mutedSoft: "#9aa8bf",
    brand: "#8ee30f",
    brandDeep: "#3f6b0f",
    brandSoft: "#e6f8c4",
    onNavyMuted: "#c3d0e6",
    success: "#1d7a52",
    successSoft: "#e3f5ea",
    warning: "#7a3d12",
    warningSoft: "#fbeadb",
    danger: "#a33a3a",
    dangerSoft: "#fff5f5",
    highlight: "#ff7a59",
    /** Kept for older screens that used a gold eyebrow; now reads as muted navy. */
    gold: "#55647f",
  },
  radius: {
    pill: 999,
    xl: 28,
    lg: 20,
    md: 14,
    sm: 10,
  },
  /**
   * Font family names as registered in app/_layout.tsx (useFonts).
   * Use fontFamily, not fontWeight: each weight is its own file.
   */
  font: {
    regular: "Figtree-Regular",
    medium: "Figtree-Medium",
    semibold: "Figtree-SemiBold",
    bold: "Figtree-Bold",
    display: "BricolageGrotesque-SemiBold",
    displayBold: "BricolageGrotesque-Bold",
  },
};

export const fontAssets = {
  "Figtree-Regular": require("../../assets/fonts/Figtree-Regular.ttf"),
  "Figtree-Medium": require("../../assets/fonts/Figtree-Medium.ttf"),
  "Figtree-SemiBold": require("../../assets/fonts/Figtree-SemiBold.ttf"),
  "Figtree-Bold": require("../../assets/fonts/Figtree-Bold.ttf"),
  "BricolageGrotesque-SemiBold": require("../../assets/fonts/BricolageGrotesque-SemiBold.ttf"),
  "BricolageGrotesque-Bold": require("../../assets/fonts/BricolageGrotesque-Bold.ttf"),
};
