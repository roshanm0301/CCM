/**
 * CaseDetailScreen — three-tab (Case / Follow Up / Resolution) read/write
 * view for a registered case.
 *
 * Source: CCM_Phase6_Resolution_Activities.md § Case Detail Screen
 */

import React, { useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { CtiCallRecording } from '@/features/cti/CtiCallRecording';
import { FollowUpTab } from '@/features/follow-up/FollowUpTab';
import { ResolutionTab } from '@/features/resolution/ResolutionTab';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { BRAND_COLORS } from '@/shared/theme/colors';
import type { CaseDetailDto } from '@/features/cases/casesApi';
import { useCaseDetailContext } from './useCaseDetailContext';
import { CustomerCard } from '@/features/context/CustomerCard';
import { VehicleCard } from '@/features/context/VehicleCard';
import { DealerCard } from '@/features/context/DealerCard';
import type { CustomerContext, VehicleContext, DealerContext } from '@/features/interaction/interactionStore';

export interface CaseDetailScreenProps {
  caseDetail: CaseDetailDto;
  userRoles: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`case-tabpanel-${index}`}
      aria-labelledby={`case-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index && children}
    </Box>
  );
}

function tabA11y(index: number) {
  return {
    id: `case-tab-${index}`,
    'aria-controls': `case-tabpanel-${index}`,
  };
}

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>{label}</Typography>
      <Box sx={{ typography: 'body2', color: 'text.primary' }}>{children}</Box>
    </Box>
  );
}

function caseStatusChipColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'Open') return 'success';
  if (status === 'In Progress') return 'warning';
  if (status === 'Closed – Verified') return 'error';
  return 'default';
}

function activityStatusChipColor(status: string): 'default' | 'warning' | 'error' {
  if (status === 'Fresh') return 'default';
  if (status === 'In Progress') return 'warning';
  if (status === 'Closed') return 'error';
  return 'default';
}

function formatSidebarDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Left sidebar — Customer / Vehicle / Dealer cards
// ---------------------------------------------------------------------------
const CaseSidebar = React.memo(function CaseSidebar({ caseDetail }: { caseDetail: CaseDetailDto }) {
  const { customer, vehicle, dealer } = useCaseDetailContext({
    customerRef: caseDetail.customerRef,
    vehicleRef: caseDetail.vehicleRef,
    dealerRef: caseDetail.dealerRef,
  });

  // Map CustomerContextData → CustomerContext (card's expected type)
  const customerData: CustomerContext | null = customer.data
    ? {
        customerRef: customer.data.customerRef,
        contactName: customer.data.contactName ?? '',
        primaryMobile: customer.data.primaryMobile ?? '',
        secondaryMobile: null,
        emailId: customer.data.emailId,
        address: customer.data.address,
        sourceSystem: '',
      }
    : null;

  // Map VehicleContextData → VehicleContext
  const vehicleData: VehicleContext | null = vehicle.data
    ? {
        vehicleRef: vehicle.data.vehicleRef,
        productType: vehicle.data.productType,
        modelName: vehicle.data.modelName ?? '',
        variant: vehicle.data.variant ?? '',
        registrationNumber: caseDetail.vehicleRef ?? '',
        chassisNumberMasked: vehicle.data.chassisNumberMasked ?? '',
        soldOnDate: vehicle.data.soldOnDate,
        lastServiceDate: vehicle.data.lastServiceDate,
        dealerRef: null,
        sourceSystem: '',
      }
    : null;

  // Map DealerContextData → DealerContext
  const dealerData: DealerContext | null = dealer.data
    ? {
        dealerRef: dealer.data.dealerRef,
        dealerName: dealer.data.dealerName ?? '',
        dealerCode: dealer.data.dealerCode ?? '',
        branchName: dealer.data.branchName,
        asc: null,
        city: dealer.data.city,
        address: dealer.data.address,
        pinCode: null,
        dealerType: null,
        isActive: dealer.data.isActive,
        sourceSystem: '',
      }
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <CustomerCard
        data={customerData}
        loading={customer.isLoading}
        error={customer.isError ? 'Could not load customer details' : null}
      />
      <Box sx={{ mb: 1.5 }} />
      <VehicleCard
        data={caseDetail.vehicleRef ? vehicleData : null}
        loading={Boolean(caseDetail.vehicleRef) && vehicle.isLoading}
        error={caseDetail.vehicleRef && vehicle.isError ? 'Could not load vehicle details' : null}
        dealerName={dealer.data?.dealerName ?? null}
      />
      <Box sx={{ mb: 1.5 }} />
      <DealerCard
        data={dealerData}
        loading={dealer.isLoading}
        error={dealer.isError ? 'Could not load dealer details' : null}
      />
    </Box>
  );
});

// ---------------------------------------------------------------------------
// Case Tab — read-only display of all case fields
// ---------------------------------------------------------------------------
function CaseTab({ caseDetail }: { caseDetail: CaseDetailDto }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <ReadOnlyField label="Case ID">
            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{caseDetail.caseId}</Typography>
          </ReadOnlyField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <ReadOnlyField label="Case Nature">
            <Typography variant="body2" fontWeight={500}>{caseDetail.caseNature}</Typography>
          </ReadOnlyField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <ReadOnlyField label="Department">{caseDetail.department}</ReadOnlyField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <ReadOnlyField label="Product Type">{caseDetail.productType}</ReadOnlyField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <ReadOnlyField label="Priority">{caseDetail.priority ?? '—'}</ReadOnlyField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <ReadOnlyField label="Case Status">
            <Chip label={caseDetail.caseStatus} color={caseStatusChipColor(caseDetail.caseStatus)} size="small" />
          </ReadOnlyField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <ReadOnlyField label="Activity Status">
            <Chip label={caseDetail.activityStatus} color={activityStatusChipColor(caseDetail.activityStatus)} size="small" />
          </ReadOnlyField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <ReadOnlyField label="Registered At">
            {new Date(caseDetail.registeredAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </ReadOnlyField>
        </Grid>
      </Grid>
      <Divider sx={{ my: 2 }} />
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ReadOnlyField label="Customer Remarks">
            {caseDetail.customerRemarks || (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>None</Typography>
            )}
          </ReadOnlyField>
        </Grid>
        <Grid item xs={12}>
          <ReadOnlyField label="Agent Remarks">
            {caseDetail.agentRemarks || (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>None</Typography>
            )}
          </ReadOnlyField>
        </Grid>
      </Grid>
      {caseDetail.interactionChannel === 'inbound_call' && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              display="block"
              sx={{ mb: 1, lineHeight: 1.5 }}
            >
              Original Call Recording
            </Typography>
            <CtiCallRecording
              interactionId={caseDetail.interactionId}
              channel={caseDetail.interactionChannel}
            />
          </Box>
        </>
      )}
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CaseDetailScreen({
  caseDetail,
  userRoles,
}: CaseDetailScreenProps) {
  const [activeTab, setActiveTab] = useState(0);
  const isClosed = caseDetail.caseStatus.includes('Closed');

  return (
    <Box sx={{ p: 2 }}>
      {/* Closed case banner */}
      {isClosed && (
        <Box sx={{ mb: 2 }}>
          <Chip
            label="Case Closed"
            sx={{
              bgcolor: BRAND_COLORS.orange,
              color: '#fff',
              fontWeight: 600,
            }}
          />
        </Box>
      )}

      <Grid container spacing={2}>
        {/* Left sidebar — always rendered once; shown on md+, stacked above tabs on xs */}
        <Grid
          item
          xs={12}
          md={3}
        >
          <CaseSidebar caseDetail={caseDetail} />
        </Grid>

        {/* Right: tabs + content */}
        <Grid item xs={12} md={9}>
          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_e, v: number) => setActiveTab(v)}
            aria-label="Case detail tabs"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTabs-indicator': { backgroundColor: BRAND_COLORS.orange },
              '& .Mui-selected': { color: `${BRAND_COLORS.orange} !important` },
            }}
          >
            <Tab label="Case" {...tabA11y(0)} />
            <Tab label="Follow Up" {...tabA11y(1)} />
            <Tab label="Resolution" {...tabA11y(2)} />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <CaseTab caseDetail={caseDetail} />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <ErrorBoundary>
              <FollowUpTab
                caseId={caseDetail.caseId}
                caseStatus={caseDetail.caseStatus}
                userRoles={userRoles}
              />
            </ErrorBoundary>
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <ErrorBoundary>
              <ResolutionTab
                caseId={caseDetail.caseId}
                caseNature={caseDetail.caseNature}
                department={caseDetail.department}
                productType={caseDetail.productType}
                userRoles={userRoles}
              />
            </ErrorBoundary>
          </TabPanel>
        </Grid>
      </Grid>
    </Box>
  );
}
