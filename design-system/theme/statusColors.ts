import { ChipProps } from "@mui/material";

export const STATUS_TYPE_MAP: Record<string, ChipProps['color']> = {

    // Active statuses
    "draft jc": 'info',
    "approval pending": 'info',
    "awaiting for parts": 'info',
    "initiate work": 'info',
    "work started": 'info',
    "final inspection": 'info',
    "invoiced": 'info',
    "inward": 'info',
    "open": 'info',
    "inspection started": 'info',
    "started": 'info',
    "awaiting": 'info',
    "final inspection started": 'info',
    "assigned": 'info',
    "required": 'info',
    "draft": 'info',

    // Incomplete statuses
    "in progress": 'warning',
    "rework": 'warning',
    "scheduled": 'warning',
    "rescheduled": 'warning',
    "reschedule": 'warning',
    "created": 'warning',
    "pending": 'warning',
    "waiting": 'warning',
    "work in progress": 'warning',
    "new": 'warning',

    // Error statuses
    "error": "error",
    "cancelled": "error",
    "delay": "error",
    "rejected": "error",
    'expired': "error",
    'fail': "error",

    // Success statuses
    "ready for work": "success",
    "work completed": "success",
    "workcompleted": "success",
    "inspection completed": "success",
    "ready for invoice": "success",
    "delivered": "success",
    "confirmed": "success",
    "completed": "success",
    "complete": "success",
    "confirmed/ pre jc": "success",
    "approved": "success",
    "accepted": "success",
    "vehicle delivered": "success",
    "issued": "success",
    "active": 'success',
    "pass": 'success',
    "start": 'primary',
    "pause": 'error',

    // CCM Interaction statuses
    "identifying": 'warning',
    "context_confirmed": 'info',
    "wrapup": 'warning',
    "closed": 'success',
    "incomplete": 'error',
};

export const getStatusColor = (status: string): Pick<ChipProps, "color" | "variant"> => {
    const color = STATUS_TYPE_MAP[status?.toLocaleLowerCase().trim() ?? ''] || "secondary";
    return {
        variant: "outlined",
        color,
    };
};