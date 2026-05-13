import Button, { ButtonProps } from '@mui/material/Button';
export const MuiButton = (props: ButtonProps) => {
	const { name = "Button", id = name, size = "small", variant = "outlined", ...other } = props;

	return (
		<Button
			variant={variant}
			size={size}
			id={id}
			{...other}
		>
			{name}
		</Button>
	);
}
