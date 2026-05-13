// =============================================================================
// CCM API — ISearchAdapter Interface
//
// Contract that all search adapters must implement.
// Source: phase1-technical-blueprint.md § 4.2 (integration module)
// =============================================================================

import { SearchFilter } from '@ccm/types';

export interface SearchResultVehicle {
  vehicleRef: string;
  registrationNumber: string;
  modelName: string;
  variant: string;
  dealerRef: string | null;
  chassisNumber: string; // raw — masking applied at context layer
}

export interface SearchResultItem {
  customerRef: string;
  customerName: string;
  primaryMobile: string;
  email: string | null;
  vehicles: SearchResultVehicle[];
  sourceSystem: 'INSTALL_BASE' | 'CUSTOMER_MASTER';
}

export interface ISearchAdapter {
  search(filter: SearchFilter, value: string): Promise<SearchResultItem[]>;
}
