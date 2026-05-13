export const NOTIFICATION_DURATIONS = {
    SUCCESS: 3000,
    ERROR: 7000,
    WARNING: 5000,
    INFO: 4000,
} as const;

export const VARIANTS = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
} as const;

export const MAX_NOTIFICATIONS = 5;

export const NOTIFICATION_POSITION = {
    VERTICAL: 'top' as const,
    HORIZONTAL: 'right' as const,
} as const;

export const getAutoHideDuration = (type: string) => {
    switch (type) {
        case VARIANTS.SUCCESS:
            return NOTIFICATION_DURATIONS.SUCCESS;
        case VARIANTS.ERROR:
            return NOTIFICATION_DURATIONS.ERROR;
        case VARIANTS.WARNING:
            return NOTIFICATION_DURATIONS.WARNING;
        case VARIANTS.INFO:
            return NOTIFICATION_DURATIONS.INFO;
        default:
            return NOTIFICATION_DURATIONS.ERROR;
    }
}

export const NOTIFICATION_Z_INDEX = 9999;

export const NOTIFICATION_TITLES = {
    SUCCESS: 'Success',
    ERROR: 'Error',
    WARNING: 'Warning',
    INFO: 'Information',
    HEX_UPDATE: 'Hex Update',
    RECALL_UPDATE: 'Recall Warning',
    VALIDATION_ERROR: 'Validation Error',
};

export const NOTIFICATION_MESSAGES = {
    VEHICLE_UNDER_RECALL: 'This vehicle is under recall',
    HEX_FILE_UPDATE_REQUIRED: 'Hex file update required',
};
