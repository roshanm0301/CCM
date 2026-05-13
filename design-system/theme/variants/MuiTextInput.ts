import type { Components, ThemeOptions } from "@mui/material";

export const MuiTextFieldTheme: Components<ThemeOptions>['MuiTextField'] = {
    defaultProps: {
        size: 'small',
    },
    variants: [
        {
            props: { size: "small" },
            style: {
                fontSize: "14px",
                lineHeight: "20px",
            },
        },
        {
            props: { size: "medium" },
            style: {
                fontSize: "16px",
                lineHeight: "24px",
            },
        },
    ],
}
