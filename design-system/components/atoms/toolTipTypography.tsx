import { Tooltip, Typography, TypographyProps } from "@mui/material";
import { styled } from "@mui/material";

const Typo = styled(Typography)(({ theme }) => ({
    // maxWidth:"200px"

}));

export const ToolTipTypography = (props: TypographyProps) => {
    let { title, variant, color, ...others } = props;
    const titleStr = typeof title === 'string' ? title : '';
    return (<>{titleStr && titleStr.length > 26 ? <Tooltip title={titleStr || '---'}><Typo noWrap={true} color={color} variant={variant} {...others}>{titleStr || '---'}</Typo></Tooltip> :
        <Typo noWrap color={color} variant={variant} {...others}>{titleStr || '---'}</Typo>}

    </>)
}
