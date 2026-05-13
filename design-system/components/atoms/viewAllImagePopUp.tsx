import { Dialog, DialogContent, DialogTitle, Grid, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';
import { MuiImagePopUp } from './imageDialogBox';

interface IViewAllImages {
    isOpen: boolean;
    onClosed: (value: boolean) => void;
    images: Array<{ images?: string; blobUrl?: string }>;
}

export default function ViewAllImagePopUp(props: IViewAllImages) {
    const { isOpen, onClosed, images } = props;
    const [isDrawerOpen, setISDrawerOpen] = useState<number | null>(null);

    const handleClickImage = (photoIndex: number) => {
        setISDrawerOpen(photoIndex);
    };
    const handleClose = () => {
        setISDrawerOpen(null);
    };

    return (
        <Dialog
            open={isOpen}
            onClose={() => onClosed(false)}
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, px: 2 }}>
                View All Images
                <IconButton onClick={() => onClosed(false)} size="small" aria-label="Close">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ width: '100%', padding: '2px 5px 8px 5px' }}>
                <Grid container alignItems="center" spacing={1}>
                    {images?.map((image, index) => (
                        <Grid item key={index + 1} xs={4} sm={4} md={4} lg={4} style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <img
                                    src={image.images ?? image.blobUrl ?? ''}
                                    alt={`Image ${index + 1}`}
                                    style={{ width: '100px', height: '100px', borderRadius: '8px', position: 'relative', cursor: 'pointer' }}
                                    onClick={() => handleClickImage(index)}
                                />
                            </div>
                            {isDrawerOpen !== null && (
                                <MuiImagePopUp
                                    isOpen={index === isDrawerOpen}
                                    onClose={handleClose}
                                    image={image.images ?? image.blobUrl ?? ''}
                                />
                            )}
                        </Grid>
                    ))}
                </Grid>
            </DialogContent>
        </Dialog>
    );
}
