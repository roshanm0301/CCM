
import type {} from '@mui/material';

declare module '@mui/material/styles' {
    interface TypeText {
        tertiary: string;
    }
}

declare module '@mui/material/Button' {
    interface ButtonPropsSizeOverrides {
        icon: true;
    }
}

export interface AllColorVariants {
    primary: true
    secondary: true
    error: true
    warning: true
    info: true
    success: true
    aqua: true
    green: true
    mint: true
    purple: true
    rose: true
}
export interface AllSizeVariants {
    small: true
    medium: true
    large: true
}
