import type { PaletteColor, PaletteOptions } from "@mui/material";
import { aqua, info, primary, error, green, mint, secondary, purple, rose, success, warning } from "./colors";
import type { AllColorVariants } from "./augmentations";
import "./augmentations"; // ensure module augmentations (TypeText.tertiary) are loaded

export const white = "#ffffff";
export const black = "#000000";

const palette: PaletteOptions = {
    primary: {
        contrastText: '#fff',
        main: primary[500],
        light: primary[50],
        dark: primary[900],
        ...primary
    },
    secondary: {
        main: secondary[500],
        contrastText: '#fff',
        light: secondary[50],
        dark: secondary[900],
        ...secondary
    },
    text: {
        primary: secondary[900],
        secondary: secondary[600],
        tertiary: secondary[500],
        disabled: secondary[300],
    },
    info: {
        main: info[500],
        contrastText: '#fff',
        light: info[50],
        dark: info[900],
        ...info
    },
    warning: {
        main: warning[500],
        contrastText: '#fff',
        light: warning[50],
        dark: warning[900],
        ...warning
    },
    error: {
        main: error[500],
        contrastText: '#fff',
        light: error[50],
        dark: error[900],
        ...error
    },
    success: {
        main: success[500],
        contrastText: '#fff',
        light: success[50],
        dark: success[900],
        ...success
    },
    purple: {
        main: purple[500],
        contrastText: '#fff',
        dark: purple[900],
        light: purple[50],
        ...purple
    },
    aqua: {
        main: aqua[500],
        contrastText: '#fff',
        dark: aqua[900],
        light: aqua[50],
        ...aqua
    },
    mint: {
        main: mint[500],
        contrastText: '#fff',
        dark: mint[900],
        light: mint[50],
        ...mint
    },
    green: {
        main: green[500],
        contrastText: '#fff',
        dark: green[900],
        light: green[50],
        ...green
    },
    rose: {
        main: rose[500],
        contrastText: '#fff',
        dark: rose[900],
        light: rose[50],
        ...rose
    },
    background: {
        default: secondary[50],
        paper: '#fff',
        secondary: secondary[50],
    },
};

export default palette;

type MoreColors = Partial<Record<keyof AllColorVariants, PaletteColor>>

declare module '@mui/material/styles' {
    interface Palette extends MoreColors { }

    interface PaletteOptions extends MoreColors { }

    interface TypeBackground {
        secondary: string
    }
}