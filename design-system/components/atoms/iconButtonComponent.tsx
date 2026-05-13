import { IconButton, IconButtonProps } from "@mui/material";

export const MuiIconButton = (props: IconButtonProps) => {
    const { children, sx, size, color, className, onClick, ...other } = props;

    return (
        <IconButton
            className={className}
            onClick={onClick}
            size={size || "medium"}
            sx={sx || { color: color || "black" }}
            {...other}
        >
            {children}
        </IconButton>
    );
}

