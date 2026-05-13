/**
 * Dealer Catalog API client.
 * Source: CCM_Phase6_Resolution_Activities.md § Dealer Catalog View
 */

import { apiClient } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DealerCatalogFilters {
  caseStatus?:      string[];
  caseNature?:      string;
  productType?:     string;
  department?:      string[];
  activityStatus?:  string;
  caseCategory?:    string[];
  caseSubcategory?: string[];
  dateFrom?:        string; // ISO date string
  dateTo?:          string; // ISO date string
}

export interface DealerCatalogItem {
  id:                  string;
  caseId:              string;
  caseNature:          string;
  department:          string;
  caseCategoryName:    string;
  caseSubcategoryName: string;
  customerName:        string;
  customerMobile:      string;
  currentAssignedRole: string;
  caseStatus:          string;
  activityStatus:      string;
  registeredAt:        string;
  customerRef:         string;
  dealerRef:           string;
}

export interface DealerCatalogResult {
  items: DealerCatalogItem[];
  total: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated, filtered, and sorted page of dealer catalog cases.
 *
 * Array filters (e.g. caseStatus) are serialized as repeated query params:
 *   caseStatus=Open&caseStatus=Closed
 */
export async function getDealerCatalog(
  filters: DealerCatalogFilters,
  page: number = 1,
  pageSize: number = 20,
  sortDir: 'asc' | 'desc' = 'desc',
): Promise<DealerCatalogResult> {
  const query = new URLSearchParams();

  query.set('page', String(page));
  query.set('pageSize', String(pageSize));
  query.set('sortDir', sortDir);

  if (filters.caseNature) query.set('caseNature', filters.caseNature);
  if (filters.productType) query.set('productType', filters.productType);
  if (filters.activityStatus) query.set('activityStatus', filters.activityStatus);
  if (filters.dateFrom) query.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.set('dateTo', filters.dateTo);

  // Array filters: repeated params (URLSearchParams encodes values automatically)
  if (filters.department) {
    for (const dept of filters.department) {
      query.append('department', dept);
    }
  }
  if (filters.caseStatus) {
    for (const status of filters.caseStatus) {
      query.append('caseStatus', status);
    }
  }
  if (filters.caseCategory) {
    for (const cat of filters.caseCategory) {
      query.append('caseCategory', cat);
    }
  }
  if (filters.caseSubcategory) {
    for (const sub of filters.caseSubcategory) {
      query.append('caseSubcategory', sub);
    }
  }

  const res = await apiClient.get<ApiResponse<DealerCatalogResult>>(
    `/api/v1/cases/dealer-catalog?${query.toString()}`,
  );
  return res.data.data;
}
