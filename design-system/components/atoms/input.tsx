import { FormControl, styled } from '@mui/material';
import TextField, { TextFieldProps } from '@mui/material/TextField';

//Examples
{/* <InputBox
name="UserName"
onChange={onUserNameChange}
type="text" //button, text, checkbox, password
size="small"
label="UserName"
value={userNameValue}
fullWidth={true}
disabled={false}
/> */}

const InputField = styled(TextField)(({ theme }) => ({
    "& .MuiInputBase-root.Mui-disabled": {
        "& > fieldset": {
            border: '1px solid #DEE4EB',
            boxShadow: '0px 1px 2px 0px rgba(16, 24, 40, 0.05)'
        },
        backgroundColor: "#F4F7FA",
        borderRadius: '8px'
    },
  
    "& fieldset": { border: '1px solid #DEE4EB',borderRadius:'8px'}
}))
export const InputBox = (props: TextFieldProps) => {
    const {
        name,
        type,
        label,
        value,
        onChange,
        fullWidth,
        disabled,
        placeholder,
        inputProps,
        className,
        size,
        helperText,
        error,
        sx,
        InputProps,
        id,
        onBlur,
        ...others
    } = props;

    return (
        <FormControl fullWidth={fullWidth} style={{ margin: 0 }}>
            <InputField
                id={id}
                error={error}
                variant="outlined"
                label={label}
                placeholder={placeholder}
                autoComplete="none"
                name={name}
                type={type || "text"}
                value={value}
                fullWidth={fullWidth}
                onChange={onChange}
                onBlur={onBlur}
                disabled={disabled}
                InputProps={InputProps}
                className={className}
                size={size}
                helperText={helperText || null}
                sx={sx}
                inputProps={inputProps}
                {...(error && { error: true, helperText: helperText ? helperText : error})}
                style={{ margin: 0 }}
                {...others}
            />
        </FormControl>

    )
}