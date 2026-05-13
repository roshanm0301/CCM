/**
 * LoginPage — Screen 1.
 *
 * Layout: centered card on background.default, no header.
 * Fields: User ID (username), Password.
 * Submission: POST /api/v1/auth/login.
 * On success: navigate to /workspace (ProtectedRoute calls /me + /csrf to hydrate auth store).
 * Field errors: shown as helperText on individual fields.
 * API errors: shown in MUI Alert below the form.
 * Session-expired redirect: reads ?reason=session_expired from URL.
 *
 * Source: ux-specification.md Screen 1, phase1-technical-blueprint.md §5.1
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  LinearProgress,
  TextField,
  Typography,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import axios from 'axios';
import { apiClient } from '@/shared/api/client';
import { useAuthStore, type AuthUser } from '@/features/auth/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoginApiResponse {
  success: true;
  data: {
    user: {
      id: string;
      username: string;
      displayName: string;
      roles: string[];
      agentStatus: string;
    };
    // NOTE: csrfToken is no longer returned in the response body.
    // It is set as a readable (httpOnly=false) cookie by the server.
    // ProtectedRoute restores the CSRF token via GET /api/v1/auth/csrf on
    // the first workspace load — no need to parse the cookie here.
  };
}

interface DealerLoginApiResponse {
  success: true;
  data: {
    user: {
      id: string;
      username: string;
      displayName: string;
      roles: string[];
      dealerRef: string | null;
    };
  };
}

interface CsrfResponse {
  success: true;
  data: {
    csrfToken: string;
  };
}

interface LoginApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Error code → display message mapping
// Source: ux-specification.md §1.6 and Appendix validation messages
// ---------------------------------------------------------------------------
const API_ERROR_MESSAGES: Record<string, string> = {
  AUTH_FAILED: 'Unable to sign in. Please try again.',
  ACCOUNT_INACTIVE: 'Your account is inactive.',
  ROLE_NOT_AGENT: 'You are not authorized for Agent workspace.',
  AUTH_SERVICE_ERROR: 'Unable to sign in. Please try again.',
  VALIDATION_ERROR: 'Unable to sign in. Please try again.',
};

function mapApiErrorToMessage(code: string): string {
  return API_ERROR_MESSAGES[code] ?? 'Unable to sign in. Please try again.';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, setAuth, isDealer } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Field-level validation errors
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // API-level error (shown in Alert)
  const [apiError, setApiError] = useState('');

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Show session-expired message if redirected here with that reason
  const sessionExpiredReason = searchParams.get('reason') === 'session_expired';

  // If already authenticated, skip login — route by role so dealers go to
  // their catalog and agents go to the workspace.
  useEffect(() => {
    if (isAuthenticated) {
      navigate(isDealer ? '/dealer-catalog' : '/workspace', { replace: true });
    }
  }, [isAuthenticated, isDealer, navigate]);

  // Clear field error on first keystroke after a failed submit
  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUsername(e.target.value);
    if (usernameError) setUsernameError('');
    if (apiError) setApiError('');
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (passwordError) setPasswordError('');
    if (apiError) setApiError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validation: both fields required
    let hasError = false;
    if (!username.trim()) {
      setUsernameError('Enter User ID.');
      hasError = true;
    }
    if (!password) {
      setPasswordError('Enter Password.');
      hasError = true;
    }
    if (hasError) {
      // Return focus to first failing field
      if (!username.trim()) {
        usernameRef.current?.focus();
      } else {
        passwordRef.current?.focus();
      }
      return;
    }

    setSubmitting(true);
    setApiError('');

    const credentials = { username: username.trim(), password };

    try {
      const agentRes = await apiClient.post<LoginApiResponse>('/api/v1/auth/login', credentials);
      const agentUser = agentRes.data.data.user;
      const csrfRes = await apiClient.get<CsrfResponse>('/api/v1/auth/csrf');
      const user: AuthUser = {
        id: agentUser.id,
        username: agentUser.username,
        displayName: agentUser.displayName,
        roles: agentUser.roles,
        dealerRef: null,
      };
      setAuth(user, csrfRes.data.data.csrfToken);
      navigate('/workspace', { replace: true });
    } catch (agentErr: unknown) {
      if (axios.isAxiosError(agentErr)) {
        const agentStatus = agentErr.response?.status;

        if (agentStatus === 403) {
          // User exists but is not an agent — try dealer endpoint
          try {
            const dealerRes = await apiClient.post<DealerLoginApiResponse>(
              '/api/v1/dealer-auth/login',
              credentials,
            );
            const dealerUser = dealerRes.data.data.user;
            const csrfRes = await apiClient.get<CsrfResponse>('/api/v1/auth/csrf');
            const user: AuthUser = {
              id: dealerUser.id,
              username: dealerUser.username,
              displayName: dealerUser.displayName,
              roles: dealerUser.roles,
              dealerRef: dealerUser.dealerRef,
            };
            setAuth(user, csrfRes.data.data.csrfToken);
            navigate('/dealer-catalog', { replace: true });
          } catch (dealerErr: unknown) {
            setSubmitting(false);
            if (axios.isAxiosError(dealerErr)) {
              const dealerErrorData = dealerErr.response?.data as LoginApiError | undefined;
              if (dealerErrorData && !dealerErrorData.success) {
                setApiError(mapApiErrorToMessage(dealerErrorData.error.code));
              } else {
                setApiError('Unable to sign in. Please try again.');
              }
            } else {
              if (import.meta.env.DEV) {
                console.error('[CCM] Unexpected non-Axios error in dealer flow', dealerErr);
              }
              setApiError('Unable to sign in. Please try again.');
            }
            usernameRef.current?.focus();
          }
        } else {
          setSubmitting(false);
          const errorData = agentErr.response?.data as LoginApiError | undefined;
          if (errorData && !errorData.success) {
            setApiError(mapApiErrorToMessage(errorData.error.code));
          } else {
            setApiError('Unable to sign in. Please try again.');
          }
          // Return focus to username field on error per spec §1.9
          usernameRef.current?.focus();
        }
      } else {
        setSubmitting(false);
        if (import.meta.env.DEV) {
          console.error('[CCM] Unexpected non-Axios error in agent flow', agentErr);
        }
        setApiError('Unable to sign in. Please try again.');
        usernameRef.current?.focus();
      }
    }
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: { xs: 2, md: 0 },
        // 4px brand color strip at top for lg screens (spec §1.5)
        '&::before': {
          content: '""',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          bgcolor: '#EB6A2C',     // primary[500] brand orange
          display: { xs: 'none', lg: 'block' },
        },
      }}
    >
      <Card
        elevation={0}
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', md: 400 },
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Linear loader at top edge while submitting */}
        {submitting && (
          <LinearProgress
            aria-label="Signing in"
            sx={{ height: 3 }}
          />
        )}

        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          {/* App identity */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: '#EB6A2C',      // primary[500]
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1,
              }}
              aria-hidden="true"
            >
              <Typography
                component="span"
                sx={{ color: '#FFFFFF', fontWeight: 'strong', fontSize: 'sm' }}
              >
                CCM
              </Typography>
            </Box>
            <Typography
              variant="h2"
              component="h1"
              color="text.primary"
              sx={{ fontSize: { xs: 'xl', md: 'xl' } }}
            >
              Call Centre Management
            </Typography>
          </Box>

          {/* Session expired alert */}
          {sessionExpiredReason && !apiError && (
            <Alert
              severity="warning"
              variant="outlined"
              role="alert"
              sx={{ mb: 2 }}
            >
              Your session has expired. Please sign in again.
            </Alert>
          )}

          {/* API error alert */}
          {apiError && (
            <Alert
              severity="error"
              variant="outlined"
              role="alert"
              sx={{ mb: 2 }}
            >
              {apiError}
            </Alert>
          )}

          {/* Login form */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            aria-label="Sign in form"
          >
            <TextField
              id="login-username"
              name="userId"
              label="User ID"
              type="text"
              size="small"
              required
              autoComplete="username"
              autoFocus
              fullWidth
              value={username}
              onChange={handleUsernameChange}
              error={Boolean(usernameError)}
              helperText={usernameError || ' '}
              inputRef={usernameRef}
              disabled={submitting}
              inputProps={{
                'aria-label': 'User ID',
                'aria-describedby': usernameError ? 'username-error' : undefined,
              }}
              FormHelperTextProps={{
                id: 'username-error',
                role: usernameError ? 'alert' : undefined,
              }}
              sx={{ mb: 1 }}
            />

            <TextField
              id="login-password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              size="small"
              required
              autoComplete="current-password"
              fullWidth
              value={password}
              onChange={handlePasswordChange}
              error={Boolean(passwordError)}
              helperText={passwordError || ' '}
              inputRef={passwordRef}
              disabled={submitting}
              inputProps={{
                'aria-label': 'Password',
                'aria-describedby': passwordError ? 'password-error' : undefined,
              }}
              FormHelperTextProps={{
                id: 'password-error',
                role: passwordError ? 'alert' : undefined,
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Toggle password visibility"
                      onClick={() => setShowPassword((prev) => !prev)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                      size="small"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <VisibilityOff fontSize="small" />
                      ) : (
                        <Visibility fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <Button
              id="login-submit"
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={submitting}
              aria-label="Sign in to CCM"
              sx={{
                mt: 1,
                bgcolor: '#EB6A2C',
                color: '#FFFFFF',
                '&:hover': { bgcolor: '#C45A24' },
                '&.Mui-disabled': { bgcolor: '#EB6A2C', opacity: 0.5, color: '#FFFFFF' },
              }}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
