import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionSummary, Chip, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { SxProps, Theme } from '@mui/material';

interface IBadgeProps {
    label: string;
    color: 'warning' | 'info';
    colorValue: string;
}

interface IMuiAccordionWithBadgeProps {
    title?: string;
    style?: SxProps<Theme>;
    children?: ReactNode;
    onClick?: () => void;
    titleVariant?: React.ComponentProps<typeof Typography>['variant'];
    showBadge?: boolean;
    label?: string;
    badgeColor?: 'warning' | 'info';
    badgeColorValue?: string;
}

export default function MuiAccordionWithBadge(props: IMuiAccordionWithBadgeProps) {
    const { title = 'Accordion', style, children, onClick, titleVariant, showBadge, label, badgeColor = 'warning', badgeColorValue } = props;

    const BadgeChip: FC<IBadgeProps> = ({ label, color, colorValue }) => (
        <Chip label={label} size="small" variant="filled" color={color} sx={{ color: colorValue, border: 1 }} />
    );

    return (
        <Accordion sx={style} disableGutters>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                onClick={onClick}
                aria-controls="panel1a-content"
                id="panel1a-header"
            >
                <Typography sx={{ width: "100%" }} fontWeight={"strong"}>{title}</Typography>
                {showBadge && label != null && badgeColorValue != null && (
                    <BadgeChip label={label} color={badgeColor} colorValue={badgeColorValue} />
                )}

            </AccordionSummary>
            {children}
        </Accordion>
    )
}
