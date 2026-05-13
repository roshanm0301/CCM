/**
 * SearchPanel — customer search controls and results.
 *
 * Uses SearchBarByTypesComponent from the design system for the combined
 * filter-dropdown-inside-input field. Data is transformed to match the
 * design system's expected shape before being passed as props.
 *
 * Business logic:
 *  - Filter options: Mobile / Reg.No / Customer Name / Email
 *  - Validation per spec §3.9
 *  - Debounced typeahead (300ms)
 *  - Calls POST /api/v1/search on submit
 *
 * Source: ux-specification-v2.md Screen 6 §SearchPanel
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@/shared/components/customIcon';
import { SearchFilter } from '@ccm/types';
import { apiClient } from '@/shared/api/client';
import { useInteractionStore, type SearchResultItem } from '@/features/interaction/interactionStore';
import SearchBarByTypesComponent, { SearchStateE } from '@/shared/components/SearchBarByTypes';
import { SearchResults } from './SearchResults';

// ---------------------------------------------------------------------------
// Search type list — CCM Phase 1 options passed to design-system component
// ---------------------------------------------------------------------------

const CCM_SEARCH_TYPES = [
  { SourceId: '1', DisplayName: 'Mobile',    Value: 'MobileNumber'    },
  { SourceId: '2', DisplayName: 'Reg.No',    Value: 'RegistrationNo'  },
  { SourceId: '3', DisplayName: 'Cust.Name', Value: 'CustomerName'    },
  { SourceId: '4', DisplayName: 'Email',     Value: 'Email'           },
];

// Map design-system Value → CCM SearchFilter
function toSearchFilter(searchType: string): SearchFilter {
  switch (searchType) {
    case 'MobileNumber':   return SearchFilter.MOBILE;
    case 'RegistrationNo': return SearchFilter.REGISTRATION_NUMBER;
    case 'CustomerName':   return SearchFilter.CUSTOMER_NAME;
    case 'Email':          return SearchFilter.EMAIL;
    default:               return SearchFilter.MOBILE;
  }
}

// ---------------------------------------------------------------------------
// Transform CCM SearchResultItem → shape SearchBarByTypesComponent expects
// ---------------------------------------------------------------------------

interface DsOption {
  PersonId:     string;
  GivenName:    string;
  FamilyName:   string;
  MobileNumber: string;
  Email:        string;
  RegNo:        string;
  VINNo:        string;
  _raw:         SearchResultItem;
}

function toDsOptions(items: SearchResultItem[]): DsOption[] {
  return items.map((item) => {
    const parts = item.customerName.trim().split(' ');
    return {
      PersonId:     item.customerRef,
      GivenName:    parts[0] ?? item.customerName,
      FamilyName:   parts.slice(1).join(' '),
      MobileNumber: item.primaryMobile,
      Email:        item.email ?? '',
      RegNo:        item.vehicles[0]?.registrationNumber ?? '',
      VINNo:        item.vehicles[0]?.registrationNumber ?? '',
      _raw:         item,
    };
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateInput(filter: SearchFilter, value: string): string {
  if (value.trim().length < 3) return 'Enter at least 3 characters.';
  switch (filter) {
    case SearchFilter.MOBILE:
      if (!/^\d+$/.test(value.trim())) return 'Enter a valid mobile number.';
      break;
    case SearchFilter.REGISTRATION_NUMBER:
      if (!/^[A-Z0-9]+$/.test(value.trim())) return 'Enter a valid registration number.';
      break;
    case SearchFilter.CUSTOMER_NAME:
      if (!/^[A-Za-z\s]+$/.test(value.trim())) return 'Enter a valid customer name.';
      break;
    case SearchFilter.EMAIL:
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
        return 'Enter a valid email address.';
      break;
  }
  return '';
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface SearchApiResponse {
  success: true;
  data: {
    interactionId:      string;
    searchAttemptId:    string;
    filter:             SearchFilter;
    normalizedValue:    string;
    results:            SearchResultItem[];
    resultCount:        number;
    primarySourceUsed:  string;
    fallbackSourceUsed: boolean;
    outcomeStatus:      'RESULTS_FOUND' | 'NO_RESULTS' | 'PARTIAL' | 'ERROR';
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchPanelProps {
  collapsed?: boolean;
  onChangeSelection?: () => void;
  /** Called when the agent commits a search (Enter or button click) — passes filter label + value */
  onSearchCommitted?: (filterLabel: string, value: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchPanel({ collapsed = false, onChangeSelection, onSearchCommitted }: SearchPanelProps) {
  const { interactionId, searchResults, setSearchResults, ctiFromNumber } = useInteractionStore();

  const [searchType, setSearchType]   = useState<string>('MobileNumber');

  // ── Lazy-initialize inputValue from the CTI caller number ─────────────────
  // React 18 batches setInboundCallInteraction + setSearchResults into one
  // render, so when SearchPanel mounts ctiFromNumber and searchResults are
  // already in the store.  A useEffect fires only AFTER paint — too late,
  // because the auto-select context API call may return and unmount SearchPanel
  // before the effect-triggered re-render happens.  Reading the store
  // synchronously inside the useState lazy initializer sets the correct value
  // in the FIRST render so the Mobile field shows the caller's number
  // immediately without waiting for a second render cycle.
  const [inputValue, setInputValue]   = useState<string>(() => {
    const { ctiFromNumber: ctfn, searchResults: sr } = useInteractionStore.getState();
    if (!ctfn || !sr || sr.length === 0) return '';
    const digits = ctfn.replace(/\D/g, '');
    const normalized = digits.length > 10 ? digits.slice(-10) : digits;
    return normalized.length >= 3 ? normalized : '';
  });

  const [inputError, setInputError]   = useState('');
  const [searching,  setSearching]    = useState(false);
  const [searchError, setSearchError] = useState('');
  const [noResults,  setNoResults]    = useState(false);

  // Typeahead state
  const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstResultRef = useRef<HTMLButtonElement>(null);
  const [srAnnouncement, setSrAnnouncement] = useState('');

  // ── Fallback effect: populate inputValue when results arrive after mount ──
  // Covers edge cases where SearchPanel was already mounted before the
  // pre-fetch resolved (e.g. resuming an interaction mid-call).
  // When the lazy initializer already populated inputValue (inputValue !== '')
  // autoPopulatedRef starts true and this effect is a no-op.
  const autoPopulatedRef = useRef(inputValue !== '');
  useEffect(() => {
    if (autoPopulatedRef.current) return;
    if (!ctiFromNumber || !searchResults || searchResults.length === 0) return;
    const digits = ctiFromNumber.replace(/\D/g, '');
    const normalized = digits.length > 10 ? digits.slice(-10) : digits;
    if (normalized.length >= 3) {
      setSearchType('MobileNumber');
      setInputValue(normalized);
      autoPopulatedRef.current = true;
    }
  }, [ctiFromNumber, searchResults]);

  const selectedFilter = toSearchFilter(searchType);

  // Transform suggestions to design-system shape (memoised)
  const dsOptions: DsOption[] = useMemo(() => toDsOptions(suggestions), [suggestions]);

  // ── Debounced typeahead ──────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!interactionId || inputValue.trim().length < 3 || searching) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.post<SearchApiResponse>('/api/v1/search', {
          interactionId,
          filter: selectedFilter,
          value: inputValue.trim(),
        });
        if (!cancelled) setSuggestions(res.data.data.results);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, selectedFilter, interactionId, searching]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleFilterChange(value: string) {
    setSearchType(value);
    setInputValue('');
    setInputError('');
    setSearchError('');
    setNoResults(false);
    setSearchResults([]);
    setSuggestions([]);
  }

  function handleInputChange(val: string) {
    setInputValue(val); // uppercase for RegistrationNo handled inside SearchBarByTypes
    if (inputError)  setInputError('');
    if (searchError) setSearchError('');
    if (noResults)   setNoResults(false);
  }

  /** Called by design-system component when user picks a suggestion row */
  function handleSuggestionPicked(personId: string) {
    const opt = dsOptions.find((o) => o.PersonId === personId);
    if (!opt) return;
    const displayVal =
      searchType === 'Email'          ? opt.Email
      : searchType === 'RegistrationNo' ? opt.RegNo
      : searchType === 'CustomerName'   ? `${opt.GivenName} ${opt.FamilyName}`.trim()
      : opt.MobileNumber;
    setInputValue(displayVal);
    setSuggestions([]);
  }

  const handleSearch = useCallback(async () => {
    if (!interactionId) return;
    const err = validateInput(selectedFilter, inputValue);
    if (err) { setInputError(err); return; }

    setSearching(true);
    setSearchError('');
    setNoResults(false);
    setSearchResults([]);
    setSrAnnouncement('Searching…');
    try {
      const res = await apiClient.post<SearchApiResponse>('/api/v1/search', {
        interactionId,
        filter: selectedFilter,
        value:  inputValue.trim(),
      });
      const { results, resultCount, outcomeStatus } = res.data.data;
      if (outcomeStatus === 'ERROR' || resultCount === 0) {
        setNoResults(true);
        setSrAnnouncement('Search complete. No results found.');
      } else {
        setSearchResults(results);
        setSrAnnouncement(`Search complete. ${resultCount} result${resultCount !== 1 ? 's' : ''} found.`);
        // Notify parent of committed search so collapsed summary can display it
        const label = CCM_SEARCH_TYPES.find((t) => t.Value === searchType)?.DisplayName ?? searchType;
        onSearchCommitted?.(label, inputValue.trim());
        setTimeout(() => firstResultRef.current?.focus(), 100);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 422) {
        setInputError('Enter at least 3 characters.');
      } else {
        setSearchError('Search is temporarily unavailable. Please try again.');
      }
      setSrAnnouncement('Search failed.');
    } finally {
      setSearching(false);
    }
  }, [interactionId, selectedFilter, inputValue, searchType, setSearchResults, onSearchCommitted]);

  // ── Collapsed view ────────────────────────────────────────────────────────
  if (collapsed) {
    const label = CCM_SEARCH_TYPES.find((t) => t.Value === searchType)?.DisplayName ?? searchType;
    return (
      <Box>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>Search</Typography>
        <Typography sx={{ fontSize: 'sm', color: 'text.secondary', mb: 1 }}>
          {label}: {inputValue || '—'}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={onChangeSelection}
          sx={{ borderColor: 'divider', color: 'text.secondary', fontSize: 'sm' }}
        >
          Change
        </Button>
      </Box>
    );
  }

  // ── Full view ─────────────────────────────────────────────────────────────
  return (
    <Box component="section" aria-label="Customer search">
      {/* Screen-reader live region */}
      <Box
        aria-live="polite"
        aria-atomic="true"
        sx={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
      >
        {srAnnouncement}
      </Box>

      <Card elevation={0} variant="outlined" sx={{ borderRadius: 2, borderColor: '#DEE4EB' }}>
        {searching && <LinearProgress aria-label="Searching" sx={{ height: 3 }} />}

        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>

          {/* Heading */}
          <Typography
            component="h2"
            sx={{
              fontSize: 'base',
              fontWeight: 'strong',
              color: '#000000',
              mb: 1.5,
            }}
          >
            Search
          </Typography>

          {/* Combined filter + text input (design-system component) */}
          <Box sx={{ mb: 1.5 }}>
            <SearchBarByTypesComponent
              searchText={inputValue}
              selectedOption={searchType}
              autocompleteOptions={dsOptions}
              handleSelectSearchType={handleFilterChange}
              handleSearchTextChange={handleInputChange}
              handleSelectSearchResult={handleSuggestionPicked}
              handleOnClickSearchIcon={handleSearch}
              SearchState={
                searching
                  ? SearchStateE.searching
                  : (searchResults?.length || 0) > 0 || noResults
                    ? SearchStateE.searchComplete
                    : SearchStateE.toSearch
              }
              Value={inputValue}
              searchTypeList={CCM_SEARCH_TYPES}
            />
            {inputError && (
              <Typography sx={{ fontSize: 'sm', color: 'error.main', mt: 0.5, ml: 1.5 }}>
                {inputError}
              </Typography>
            )}
          </Box>

          {/* Search button */}
          <Button
            id="search-btn"
            variant="contained"
            fullWidth
            onClick={handleSearch}
            disabled={inputValue.trim().length < 3 || searching}
            aria-disabled={inputValue.trim().length < 3 || searching}
            startIcon={<SearchIcon sx={{ width: 16, height: 16 }} />}
            sx={{
              bgcolor: '#EB6A2C',
              color: '#FFFFFF',
              fontSize: 'base',
              fontWeight: 'strong',
              borderRadius: 2,
              height: 36,
              textTransform: 'none',
              '&:hover': { bgcolor: '#C45A24' },
              '&.Mui-disabled': { bgcolor: '#EB6A2C', opacity: 0.5, color: '#FFFFFF' },
            }}
          >
            Search
          </Button>

          {/* Errors */}
          {searchError && (
            <Alert severity="error" role="alert" sx={{ mt: 1.5 }}>
              {searchError}
            </Alert>
          )}

          {/* No results */}
          {noResults && !searching && (
            <Typography sx={{ fontSize: 'base', color: 'text.secondary', mt: 2 }} aria-live="polite">
              No results found.
            </Typography>
          )}

          {/* Results list */}
          {searchResults && searchResults.length > 0 && !searching && (
            <SearchResults results={searchResults} firstResultRef={firstResultRef} />
          )}

        </CardContent>
      </Card>
    </Box>
  );
}
