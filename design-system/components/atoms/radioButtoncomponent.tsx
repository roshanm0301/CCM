import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';

export default function MuiRadioButtons(props: any) {
    const { value, defaultValue, option = [], onChange } = props
    // const [value, setValue] = React.useState('campaign 1');

    // const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    //     setValue((event.target as HTMLInputElement).value);
    // };


    return (
        <FormControl>
            <FormLabel id="demo-radio-buttons-group-label"></FormLabel>
            <RadioGroup
                value={value}
                aria-labelledby="demo-radio-buttons-group-label"
                defaultValue={defaultValue}
                name="radio-buttons-group"
                onChange = {onChange}
            >
                {option?.map((item: any, index: any) => {
                    return <FormControlLabel
                        key={index}
                        value={item.value}
                        control={<Radio sx={{color:"gray"}}/>}
                        label={item.label}
                    />
                })}

            </RadioGroup>
        </FormControl>
    );
}