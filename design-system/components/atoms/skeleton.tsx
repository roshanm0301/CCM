import { Skeleton } from "@mui/material";

interface ISkeleton {
    type?: 'circular' | 'rectangular' | 'rounded' | 'text';
}

const SkeletonLoader = (props: ISkeleton) => {
    const { type = "rounded" } = props;
    return (
        <Skeleton variant={type} animation="wave" width="100%" height="100%" sx={{ bgcolor: '#f5f5f0' }} />
    );
};

export default SkeletonLoader;