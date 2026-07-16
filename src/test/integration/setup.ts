import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load disposable-project credentials. Never falls back to EXPO_PUBLIC_* / app .env.
config({ path: resolve(process.cwd(), '.env.test.local') });
config({ path: resolve(process.cwd(), '.env.test') });

import { assertSafeIntegrationTarget, getIntegrationEnv } from './env';

// Fail closed before any suite runs.
assertSafeIntegrationTarget(getIntegrationEnv());
