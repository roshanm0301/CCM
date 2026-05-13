import Slider, { SliderProps } from "@mui/material/Slider";
import { secondary } from "../../theme/colors";

const RAIL_COLOR = secondary[300];

const marks = [
    {
        value: 0,
        label: "E"
    },
    {
        value: 25,
        label: "I"
    },
    {
        value: 50,
        label: "1/2"
    },
    {
        value: 75,
        label: "I"
    },
    {
        value: 100,
        label: "F"
    }
];

export const MuiSlider = (props: SliderProps) => {
    let { marks: propMarks, defaultValue = 0, disabled = false, onChange, value, onChangeCommitted, step, ...others } = props;
    const resolvedMarks = propMarks ?? marks;

    const valuetext = (value: number) => {
        return `${value} %`;
    }

    return (
        <Slider
            valueLabelDisplay="on"
            sx={{
                width: "100%",
                "& .MuiSlider-rail": {
                    backgroundColor: RAIL_COLOR,
                },
                "& .MuiSlider-thumb": {
                    height: 20,
                    width: 20,
                    backgroundColor: "#fff",
                    border: "2px solid currentColor",
                    "&:focus, &:hover, &.Mui-active, &.Mui-focusVisible": {
                        boxShadow: "inherit",
                    },
                    "&::before": {
                        display: "none",
                    },
                },
                "& .MuiSlider-mark": {
                    border: "1px solid gray",
                    height: 5,
                    width: 5,
                    backgroundColor: "#fff",
                    borderRadius: '50%'
                },
                "& .MuiSlider-markActive": {
                    backgroundColor: "currentColor",
                    opacity: 1,
                    height: 8,
                    width: 8,
                    border: "1px solid currentColor",
                    borderRadius: '50%'
                },
            }}
            defaultValue={defaultValue}
            getAriaValueText={valuetext}
            valueLabelFormat={valuetext}
            step={step}
            marks={resolvedMarks}
            disabled={disabled}
            onChange={onChange}
            value={value}
            onChangeCommitted={onChangeCommitted}
            // onDragStop={onDragStop}
            {...others}


        />
    );
}
