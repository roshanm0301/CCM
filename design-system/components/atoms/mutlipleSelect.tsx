import { Box, Chip, FormControl, InputLabel, MenuItem, OutlinedInput, Select, SelectChangeEvent, Theme, useTheme } from '@mui/material';

interface IMultipleSelectComponent {
    selectedValues: string[]
    menuOptions: string[]
    onSelectValue: (value: string[]) => void;
    disabled: boolean
    size: any
    fullWidth: any
    Title: string
}

const MenuProps = {
    PaperProps: {
        style: {
            //   maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 250,
        },
    },
};


function getStyles(name: string, personName: readonly string[], theme: Theme) {
    return {
        fontWeight:
            personName.indexOf(name) === -1
                ? theme.typography.fontWeightRegular
                : theme.typography.fontWeightMedium,
    };
}


export const MultipleSelectComponent = (props: IMultipleSelectComponent) => {

    const { menuOptions, selectedValues, onSelectValue, disabled, size, fullWidth, Title } = props

    const theme = useTheme();

    const handleChange = (event: SelectChangeEvent<string[]>) => {
        const { target: { value } } = event;
        onSelectValue(typeof value === 'string' ? value.split(',') : value)
    };

    return (
        <FormControl fullWidth={fullWidth}>
            <InputLabel id="demo-multiple-chip-label">{Title}</InputLabel>
            <Select
                labelId="demo-multiple-chip-label"
                id="demo-multiple-chip"
                multiple
                size={size}
                value={selectedValues}
                onChange={handleChange}
                input={<OutlinedInput id="select-multiple-chip" label="Chip" />}
                renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                            <Chip key={value} label={value} />
                        ))}
                    </Box>
                )}
                MenuProps={MenuProps}
                disabled={disabled}
                fullWidth={fullWidth}
            >
                {menuOptions.map((name) => (
                    <MenuItem
                        key={name}
                        value={name}
                        style={getStyles(name, selectedValues, theme)}
                    >
                        {name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}