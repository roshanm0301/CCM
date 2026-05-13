import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionSummary, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { SxProps, Theme } from '@mui/material';

interface IMuiAccordionProps {
    title?: string;
    style?: SxProps<Theme>;
    children?: ReactNode;
    onClick?: () => void;
    titleVariant?: React.ComponentProps<typeof Typography>['variant'];
}

export default function MuiAccordion(props: IMuiAccordionProps) {
    const { title = 'Accordion', style, children, onClick, titleVariant } = props;
    return (
        <Accordion sx={style}>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                onClick={onClick}
                aria-controls="panel1a-content"
                id="panel1a-header"

            >
                <Typography sx={{ width: "100%" }} variant={titleVariant ?? 'body1'}>{title}</Typography>
            </AccordionSummary>
            {children}
        </Accordion>
    )
}
