/**
 * FilteredSearchInput — single combined search input with an inline filter-type selector.
 *
 * Pattern source: design-system/components/molecules/searchBarByTypes.tsx
 *
 * Visual spec:
 *   - Single outlined input, 36px height, 8px corner radius
 *   - Left side: MUI Select (variant=standard, disableUnderline) showing selected filter
 *     label + KeyboardArrowDownRounded chevron (20×20, #6A7682)
 *   - Vertical divider between filter selector and text area
 *   - Right side: text input, placeholder Noto Sans Regular 14px #8593A3
 *   - endAdornment slot for typeahead spinner
 */

import React from 'react';
import {
  Divider,
  FormControl,
  FormHelperText,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Select,
  selectClasses,
} from '@mui/material';
import { KeyboardArrowDownRounded } from '@mui/icons-material';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilteredSearchInputProps {
  /** The list of filter options shown in the dropdown. */
  filterOptions: FilterOption[];
  /** Currently selected filter value. Pass '' for unselected state. */
  selectedFilter: string;
  /** Called when the user picks a different filter type. */
  onFilterChange: (value: string) => void;
  /** Current text entered in the search input. */
  inputValue: string;
  /** Called on every keystroke. */
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Placeholder shown inside the text area. */
  placeholder?: string;
  /** Disables both selector and text input. */
  disabled?: boolean;
  /** Puts the input into error state. */
  error?: boolean;
  /** Helper / error text shown below the input. */
  helperText?: string;
  /** Called when the text input loses focus. */
  onBlur?: () => void;
  /** Called on keydown (e.g. Enter to submit). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Ref forwarded to the underlying <input> element. */
  inputRef?: React.Ref<HTMLInputElement>;
  /** Node rendered as the right endAdornment (e.g. CircularProgress for typeahead). */
  endAdornment?: React.ReactNode;
  /** aria-label for the text input area. */
  inputAriaLabel?: string;
  /** id for the underlying <input> element. */
  id?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilteredSearchInput({
  filterOptions,
  selectedFilter,
  onFilterChange,
  inputValue,
  onInputChange,
  placeholder = '',
  disabled = false,
  error = false,
  helperText,
  onBlur,
  onKeyDown,
  inputRef,
  endAdornment,
  inputAriaLabel,
  id = 'filtered-search-input',
}: FilteredSearchInputProps) {
  return (
    <FormControl fullWidth error={error}>
      <OutlinedInput
        id={id}
        value={inputValue}
        onChange={onInputChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        inputRef={inputRef}
        placeholder={placeholder}
        disabled={disabled}
        error={error}
        size="small"
        inputProps={{
          'aria-label': inputAriaLabel ?? 'Search input',
          style: { padding: '2px 0px' },
        }}
        sx={{
          height: 36,
          borderRadius: 2,            // 8px
          bgcolor: 'background.paper',
          pr: endAdornment ? 1 : 1.5,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? 'error.main' : '#DEE4EB',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? 'error.main' : '#B0BAC4',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? 'error.main' : 'primary.main',
          },
          '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
            borderColor: '#DEE4EB',
          },
          '& input::placeholder': {
            color: '#8593A3',
            opacity: 1,
            fontFamily: '"Noto Sans", "Roboto", sans-serif',
            fontSize: '14px',
            fontWeight: 400,
          },
          '& input': {
            fontFamily: '"Noto Sans", "Roboto", sans-serif',
            fontSize: '14px',
            color: '#000000',
          },
          // Ensure the adornment container stretches full height
          '& .MuiInputAdornment-root': {
            maxHeight: 'none',
            height: '100%',
          },
        }}
        startAdornment={
          <InputAdornment
            position="start"
            disablePointerEvents={disabled}
            sx={{ mr: 0, height: '100%', alignItems: 'stretch' }}
          >
            {/*
             * Inline Select — same pattern as searchBarByTypes.tsx:
             *   variant="standard" + disableUnderline → no box, just text + chevron
             */}
            <Select
              variant="standard"
              disableUnderline
              displayEmpty
              value={selectedFilter}
              onChange={(e) => onFilterChange(e.target.value)}
              disabled={disabled}
              IconComponent={KeyboardArrowDownRounded}
              renderValue={(value) => {
                if (!value) {
                  return (
                    <span
                      style={{
                        color: '#8593A3',
                        fontFamily: '"Noto Sans", "Roboto", sans-serif',
                        fontSize: '14px',
                        fontWeight: 400,
                      }}
                    >
                      Search by
                    </span>
                  );
                }
                return filterOptions.find((f) => f.value === value)?.label ?? String(value);
              }}
              inputProps={{ 'aria-label': 'Select search filter type' }}
              MenuProps={{ disableScrollLock: true }}
              sx={{
                minWidth: '10ch',
                // Chevron icon position — matches design system
                [`& .${selectClasses.icon}`]: {
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6A7682',
                  width: 20,
                  height: 20,
                },
              }}
              SelectDisplayProps={{
                style: {
                  minHeight: 'auto',
                  lineHeight: '20px',
                  fontSize: '14px',
                  padding: '0px 28px 0px 12px',
                  fontFamily: '"Noto Sans", "Roboto", sans-serif',
                  fontWeight: selectedFilter ? 600 : 400,
                  color: selectedFilter ? '#000000' : '#8593A3',
                },
              }}
            >
              {filterOptions.map((opt) => (
                <MenuItem
                  key={opt.value}
                  value={opt.value}
                  sx={{
                    fontFamily: '"Noto Sans", "Roboto", sans-serif',
                    fontSize: '0.875rem',
                  }}
                >
                  {opt.label}
                </MenuItem>
              ))}
            </Select>

            {/* Vertical divider between filter selector and text area */}
            <Divider
              orientation="vertical"
              flexItem
              sx={{ borderColor: '#DEE4EB', my: 0.75, mx: 0.5 }}
            />
          </InputAdornment>
        }
        endAdornment={
          endAdornment ? (
            <InputAdornment position="end" sx={{ pr: 0.5 }}>
              {endAdornment}
            </InputAdornment>
          ) : undefined
        }
      />

      {helperText && (
        <FormHelperText
          error={error}
          role={error ? 'alert' : undefined}
          sx={{ mx: 0, fontFamily: '"Noto Sans", "Roboto", sans-serif', fontSize: '0.75rem' }}
        >
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
}
