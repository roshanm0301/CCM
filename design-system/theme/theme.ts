import { autocompleteClasses, buttonClasses } from "@mui/material";
import { createTheme } from "@mui/material";
import { handleBreakpoints } from '@mui/system';
import { breakpoints } from "./breakpoints";
import Colors, { error, info, secondary } from "./colors";
import { BorderRadiusVariants } from "./dimensions";
import type { BorderRadiusTypes } from "./dimensions";
import palette from "./palette";
import typography, { FontSizeVariants, FontWeightVariants } from "./typography";
import type { FontSizeTypes, FontWeightTypes } from "./typography";
import { MuiChipTheme } from "./variants";

const theme = createTheme({
  palette: palette,
  typography: typography,
  breakpoints: breakpoints,
  components: {
    // Global baseline: thin scrollbar + WCAG 2.2 AA reduce-motion override.
    // Source: design-system/06-accessibility.md §10
    MuiCssBaseline: {
      styleOverrides: `
        body {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.2) transparent;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `,
    },
    MuiButton: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: "8px",
          minWidth: 'fit-content',
          minHeight: 'fit-content',
          border: 'none !important',
          ...FontWeightVariants.medium
        },
        sizeSmall: {
          padding: '8px 12px',
          gap: '4px',
          ...FontSizeVariants.base
        },
        sizeMedium: {
          padding: '10px 14px',
          gap: '4px',
          ...FontSizeVariants.base
        },
        sizeLarge: {
          padding: '10px 16px',
          gap: '6px',
          ...FontSizeVariants.lg
        },
        // contained: {
        //   border: '1px solid',
        //   borderColor: 'transparent'
        // },
        outlined: ({ ownerState }) => {
          const currColor = ownerState.color ?? 'primary'
          return ({
            outlineOffset: -1,
            outline: '1px solid',
            backgroundColor: 'white',
            outlineColor: currColor !== 'inherit' ? Colors[currColor][200] : 'inherit',
            [`&.${buttonClasses.disabled}`]: {
              outlineColor: secondary[200],
            }
          })
        },
        endIcon: {
          margin: 0,
          fontSize: 20,
          '& >*:nth-of-type(1)': {
            fontSize: 'inherit'
          }
        },
        startIcon: {
          margin: 0,
          fontSize: 20,
          '& >*:nth-of-type(1)': {
            fontSize: 'inherit'
          }
        },

      },
      variants: [
        {
          props: { size: 'icon' },
          style: { padding: '8px' }
        }
      ]
    },

    MuiSelect: {
      defaultProps: {
        color: "primary",
      },
      styleOverrides: {
        select: {
          ...FontSizeVariants.base,
          height: "auto",
        },
        root: {
          borderRadius: "8px",
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: '0px 12px',
          columnGap: '8px',
          borderRadius: '8px',
          backgroundColor: 'white',
          ...FontSizeVariants.lg,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: secondary[200], // Change this to your desired color
          },
          '&.Mui-focused': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: info[200],
              borderWidth: 1
            },
            boxShadow: `0px 0px 0px 4px ${info[500]}3D`,
            '&.Mui-error': {
              boxShadow: `0px 0px 0px 4px ${error[500]}3D`
            }
          },
          '&.Mui-error': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: error[200],
            },
          },
          '&.Mui-disabled': {
            background: secondary[50],
            '& .MuiOutlinedInput-input': {
              WebkitTextFillColor: theme.palette.text.tertiary,
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: secondary[200]
            },
          },
        }),
        input: {
          padding: '8px 0px',
          height: 'auto',
          '&:-webkit-autofill': {
            color: palette.text?.primary,
            WebkitTextFillColor: palette.text?.primary,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text !important'
          }
        },
        sizeSmall: {
          ...FontSizeVariants.base
        },
        notchedOutline: {
          borderWidth: '1px',
          borderColor: secondary[200],
          boxShadow: '0px 1px 2px 0px #1018280D'
        },

      }
    },

    MuiTextField: {
      defaultProps: {
        size: 'small'
      },
      // ...MuiTextFieldTheme
    },

    MuiFormHelperText: {
      styleOverrides: {
        root: ({ theme }) => theme.unstable_sx({
          mx: 0,
        }),

      }
    },

    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: secondary[200],
          "&.Mui-disabled": {
            "color": secondary[200]
          }
        },
      },
    },

    MuiCircularProgress: {
      defaultProps: {
        thickness: 4,
      },
    },

    MuiSvgIcon: {
      defaultProps: {
        sx: { height: 20, width: 20 },
      },
      styleOverrides: {
        colorSecondary: ({ theme }) => theme.unstable_sx({
          color: 'secondary.600'
        })
      }
    },
    MuiAutocomplete: {
      styleOverrides: {
        listbox: {
          padding: '4px 6px',
          [`.${autocompleteClasses.option}`]: {
            padding: '8px',
          }
        },
        option: {
          ...FontSizeVariants.base,
          margin: '1px 0px',
          borderRadius: '6px',
          minHeight: 'auto',
          '&[aria-selected="true"]': {
            backgroundColor: info[50],
          }
        },
        tag: ({ theme }) => theme.unstable_sx({
          mx: 0, maxWidth: '100%'
        }),
        paper: ({ theme }) => theme.unstable_sx({ mt: 0.5, borderRadius: 2 })
      }
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => theme.unstable_sx({
          fontWeight: 'strong', textTransform: 'none', color: 'text.secondary',
          minHeight: 'auto', py: 1.5, px: 0.5, minWidth: 'auto'
        }),
        // textColorSecondary: ({ theme }) => theme.unstable_sx({
        //   '&.Mui-selected': {
        //     color: 'text.primary'
        //   },
        // }),
        // selected: ({ theme, ownerState }) => theme.unstable_sx({
        //   color
        // }),

      }
    },
    MuiTabs: {
      styleOverrides: {
        root: ({ theme }) => theme.unstable_sx({
          minHeight: 'auto'
        }),
        indicator: ({
          theme, indicatorColor
        }) => theme.unstable_sx({
          bgcolor: indicatorColor === 'secondary' ? 'secondary.200' : undefined
        }),
        flexContainer: ({ theme }) => theme.unstable_sx({
          columnGap: 1
        }),
      }
    },
    MuiChip: MuiChipTheme,
    MuiAvatar: {
      defaultProps: {
        imgProps: { loading: 'lazy' }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => theme.unstable_sx({ borderRadius: 1.5 })
      }
    },
    MuiCard: {
      styleOverrides: {
        root: ({
          theme, square
        }) => theme.unstable_sx({
          py: { xs: 1.5, sm: 2 }, px: { xs: 1.5, sm: 2.5 }, gap: { xs: 2, sm: 2.5 },
          borderRadius: !square ? 2 : undefined
        })
      }
    },
    MuiCardHeader: {
      styleOverrides: {
        root: ({ theme }) => theme.unstable_sx({ p: 0 }),
        title: ({ theme }) => theme.unstable_sx({
          fontWeight: 'strong',
          fontSize: 'base',
        }),
        subheader: ({ theme }) => theme.unstable_sx({
          fontSize: 'base',
          color: 'text.tertiary'
        }),
      }
    },
    MuiAccordion: {
      styleOverrides: {
        root: ({
          theme
        }) => theme.unstable_sx({
          borderRadius: 2
        }),
      }
    },
    MuiMenu: {
      styleOverrides: {
        list: ({ theme }) => theme.unstable_sx({ p: 0.5 }),
        paper: ({ theme }) => theme.unstable_sx({ borderRadius: 2 }),
      }
    }
  },
  unstable_sxConfig: {
    fontWeight: {
      style: (props) => {
        const styleFromPropValue = (fontWeight: FontWeightTypes) => FontWeightVariants[fontWeight] ?? { fontWeight }
        return handleBreakpoints(props, props.fontWeight, styleFromPropValue);
      }
    },
    fontSize: {
      style: (props) => {
        const styleFromPropValue = (fontSize: FontSizeTypes) => FontSizeVariants[fontSize] ?? { fontSize }
        return handleBreakpoints(props, props.fontSize, styleFromPropValue);
      }
    },
    borderRadius: {
      style: (props) => {
        const styleFromPropValue = (borderRadius: BorderRadiusTypes) => {
          let radius = BorderRadiusVariants[borderRadius] ?? borderRadius
          if (typeof radius === 'number') {
            return { borderRadius: props.theme.shape.borderRadius * radius }
          }
          return { borderRadius: radius }
        }
        return handleBreakpoints(props, props.borderRadius, styleFromPropValue);
      }
    },
  },
  zIndex: {
    modal: 1200,
    drawer: 1200,
  }
});

export default theme;
