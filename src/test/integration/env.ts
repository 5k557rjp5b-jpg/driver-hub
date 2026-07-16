const PRODUCTION_REF = 'kfefxjhowtyrpmddlivw';

export type IntegrationEnv = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  databaseUrl: string;
  allowedProjectRefs: string[];
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Integration tests refuse to start: ${name} is unset. ` +
        `Copy .env.test.example to .env.test.local and use a disposable project only.`,
    );
  }
  return value;
}

export function getIntegrationEnv(): IntegrationEnv {
  return {
    supabaseUrl: required('TEST_SUPABASE_URL'),
    anonKey: required('TEST_SUPABASE_ANON_KEY'),
    serviceRoleKey: required('TEST_SUPABASE_SERVICE_ROLE_KEY'),
    databaseUrl: required('TEST_DATABASE_URL'),
    allowedProjectRefs: required('TEST_ALLOWED_PROJECT_REFS')
      .split(',')
      .map((ref) => ref.trim())
      .filter(Boolean),
  };
}

function extractProjectRef(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname;
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function assertSafeIntegrationTarget(env: IntegrationEnv): void {
  const blob = [
    env.supabaseUrl,
    env.databaseUrl,
    env.anonKey,
    env.serviceRoleKey,
    env.allowedProjectRefs.join(','),
  ].join('\n');

  if (blob.includes(PRODUCTION_REF)) {
    throw new Error(
      `Integration tests refuse to start: production ref ${PRODUCTION_REF} detected in TEST_* env.`,
    );
  }

  const projectRef = extractProjectRef(env.supabaseUrl);
  if (!projectRef) {
    throw new Error(
      `Integration tests refuse to start: TEST_SUPABASE_URL must be https://<ref>.supabase.co`,
    );
  }

  if (!env.allowedProjectRefs.includes(projectRef)) {
    throw new Error(
      `Integration tests refuse to start: project ref "${projectRef}" is not in TEST_ALLOWED_PROJECT_REFS.`,
    );
  }

  if (env.databaseUrl.includes(PRODUCTION_REF)) {
    throw new Error(
      `Integration tests refuse to start: TEST_DATABASE_URL points at production ref ${PRODUCTION_REF}.`,
    );
  }

  // Prefer localhost OR an explicitly allowlisted disposable cloud project.
  let dbHost = '';
  try {
    dbHost = new URL(env.databaseUrl).hostname;
  } catch {
    // postgres:// URLs are valid; URL() handles them in Node.
    throw new Error('Integration tests refuse to start: TEST_DATABASE_URL is not a valid URL.');
  }

  const isLocal = dbHost === 'localhost' || dbHost === '127.0.0.1';
  const isAllowlistedCloud = dbHost === `db.${projectRef}.supabase.co`;
  if (!isLocal && !isAllowlistedCloud) {
    throw new Error(
      `Integration tests refuse to start: TEST_DATABASE_URL host "${dbHost}" is neither localhost nor db.${projectRef}.supabase.co.`,
    );
  }
}
