import { styled } from "@mui/material";
import { ReactNode } from "react";

interface IMuiBorderBottomProps {
    children?: ReactNode;
    [key: string]: unknown;
}

const Root = styled('div')(({ theme }) => ({
    borderBottom: "1px solid rgba(217, 217, 217, 1)",
    marginBottom: "10px",
    width: "100%",
}));

export const MuiBorderBottom = (props: IMuiBorderBottomProps) => {
    const { children, ...other } = props

    return (
        <Root>
            {children}
        </Root>
    )
}
