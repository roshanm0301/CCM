import { ButtonPropsSizeOverrides } from "@mui/material"

declare module '@mui/material' {
    interface ButtonPropsSizeOverrides {
        icon: true
    }
}