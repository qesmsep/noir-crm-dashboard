/**
 * Apple-inspired Chakra UI Theme
 * Clean, minimal, sophisticated design matching apple.com aesthetic
 */

import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import { designTokens } from './styles/design-tokens';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

// Custom colors maintaining Noir brand while adding Apple polish
const colors = {
  // Noir brand colors
  noir: {
    cream: '#ECEDE8',
    cork: '#A59480',
    daybreak: '#CAC2B9',
    greige: '#ABA8A1',
    night: '#353535',
    black: '#1A1A1A',
  },

  // Extended gray palette (Apple-style)
  ...designTokens.colors,
};

const fonts = {
  heading: designTokens.fonts.sans,
  body: designTokens.fonts.sans,
  mono: designTokens.fonts.mono,
};

const fontSizes = designTokens.fontSizes;

const fontWeights = {
  hairline: 100,
  thin: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

// Component style overrides
const components = {
  Button: {
    baseStyle: {
      fontWeight: 'medium',
      borderRadius: 'lg',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      _focus: {
        boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.5)',
      },
    },
    sizes: {
      sm: {
        h: '32px',
        px: 4,
        fontSize: 'sm',
      },
      md: {
        h: '40px',
        px: 6,
        fontSize: 'md',
      },
      lg: {
        h: '48px',
        px: 8,
        fontSize: 'lg',
      },
      xl: {
        h: '56px',
        px: 10,
        fontSize: 'xl',
      },
    },
    variants: {
      solid: {
        bg: 'primary.600',
        color: 'white',
        _hover: {
          bg: 'primary.700',
          transform: 'translateY(-1px)',
          boxShadow: 'md',
        },
        _active: {
          bg: 'primary.800',
          transform: 'translateY(0)',
        },
      },
      ghost: {
        _hover: {
          bg: 'gray.100',
        },
      },
      outline: {
        borderWidth: '1.5px',
        borderColor: 'gray.300',
        _hover: {
          borderColor: 'gray.400',
          bg: 'gray.50',
        },
      },
    },
    defaultProps: {
      colorScheme: 'primary',
    },
  },

  Input: {
    baseStyle: {
      field: {
        borderRadius: 'lg',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
    sizes: {
      sm: {
        field: {
          h: '32px',
          px: 3,
          fontSize: 'sm',
        },
      },
      md: {
        field: {
          h: '40px',
          px: 4,
          fontSize: 'md',
        },
      },
      lg: {
        field: {
          h: '48px',
          px: 5,
          fontSize: 'lg',
        },
      },
    },
    variants: {
      outline: {
        field: {
          borderWidth: '1.5px',
          borderColor: 'gray.300',
          bg: 'white',
          _hover: {
            borderColor: 'gray.400',
          },
          _focus: {
            borderColor: 'primary.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-primary-500)',
          },
          _placeholder: {
            color: 'gray.400',
          },
        },
      },
      filled: {
        field: {
          bg: 'gray.100',
          borderWidth: '1px',
          borderColor: 'transparent',
          _hover: {
            bg: 'gray.200',
          },
          _focus: {
            bg: 'white',
            borderColor: 'primary.500',
          },
        },
      },
    },
    defaultProps: {
      variant: 'outline',
    },
  },

  Select: {
    baseStyle: {
      field: {
        borderRadius: 'lg',
      },
    },
    variants: {
      outline: {
        field: {
          borderWidth: '1.5px',
          borderColor: 'gray.300',
          _hover: {
            borderColor: 'gray.400',
          },
          _focus: {
            borderColor: 'primary.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-primary-500)',
          },
        },
      },
    },
  },

  Textarea: {
    baseStyle: {
      borderRadius: 'lg',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    variants: {
      outline: {
        borderWidth: '1.5px',
        borderColor: 'gray.300',
        _hover: {
          borderColor: 'gray.400',
        },
        _focus: {
          borderColor: 'primary.500',
          boxShadow: '0 0 0 1px var(--chakra-colors-primary-500)',
        },
      },
    },
  },

  Card: {
    baseStyle: {
      container: {
        borderRadius: '2xl',
        boxShadow: 'sm',
        bg: 'white',
        overflow: 'hidden',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        _hover: {
          boxShadow: 'md',
          transform: 'translateY(-2px)',
        },
      },
    },
    variants: {
      elevated: {
        container: {
          boxShadow: 'lg',
        },
      },
      outline: {
        container: {
          borderWidth: '1.5px',
          borderColor: 'gray.200',
          boxShadow: 'none',
        },
      },
    },
  },

  Modal: {
    baseStyle: {
      dialog: {
        borderRadius: '2xl',
        boxShadow: '2xl',
      },
      closeButton: {
        borderRadius: 'full',
        top: 4,
        right: 4,
        _hover: {
          bg: 'gray.100',
        },
      },
    },
  },

  Drawer: {
    baseStyle: {
      dialog: {
        bg: 'white',
      },
      closeButton: {
        borderRadius: 'full',
        top: 4,
        right: 4,
        _hover: {
          bg: 'gray.100',
        },
      },
    },
  },

  Menu: {
    baseStyle: {
      list: {
        borderRadius: 'xl',
        boxShadow: 'xl',
        border: '1px',
        borderColor: 'gray.200',
        overflow: 'hidden',
        py: 2,
      },
      item: {
        py: 2,
        px: 4,
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        _hover: {
          bg: 'gray.100',
        },
        _focus: {
          bg: 'gray.100',
        },
      },
    },
  },

  Badge: {
    baseStyle: {
      borderRadius: 'full',
      px: 3,
      py: 1,
      fontWeight: 'medium',
      fontSize: 'xs',
      textTransform: 'none',
    },
    variants: {
      subtle: (props: any) => ({
        bg: `${props.colorScheme}.100`,
        color: `${props.colorScheme}.800`,
      }),
    },
  },

  Tabs: {
    variants: {
      line: {
        tab: {
          fontWeight: 'medium',
          color: 'gray.600',
          borderBottomWidth: '2px',
          borderColor: 'transparent',
          mb: '-2px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          _selected: {
            color: 'primary.600',
            borderColor: 'primary.600',
          },
          _hover: {
            color: 'primary.500',
          },
        },
        tablist: {
          borderBottomWidth: '2px',
          borderColor: 'gray.200',
        },
      },
    },
  },

  Tag: {
    baseStyle: {
      container: {
        borderRadius: 'full',
        fontWeight: 'medium',
      },
    },
  },

  Alert: {
    baseStyle: {
      container: {
        borderRadius: 'xl',
      },
    },
  },

  Toast: {
    baseStyle: {
      borderRadius: 'xl',
      boxShadow: 'lg',
    },
  },
};

// Global styles
const styles = {
  global: {
    body: {
      bg: 'gray.50',
      color: 'gray.900',
      fontSize: 'md',
      lineHeight: 'normal',
      fontFeatureSettings: '"kern" 1',
      textRendering: 'optimizeLegibility',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    '*::placeholder': {
      color: 'gray.400',
    },
    '*, *::before, *::after': {
      borderColor: 'gray.200',
    },
    // Scrollbar styling
    '::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '::-webkit-scrollbar-track': {
      bg: 'gray.100',
    },
    '::-webkit-scrollbar-thumb': {
      bg: 'gray.300',
      borderRadius: 'full',
      _hover: {
        bg: 'gray.400',
      },
    },
  },
};

const shadows = {
  ...designTokens.shadows,
  outline: '0 0 0 3px rgba(66, 153, 225, 0.5)',
};

const radii = designTokens.radii;

const transitions = {
  duration: {
    'ultra-fast': '50ms',
    faster: '100ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    'ultra-slow': '500ms',
  },
  easing: {
    'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
    'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
    'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

const appleTheme = extendTheme({
  config,
  colors,
  fonts,
  fontSizes,
  fontWeights,
  components,
  styles,
  shadows,
  radii,
  transitions,
  space: designTokens.spacing,
  zIndices: designTokens.zIndices,
  breakpoints: designTokens.breakpoints,
});

export default appleTheme;
