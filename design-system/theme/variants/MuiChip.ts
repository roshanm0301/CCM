import type { Components, Theme } from "@mui/material"
import type { AllColorVariants } from "../augmentations"
import Colors from "../colors"

declare module '@mui/material' {
    interface ChipPropsSizeOverrides {
        large: true
    }

    interface ChipPropsColorOverrides extends AllColorVariants { }
    interface ChipOwnProps {
        shape?: 'square' | 'rounded' | 'circular'
    }
}

export const MuiChipTheme: Components<Theme>['MuiChip'] = {
    styleOverrides: {
        label: ({ theme }) => theme.unstable_sx({
            p: 0, fontWeight: 'medium', whiteSpace: 'normal'
        }),
        root: ({ theme }) => theme.unstable_sx({
            height: 'fit-content',
            width: 'auto',
            fontWeight: 'medium',
        }),
        deleteIconSmall: ({ theme }) => theme.unstable_sx({
            width: '16px', height: '16px',
            m: 0, mr: -0.5
        }),
        icon: ({ theme }) => theme.unstable_sx({
            m: 0, ml: -0.5
        }),
    },
    defaultProps: {
        size: 'small',
    },
    variants: [
        //Colors
        {
            props: {
                color: "error",
            },
            style: {
                borderColor: Colors.error[200],
                color: Colors.error[500],
                backgroundColor: Colors.error[50],
            },
        },
        {
            props: {
                color: "success",
            },
            style: {
                color: Colors.success[500],
                borderColor: Colors.success[200],
                backgroundColor: Colors.success[50],
            },
        },
        {
            props: {
                color: "warning",
            },
            style: {
                color: Colors.warning[500],
                borderColor: Colors.warning[200],
                backgroundColor: Colors.warning[50],
            },
        },
        {
            props: {
                color: "primary",
            },
            style: {
                color: Colors.primary[500],
                borderColor: Colors.primary[200],
                backgroundColor: Colors.primary[50],
            },
        },
        {
            props: {
                color: 'info'
            },
            style: {
                color: Colors.info[500],
                borderColor: Colors.info[200],
                backgroundColor: Colors.info[50]
            }
        },
        {
            props: {
                color: 'aqua'
            },
            style: {
                color: Colors.aqua[500],
                borderColor: Colors.aqua[200],
                backgroundColor: Colors.aqua[50]
            }
        },
        {
            props: {
                color: 'green'
            },
            style: {
                color: Colors.green[500],
                borderColor: Colors.green[200],
                backgroundColor: Colors.green[50]
            }
        },
        {
            props: {
                color: 'mint'
            },
            style: {
                color: Colors.mint[500],
                borderColor: Colors.mint[200],
                backgroundColor: Colors.mint[50]
            }
        },
        {
            props: {
                color: 'purple'
            },
            style: {
                color: Colors.purple[500],
                borderColor: Colors.purple[200],
                backgroundColor: Colors.purple[50]
            }
        },
        {
            props: {
                color: 'rose'
            },
            style: {
                color: Colors.rose[500],
                borderColor: Colors.rose[200],
                backgroundColor: Colors.rose[50]
            }
        },
        {
            props: {
                color: 'secondary'
            },
            style: {
                color: Colors.secondary[500],
                borderColor: Colors.secondary[200],
                backgroundColor: Colors.secondary[50]
            }
        },

        //Variant
        {
            props: {
                variant: "filled",
            },
            style: {
                borderRadius: "9999px",
                borderWidth: "1px",
                borderStyle: "solid",
            },
        },
        {
            props: {
                variant: "outlined",
            },
            style: {
                background: "none",
                borderRadius: "9999px",
                borderWidth: "1px",
                borderStyle: "solid",
            },
        },

        //Shape
        {
            props: {
                shape: 'circular',
            },
            style: {
                borderRadius: "9999px",
            },
        },
        {
            props: {
                shape: 'rounded',
            },
            style: {
                borderRadius: "6px",
            },
        },
        {
            props: {
                shape: 'rounded', size: 'large',
            },
            style: {
                borderRadius: "8px",
            },
        },
        {
            props: {
                shape: 'square',
            },
            style: {
                borderRadius: "0px",
            },
        },

        //Size
        {
            props: {
                size: "small",
            },
            style: {
                padding: "2px 8px",
                lineHeight: "18px",
                fontSize: "12px",
                gap: '4px'
            },
        },
        {
            props: {
                size: "medium",
            },
            style: {
                padding: "2px 10px",
                lineHeight: "20px",
                fontSize: "14px",
                gap: '6px'
            },
        },
        {
            props: {
                size: 'large'
            },
            style: {
                padding: '4px 12px',
                lineHeight: '20px',
                fontSize: '14px',
                gap: '6px'
            }
        },
    ],
}
