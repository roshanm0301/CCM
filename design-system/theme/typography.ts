
import { createTheme } from "@mui/material";
import type { ThemeOptions } from "@mui/material";

declare module '@mui/material/styles' {
  interface TypeText {
    tertiary: string
  }
}

export const FontWeightVariants = {
  normal: {
    fontFamily: 'NotoSans-Regular',
    fontWeight: 400,
  },
  medium: {
    fontFamily: 'NotoSans-Medium',
    fontWeight: 500,
  },
  strong: {
    fontFamily: 'NotoSans-SemiBold',
    fontWeight: 600,
  },
}

export const FontSizeVariants = {
  xs: {
    fontSize: '10px',
    lineHeight: '16px',
  },
  sm: {
    fontSize: '12px',
    lineHeight: '18px',
  },
  lg: {
    fontSize: '16px',
    lineHeight: '24px',
  },
  xl: {
    fontSize: '18px',
    lineHeight: '28px',
  },
  xxl: {
    fontSize: '20px',
    lineHeight: '28px',
  },
  base: {
    fontSize: '14px',
    lineHeight: '20px',
  },
}

export type FontWeightTypes = keyof typeof FontWeightVariants
export type FontSizeTypes = keyof typeof FontSizeVariants

const theme = createTheme()
const typography: ThemeOptions['typography'] = (palette) => ({
  fontFamily: "NotoSans-Regular",
  fontWeightBold: 600,
  fontWeightMedium: 500,
  fontWeightRegular: 400,
  fontSize: 14,
  allVariants: {
    wordWrap: "break-word"
  },
  h1: {
    fontSize: "20px",
    fontFamily: 'NotoSans-SemiBold',
  },
  h2: {
    fontSize: "18px",
    fontFamily: 'NotoSans-Medium',
  },
  h3: {
    fontSize: "16px",
    fontFamily: 'NotoSans-Medium',
  },
  h4: {
    fontSize: "16px",
  },
  h5: {
    fontSize: "14px",
    fontFamily: 'NotoSans-SemiBold',
    [theme.breakpoints.down('sm')]: {
      fontSize: '12px',
    },

    wordWrap: "break-word"
  },
  h6: {
    fontSize: "14px",
    fontFamily: 'NotoSans-Regular',
    [theme.breakpoints.down('sm')]: {
      fontSize: '12px',
    },

    wordWrap: "break-word"
  },

  subtitle1: {
    fontSize: "12px",
    fontFamily: 'NotoSans-SemiBold',
    wordWrap: "break-word"
  },
  subtitle2: {
    fontSize: "12px",
    fontFamily: 'NotoSans-Medium',
  },
  body1: {
    fontSize: '14px',
  },
  body2: {
    fontSize: "16px",
    wordWrap: "break-word"
  },
  caption: {
    fontSize: "12px",
  },
})

export default typography;

