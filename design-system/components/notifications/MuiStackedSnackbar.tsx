import { Alert, alertClasses, AlertColor, Box, Snackbar, Typography } from '@mui/material';
import { forwardRef } from 'react';
import { getAutoHideDuration, VARIANTS } from './entity';
import { MuiStackedSnackbarProps } from './snackbar.types';
import { getVariantIcon } from './utils';

export const MuiStackedSnackbar = forwardRef<HTMLDivElement, MuiStackedSnackbarProps>(function MuiStackedSnackbar(props, ref) {
    const { id, message, title, variant, onClose } = props;

    const handleClose = () => onClose(id);
    const autoHideDuration = getAutoHideDuration(variant ?? VARIANTS.INFO);

    const handleSnackbarClose = (event: React.SyntheticEvent | Event, reason?: string) => {
        if (reason !== 'clickaway') {
            onClose(id);
        }
    };

    return (
        <Snackbar
            ref={ref}
            open={true}
            autoHideDuration={autoHideDuration}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            onClose={handleSnackbarClose}
            sx={{
                width: '100%',
                maxWidth: '650px',
                position: 'static', 
                margin: 0,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            <Alert
                elevation={6}
                variant="filled"
                icon={getVariantIcon(variant)}
                onClose={handleClose}
                severity={variant as AlertColor}
                sx={{
                    width: '100%',
                    // bgcolor: `${variant}.main`,
                    bgcolor: variant === VARIANTS.SUCCESS ? '#0052ff' : `${variant}.main`,
                    color: 'white',
                    padding: '12px 16px',
                    alignItems: 'center',
                    [`.${alertClasses.action}`]: {
                        alignItems: "center",
                    },
                    [`.${alertClasses.icon}`]: {
                        alignItems: "center",
                        color: 'white',
                        fontSize: '15px',
                        marginRight: '8px'
                    },
                    '& .MuiAlert-message': {
                        padding: 0,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center'
                    }
                }}
            >
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: title ? 0.5 : 0,
                    justifyContent: title ? 'flex-start' : 'center',
                    minHeight: title ? 'auto' : '24px',
                    alignItems: title ? 'flex-start' : 'center'
                }}>
                    {title && (
                        <Typography
                            // variant="h5" 
                            fontWeight={600}
                            sx={{
                                fontSize: '16px',
                                lineHeight: 1.2,
                                color: 'white',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word'
                            }}
                        >
                            {title}
                        </Typography>
                    )}
                    <Typography
                        fontWeight={'medium'}
                        sx={{
                            color: '#fff',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word'
                        }}
                    >
                        {message}
                    </Typography>
                </Box>
            </Alert>
        </Snackbar>
    );
});

export const MuiSnackbarToaster = () => null;
