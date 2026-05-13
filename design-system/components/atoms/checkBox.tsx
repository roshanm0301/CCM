import { FormControlLabel, Checkbox, FormControlLabelProps, SxProps, Theme } from '@mui/material';

interface IMuiCheckBoxProps {
    checkBoxValue: boolean;
    handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    label?: React.ReactNode;
    labelPlacement?: FormControlLabelProps['labelPlacement'];
    sx?: SxProps<Theme>;
    disabled?: boolean;
    id?: string;
}

export const MuiCheckBox = (props: IMuiCheckBoxProps) => {
    const { checkBoxValue, handleChange, label = '', labelPlacement = 'end' ,sx,disabled,id} = props
    
    return (
        <FormControlLabel
            control={
                <Checkbox disabled={disabled} checked={checkBoxValue} onChange={handleChange} id={id}/>
            }
            label={label}
            labelPlacement={labelPlacement}
            sx={sx}
        />
    )
}
