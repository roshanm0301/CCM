
import { Stack, StackProps } from '@mui/material';

export const MuiStack = (props: StackProps) => {
    const { direction,spacing, justifyContent, alignItems, children, ...other } = props;

    return (
        <Stack
            spacing={spacing}
            direction={direction || 'row'}
            justifyContent={justifyContent || 'start'}
            alignItems={alignItems}
            {...other}
        >
            {children}
        </Stack>
    );
}
