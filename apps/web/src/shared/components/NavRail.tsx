/**
 * NavRail — narrow icon-only left navigation rail.
 *
 * Phase 1 scope: only the Home/workspace icon is shown.
 * No disabled "coming soon" Phase 2+ icons.
 *
 * Width: 56px
 * Background: secondary[900] = #1B1D21
 * Visible: md+ breakpoint only (hidden on mobile per spec)
 *
 * Active state: orange vertical bar on left + orange icon
 * Bottom: brand mark (orange circle)
 *
 * Source: CCM_Phase1_Agent_Interaction_Documentation.md §Navigation
 */

import React from 'react';
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  Tooltip,
  Typography,
} from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import FormatListBulletedOutlinedIcon from '@mui/icons-material/FormatListBulletedOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { useNavigate } from 'react-router-dom';
import { useInteractionStore } from '@/features/interaction/interactionStore';

const NAV_RAIL_WIDTH = 56;

interface NavRailProps {
  /** Which item is currently active. */
  activeItem?: 'home' | 'interactions' | 'case-categories' | 'activities' | 'activity-templates' | 'dealer-catalog';
}

export function NavRail({ activeItem = 'home' }: NavRailProps) {
  const navigate = useNavigate();
  const isWrapupPending = useInteractionStore((s) => s.isWrapupPending);
  const isHomeActive = activeItem === 'home';
  const isInteractionsActive = activeItem === 'interactions';
  const isCaseCategoriesActive = activeItem === 'case-categories';
  const isActivitiesActive = activeItem === 'activities';
  const isActivityTemplatesActive = activeItem === 'activity-templates';

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: NAV_RAIL_WIDTH,
        flexShrink: 0,
        display: { xs: 'none', md: 'block' },
        '& .MuiDrawer-paper': {
          width: NAV_RAIL_WIDTH,
          bgcolor: '#1B1D21',
          borderRight: 'none',
          pt: '64px',           // offset below 64px fixed AppBar
          boxSizing: 'border-box',
          overflowX: 'hidden',
        },
      }}
    >
      <Box
        component="nav"
        role="navigation"
        aria-label="Primary navigation"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <List
          sx={{
            p: 0,
            flex: 1,
            ...(isWrapupPending && { pointerEvents: 'none', opacity: 0.35 }),
          }}
          aria-label={isWrapupPending ? 'Navigation locked — complete wrap-up first' : undefined}
        >
          {/* Home */}
          <Tooltip title="Home" placement="right">
            <ListItemButton
              selected={isHomeActive}
              aria-label="Home workspace"
              aria-current={isHomeActive ? 'page' : undefined}
              aria-disabled={isWrapupPending || undefined}
              onClick={() => navigate('/workspace')}
              sx={{
                justifyContent: 'center',
                py: 1.5,
                px: 0,
                position: 'relative',
                minHeight: 48,
                color: isHomeActive ? '#EB6A2C' : '#A8B5C2',
                bgcolor: isHomeActive ? 'rgba(235,106,44,0.08)' : 'transparent',
                '&:hover': {
                  bgcolor: isHomeActive
                    ? 'rgba(235,106,44,0.12)'
                    : 'rgba(255,255,255,0.08)',
                },
                '&.Mui-selected': {
                  bgcolor: 'rgba(235,106,44,0.08)',
                  '&:hover': {
                    bgcolor: 'rgba(235,106,44,0.12)',
                  },
                },
              }}
            >
              {/* Active left-edge bar */}
              {isHomeActive && (
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    bgcolor: '#EB6A2C',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}
              {/* Home icon */}
              <Box
                aria-hidden="true"
                sx={{
                  color: isHomeActive ? '#EB6A2C' : '#A8B5C2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HomeOutlinedIcon sx={{ fontSize: 22 }} />
              </Box>
            </ListItemButton>
          </Tooltip>

          {/* Interactions */}
          <Tooltip title="Interactions" placement="right">
            <ListItemButton
              selected={isInteractionsActive}
              aria-label="Interactions"
              aria-current={isInteractionsActive ? 'page' : undefined}
              aria-disabled={isWrapupPending || undefined}
              onClick={() => navigate('/interactions')}
              sx={{
                justifyContent: 'center',
                py: 1.5,
                px: 0,
                position: 'relative',
                minHeight: 48,
                color: isInteractionsActive ? '#EB6A2C' : '#A8B5C2',
                bgcolor: isInteractionsActive ? 'rgba(235,106,44,0.08)' : 'transparent',
                '&:hover': {
                  bgcolor: isInteractionsActive
                    ? 'rgba(235,106,44,0.12)'
                    : 'rgba(255,255,255,0.08)',
                },
                '&.Mui-selected': {
                  bgcolor: 'rgba(235,106,44,0.08)',
                  '&:hover': {
                    bgcolor: 'rgba(235,106,44,0.12)',
                  },
                },
              }}
            >
              {/* Active left-edge bar */}
              {isInteractionsActive && (
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    bgcolor: '#EB6A2C',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}
              {/* Interactions icon */}
              <Box
                aria-hidden="true"
                sx={{
                  color: isInteractionsActive ? '#EB6A2C' : '#A8B5C2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FormatListBulletedOutlinedIcon sx={{ fontSize: 22 }} />
              </Box>
            </ListItemButton>
          </Tooltip>

          {/* Case Category */}
          <Tooltip title="Case Category" placement="right">
            <ListItemButton
              selected={isCaseCategoriesActive}
              aria-label="Case Category master"
              aria-current={isCaseCategoriesActive ? 'page' : undefined}
              aria-disabled={isWrapupPending || undefined}
              onClick={() => navigate('/case-categories')}
              sx={{
                justifyContent: 'center',
                py: 1.5,
                px: 0,
                position: 'relative',
                minHeight: 48,
                color: isCaseCategoriesActive ? '#EB6A2C' : '#A8B5C2',
                bgcolor: isCaseCategoriesActive ? 'rgba(235,106,44,0.08)' : 'transparent',
                '&:hover': {
                  bgcolor: isCaseCategoriesActive
                    ? 'rgba(235,106,44,0.12)'
                    : 'rgba(255,255,255,0.08)',
                },
                '&.Mui-selected': {
                  bgcolor: 'rgba(235,106,44,0.08)',
                  '&:hover': {
                    bgcolor: 'rgba(235,106,44,0.12)',
                  },
                },
              }}
            >
              {/* Active left-edge bar */}
              {isCaseCategoriesActive && (
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    bgcolor: '#EB6A2C',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}
              {/* Category icon */}
              <Box
                aria-hidden="true"
                sx={{
                  color: isCaseCategoriesActive ? '#EB6A2C' : '#A8B5C2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CategoryOutlinedIcon sx={{ fontSize: 22 }} />
              </Box>
            </ListItemButton>
          </Tooltip>
          {/* Divider + Activity Flows group label */}
          <Divider sx={{ borderColor: 'rgba(168,181,194,0.15)', my: 0.5 }} />

          <Box
            sx={{ py: 0.75, textAlign: 'center' }}
            aria-label="Activity Flows section"
          >
            <Typography
              sx={{
                color: 'rgba(168,181,194,0.6)',
                fontSize: '0.4375rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
                userSelect: 'none',
              }}
            >
              ACTIVITY{' '}FLOWS
            </Typography>
          </Box>

          {/* Activities */}
          <Tooltip title="Activities" placement="right">
            <ListItemButton
              selected={isActivitiesActive}
              aria-label="Activities master"
              aria-current={isActivitiesActive ? 'page' : undefined}
              aria-disabled={isWrapupPending || undefined}
              onClick={() => navigate('/activity-master')}
              sx={{
                justifyContent: 'center',
                py: 1.5,
                px: 0,
                position: 'relative',
                minHeight: 48,
                color: isActivitiesActive ? '#EB6A2C' : '#A8B5C2',
                bgcolor: isActivitiesActive ? 'rgba(235,106,44,0.08)' : 'transparent',
                '&:hover': {
                  bgcolor: isActivitiesActive
                    ? 'rgba(235,106,44,0.12)'
                    : 'rgba(255,255,255,0.08)',
                },
                '&.Mui-selected': {
                  bgcolor: 'rgba(235,106,44,0.08)',
                  '&:hover': { bgcolor: 'rgba(235,106,44,0.12)' },
                },
              }}
            >
              {isActivitiesActive && (
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    bgcolor: '#EB6A2C',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}
              <Box
                aria-hidden="true"
                sx={{
                  color: isActivitiesActive ? '#EB6A2C' : '#A8B5C2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ListAltOutlinedIcon sx={{ fontSize: 22 }} />
              </Box>
            </ListItemButton>
          </Tooltip>

          {/* Activity Flow Templates */}
          <Tooltip title="Activity Flow Templates" placement="right">
            <ListItemButton
              selected={isActivityTemplatesActive}
              aria-label="Activity Flow Templates master"
              aria-current={isActivityTemplatesActive ? 'page' : undefined}
              aria-disabled={isWrapupPending || undefined}
              onClick={() => navigate('/activity-templates')}
              sx={{
                justifyContent: 'center',
                py: 1.5,
                px: 0,
                position: 'relative',
                minHeight: 48,
                color: isActivityTemplatesActive ? '#EB6A2C' : '#A8B5C2',
                bgcolor: isActivityTemplatesActive ? 'rgba(235,106,44,0.08)' : 'transparent',
                '&:hover': {
                  bgcolor: isActivityTemplatesActive
                    ? 'rgba(235,106,44,0.12)'
                    : 'rgba(255,255,255,0.08)',
                },
                '&.Mui-selected': {
                  bgcolor: 'rgba(235,106,44,0.08)',
                  '&:hover': { bgcolor: 'rgba(235,106,44,0.12)' },
                },
              }}
            >
              {isActivityTemplatesActive && (
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    bgcolor: '#EB6A2C',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}
              <Box
                aria-hidden="true"
                sx={{
                  color: isActivityTemplatesActive ? '#EB6A2C' : '#A8B5C2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AccountTreeOutlinedIcon sx={{ fontSize: 22 }} />
              </Box>
            </ListItemButton>
          </Tooltip>
        </List>

        {/* Brand logo mark at bottom */}
        <Box
          sx={{
            pb: 2,
            display: 'flex',
            justifyContent: 'center',
          }}
          aria-hidden="true"
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: '#EB6A2C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="span"
              sx={{
                color: '#FFFFFF',
                fontSize: '0.5rem',   // 8px micro label
                fontWeight: 700,
                letterSpacing: '0.02em',
                userSelect: 'none',
              }}
            >
              CCM
            </Box>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
