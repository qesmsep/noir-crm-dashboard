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
});

export { theme }; 