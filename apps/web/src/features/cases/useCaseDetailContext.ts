import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { QUERY_DEFAULTS } from '@/shared/api/queryConfig';

export interface CustomerContextData {
  customerRef: string;
  contactName: string | null;
  primaryMobile: string | null;
  emailId: string | null;
  address: string | null;
}

export interface VehicleContextData {
  vehicleRef: string;
  productType: string | null;
  modelName: string | null;
  variant: string | null;
  chassisNumberMasked: string | null;
  soldOnDate: string | null;
  lastServiceDate: string | null;
}

export interface DealerContextData {
  dealerRef: string;
  dealerName: string | null;
  dealerCode: string | null;
  branchName: string | null;
  city: string | null;
  address: string | null;
  isActive: boolean;
}

async function fetchCustomerContext(ref: string): Promise<CustomerContextData> {
  const res = await apiClient.get<{ success: boolean; data: CustomerContextData }>(
    `/api/v1/context/customer/${encodeURIComponent(ref)}`,
  );
  return res.data.data;
}

async function fetchVehicleContext(ref: string): Promise<VehicleContextData> {
  const res = await apiClient.get<{ success: boolean; data: VehicleContextData }>(
    `/api/v1/context/vehicle/${encodeURIComponent(ref)}`,
  );
  return res.data.data;
}

async function fetchDealerContext(ref: string): Promise<DealerContextData> {
  const res = await apiClient.get<{ success: boolean; data: DealerContextData }>(
    `/api/v1/context/dealer/${encodeURIComponent(ref)}`,
  );
  return res.data.data;
}

interface UseCaseDetailContextParams {
  customerRef: string;
  vehicleRef: string | null;
  dealerRef: string;
}

export function useCaseDetailContext({ customerRef, vehicleRef, dealerRef }: UseCaseDetailContextParams) {
  const customer = useQuery<CustomerContextData>({
    queryKey: ['caseDetailCtx', 'customer', customerRef],
    queryFn: () => fetchCustomerContext(customerRef),
    enabled: Boolean(customerRef),
    ...QUERY_DEFAULTS,
  });

  const vehicle = useQuery<VehicleContextData>({
    queryKey: ['caseDetailCtx', 'vehicle', vehicleRef],
    queryFn: () => fetchVehicleContext(vehicleRef!),
    enabled: Boolean(vehicleRef),
    ...QUERY_DEFAULTS,
  });

  const dealer = useQuery<DealerContextData>({
    queryKey: ['caseDetailCtx', 'dealer', dealerRef],
    queryFn: () => fetchDealerContext(dealerRef),
    enabled: Boolean(dealerRef),
    ...QUERY_DEFAULTS,
  });

  return { customer, vehicle, dealer };
}
