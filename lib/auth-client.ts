'use client';

import { createAuthClient } from 'better-auth/react';

// Same-origin requests keep cookies and CSRF checks on the current deployment.
export const authClient = createAuthClient({ basePath: '/api/auth' });
