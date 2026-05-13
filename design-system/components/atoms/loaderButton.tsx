import { Button, CircularProgress, type ButtonProps } from "@mui/material";

export interface LoadingButtonProps extends ButtonProps {
    loading?: boolean;
    name?: string;
}

export const MuiLoaderButton = (props: LoadingButtonProps) => {
    const { name = "Button", size = "small", variant = "outlined", loading = false, disabled, startIcon, ...other } = props;

    return (
        <Button
            variant={variant}
            size={size}
            id={name}
            disabled={disabled ?? loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
            {...other}
        >
            {name}
        </Button>
    );
};