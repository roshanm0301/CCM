import type { ReactElement } from 'react';
import { CheckCircle, Error, Warning, Info } from '@mui/icons-material';
import type { NotificationVariant } from './snackbar.types';

export const getVariantIcon = (variant: NotificationVariant | undefined): ReactElement => {
    const sx = { color: '#fff', fontSize: '20px', width: '20px', height: '20px' };
    switch (variant) {
        case 'success':
            return <CheckCircle sx={sx} />;
        case 'error':
            return <Error sx={sx} />;
        case 'warning':
            return <Warning sx={sx} />;
        case 'info':
            return <Info sx={sx} />;
        default:
            return <Info sx={sx} />;
    }
};
