import { Dialog, DialogContent } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export const MuiImagePopUp = (props: any) => {
    const { onClose, isOpen, image } = props
    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth sx={{ background: 'none', width: '100%', height: '100%', zIndex: 1300 }}>
            <DialogContent style={{ padding: 0, display: 'flex', justifyContent: 'center' }}>
                {image &&
                    <>
                        <CloseIcon
                            id='img-close-btn'
                            onClick={onClose}
                            role="button"
                            aria-label="Close"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
                            sx={{ position: 'absolute', zIndex: 1, right: 10, top: 8, color: 'white', height: '20px', width: '20px', borderRadius: 50, cursor: 'pointer' }}
                        />
                        <img src={image} width={'100%'} height={"100%"} alt="close" />
                    </>
                }
            </DialogContent>
        </Dialog>

    )
}

export const MuiVideoPopUp = (props: any) => {
    const { onClose, isOpen, video } = props
    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth sx={{ background: 'none', width: '100%', height: '100%', zIndex: 1300 }}>
            <DialogContent style={{ padding: 0, display: 'flex', justifyContent: 'center' }}>
                {video &&
                    <video src={video} width={'100%'} height={"100%"} />
                }
            </DialogContent>
        </Dialog>
    )
}
