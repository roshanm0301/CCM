// =============================================================================
// CCM API — Search Adapter Factory
//
// Returns the appropriate adapter based on the search filter.
// Install Base is searched first for all filter types (except registration number
// which is exclusive to Install Base). Customer Master is the fallback.
// Source: phase1-technical-blueprint.md § 4.2 (integration module)
// =============================================================================

import type { ISearchAdapter } from './ISearchAdapter';
import { MockInstallBaseAdapter } from './MockInstallBaseAdapter';
import { MockCustomerMasterAdapter } from './MockCustomerMasterAdapter';

let installBaseAdapter: ISearchAdapter | null = null;
let customerMasterAdapter: ISearchAdapter | null = null;

export function getInstallBaseAdapter(): ISearchAdapter {
  if (!installBaseAdapter) {
    installBaseAdapter = new MockInstallBaseAdapter();
  }
  return installBaseAdapter;
}

export function getCustomerMasterAdapter(): ISearchAdapter {
  if (!customerMasterAdapter) {
    customerMasterAdapter = new MockCustomerMasterAdapter();
  }
  return customerMasterAdapter;
}
