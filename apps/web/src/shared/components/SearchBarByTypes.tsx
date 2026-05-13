import { KeyboardArrowDownRounded } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Divider,
  FormControl,
  MenuItem,
  Select,
  selectClasses,
  TextField,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Stack } from '@mui/material';

export enum SearchStateE {
  toSearch = 'toSearch',
  searching = 'searching',
  searchComplete = 'searchComplete',
}

export interface ISearchBarByTypes {
  searchText: string;
  selectedOption: string;
  autocompleteOptions: Array<any>;
  handleSelectSearchType: (option: any) => void;
  handleSearchTextChange: (value: string) => void;
  handleSelectSearchResult: (value: string) => void;
  handleOnClickSearchIcon: (value: string) => void;
  SearchState: SearchStateE;
  Value?: string;
  /** Optional override for the search type dropdown list */
  searchTypeList?: Array<{ SourceId: string; DisplayName: string; Value: string }>;
}

// Emoji / special character regex
const EMOJI_REGEX =
  /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;

const SearchBarByTypesComponent = (props: ISearchBarByTypes) => {
  const {
    handleSelectSearchType,
    handleSearchTextChange,
    handleSelectSearchResult,
    selectedOption,
    searchText,
    autocompleteOptions,
    handleOnClickSearchIcon,
    SearchState,
    Value,
    searchTypeList: searchTypeListProp,
  } = props;

  const [inputValue, setInputValue] = React.useState(Value ?? '');
  const [autoCompleteList, setAutoCompleteList] = React.useState(autocompleteOptions);
  const [isFocused, setIsFocused] = useState(false);

  const defaultSearchTypeList = [
    { SourceId: '1', DisplayName: 'Reg.No',  Value: 'RegistrationNo' },
    { SourceId: '2', DisplayName: 'VIN.No',  Value: 'VinNo'          },
    { SourceId: '3', DisplayName: 'Mobile',  Value: 'MobileNumber'   },
    { SourceId: '4', DisplayName: 'Email',   Value: 'Email'          },
  ];

  const searchTypeList = searchTypeListProp ?? defaultSearchTypeList;

  // Reset internal input when filter type changes
  const handleSearchTypeChange = (event: any) => {
    handleSelectSearchType(event.target.value);
    setInputValue('');
  };

  useEffect(() => {
    setAutoCompleteList(autocompleteOptions);
    return () => setAutoCompleteList([]);
  }, [autocompleteOptions]);

  // Reset internal value when parent clears it
  useEffect(() => {
    if (searchText === '') setInputValue('');
  }, [searchText]);

  return (
    <FormControl fullWidth>
      <Stack width="100%" direction="row" spacing={1} alignItems="center">
        <Autocomplete
          fullWidth
          className="custume-auto-complete"
          open={autoCompleteList.length > 0 && SearchState !== SearchStateE.searchComplete}
          id="ccm-search-input"
          size="small"
          autoHighlight
          options={autoCompleteList}
          getOptionLabel={(option) => {
            switch (selectedOption) {
              case 'MobileNumber':  return option.MobileNumber ?? '';
              case 'Email':         return option.Email ?? '';
              case 'VinNo':         return option.VINNo ?? '';
              case 'RegistrationNo':return option.RegNo ?? '';
              case 'CustomerName':  return `${option.GivenName ?? ''} ${option.FamilyName ?? ''}`.trim();
              default:              return '';
            }
          }}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <div style={{ padding: '5px 10px' }}>
                <div style={{ fontSize: '14px' }}>
                  <b>{option?.GivenName} {option?.FamilyName}</b>
                </div>
                <div style={{ fontSize: '14px', color: '#6A7682' }}>
                  {selectedOption === 'Email'          ? option.Email
                  : selectedOption === 'RegistrationNo' ? option.RegNo
                  : selectedOption === 'VinNo'           ? option.VINNo
                  : option.MobileNumber}
                </div>
              </div>
            </Box>
          )}
          onChange={(_event, newValue) => {
            if (!newValue) return;
            let selectedValue = '';
            switch (selectedOption) {
              case 'MobileNumber':   selectedValue = newValue?.PersonId ?? '';    break;
              case 'Email':          selectedValue = newValue?.Email ?? '';       break;
              case 'VinNo':          selectedValue = newValue?.VINNo ?? '';       break;
              case 'RegistrationNo': selectedValue = newValue?.RegNo ?? '';       break;
              case 'CustomerName':   selectedValue = newValue?.PersonId ?? '';    break;
              default: break;
            }
            if (selectedValue) handleSelectSearchResult(selectedValue);
          }}
          inputValue={inputValue || searchText}
          onInputChange={(_event, newInputValue) => {
            let value = newInputValue;

            switch (selectedOption) {
              case 'MobileNumber':
                value = newInputValue.replace(/[^0-9]/g, '').slice(0, 10);
                break;
              case 'RegistrationNo':
                value = newInputValue.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase();
                break;
              case 'VinNo':
                value = newInputValue.replace(/[^A-Za-z0-9]/g, '').slice(0, 17);
                break;
              case 'EngineNo':
                value = newInputValue.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
                break;
              case 'Email':
              case 'CustomerName':
                value = newInputValue.replace(EMOJI_REGEX, '');
                break;
              default:
                value = newInputValue;
            }

            setInputValue(value);
            handleSearchTextChange(value); // always notify parent
          }}
          freeSolo
          renderInput={(params) => (
            <TextField
              {...params}
              id={'searchby-Type' + searchText}
              name="custume-auto"
              variant="outlined"
              focused={false}
              className={isFocused ? 'focused-autocomplete' : 'default-autocomplete'}
              inputProps={{
                ...params.inputProps,
                inputMode: selectedOption === 'MobileNumber' ? 'numeric' : 'text',
                style: { padding: '2px 0px', width: '100%' },
              }}
              InputProps={{
                ...params.InputProps,
                autoComplete: 'new-password',
                startAdornment: (
                  <>
                    <Select
                      variant="standard"
                      disableUnderline
                      MenuProps={{ disableScrollLock: true }}
                      className="custume-select-auto"
                      value={selectedOption}
                      onChange={handleSearchTypeChange}
                      id="searchVehicleDropDown"
                      sx={{
                        minWidth: '10ch',
                        flexShrink: 0,
                        [`.${selectClasses.icon}`]: { top: 0 },
                      }}
                      SelectDisplayProps={{
                        style: {
                          minHeight: 'auto',
                          lineHeight: '20px',
                          fontSize: '14px',
                          padding: '0px 24px 0px 12px',
                        },
                      }}
                      IconComponent={KeyboardArrowDownRounded}
                    >
                      {searchTypeList.map((item, index) => (
                        <MenuItem id={item.Value} key={index} value={item.Value}>
                          {item.DisplayName}
                        </MenuItem>
                      ))}
                    </Select>
                    <Divider
                      orientation="vertical"
                      flexItem
                      sx={{ mx: 0.5, my: '6px', borderColor: '#DEE4EB' }}
                    />
                  </>
                ),
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.stopPropagation();
                  const val = inputValue || searchText;
                  if (val.trim().length >= 3) {
                    handleOnClickSearchIcon(val);
                  }
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
          )}
        />
      </Stack>
    </FormControl>
  );
};

export default SearchBarByTypesComponent;
