'use client';
import { extendTheme } from "@chakra-ui/react";

const colors = {
  weddingDay: "#ECEDE8",
  cork: "#A59480",
  daybreak: "#CAC2B9",
  greige: "#ABA8A1",
  nightSky: "#353535",
};

const theme = extendTheme({
  colors,
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: "weddingDay",
        color: "nightSky",
      },
    },
  },
  components: {
    Box: {
      baseStyle: {
        borderRadius: "2xl",
      },
    },
    VStack: {
      baseStyle: {
        spacing: "0",
      },
    },
  },
  radii: {
    none: "0",
    sm: "0.125rem",
    base: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    "3xl": "1.5rem",
    full: "9999px",
  },
});

export { theme }; 