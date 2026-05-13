import {
    FormControl,
    FormHelperText
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { useEffect, useState } from 'react';
import { InputBox } from "./input";


export const MuiSelectSearchComponent = (props: any) => {
    const {
        name,
        label,
        error = null,
        disabled,
        options,
        placeholder,
        displayExpr,
        variant,
        fullWidth,
        onChange,
        width,
        value,
        valueExpr,
        inputValue,
        onInputChange,
        option,
        sx
    } = props;

    const [prevData, setPrevData] = useState<any>()

    useEffect(() => {
        if (value !== "" && options?.length > 0) {
            getValue(options, value)
        }
    }, [value, options?.length > 0, prevData])

    const getValue = (array: any, id: any) => {
        const found = array.find((element: any) => element?.[valueExpr] === id);
        setPrevData(found)
    }

    return (
        <FormControl
            fullWidth={fullWidth}
            variant={variant}
            style={{ width: width, margin: "0px" }}
            size="small"
            {...(error && { error: true })}
        >
            <Autocomplete
                disabled={disabled}
                autoHighlight
                // clearIcon={true}
                options={options || []}
                onChange={onChange}
                getOptionLabel={(option: any) => option[displayExpr]}
                value={prevData?.[valueExpr] ?? prevData}
                renderInput={(params) => (
                    <InputBox
                        placeholder={placeholder}
                        label={label}
                        variant="outlined"
                        name={name}
                        onChange={onChange}
                        value={prevData || value}
                        sx={sx || { width: { width }, }}
                        {...params}
                        inputProps={{
                            ...params.inputProps,
                        }}
                        {...(error && { error: true })}
                    />
                )}
            />
            {error && <FormHelperText className={"errorMsg"} style={{ marginTop: "-2px" }}>{error}</FormHelperText>}
        </FormControl>
    );
}