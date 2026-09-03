const LOCAL_FRONTEND_URL = 'http://localhost:3000';

export type NodeEnvironment = 'development' | 'test' | 'production';
export type EnvironmentVariables = Record<string, string | undefined>;

function isNodeEnvironment(value: string): value is NodeEnvironment {
  return ['development', 'test', 'production'].includes(value);
}

function requiredValue(
  environment: EnvironmentVariables,
  name: string,
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be defined`);
  }

  return value;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function validateFrontendOrigin(
  value: string,
  nodeEnv: NodeEnvironment,
): string {
  const parsed = parseHttpUrl(value);

  if (!parsed || parsed.pathname !== '/') {
    throw new Error('FRONTEND_ORIGIN must be a valid HTTP(S) origin');
  }

  if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
    throw new Error('FRONTEND_ORIGIN must use HTTPS in production');
  }

  return parsed.origin;
}

function validateFrontendBaseUrl(
  value: string,
  nodeEnv: NodeEnvironment,
): string {
  const parsed = parseHttpUrl(value);

  if (!parsed) {
    throw new Error('FRONTEND_BASE_URL must be a valid HTTP(S) URL');
  }

  if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
    throw new Error('FRONTEND_BASE_URL must use HTTPS in production');
  }

  return value;
}

export function validateEnvironment(
  environment: EnvironmentVariables,
): EnvironmentVariables {
  const nodeEnvValue = requiredValue(environment, 'NODE_ENV');

  if (!isNodeEnvironment(nodeEnvValue)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const nodeEnv = nodeEnvValue;

  const databaseUrl = requiredValue(environment, 'DATABASE_URL');
  const jwtSecret = requiredValue(environment, 'JWT_SECRET');

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  const frontendOriginValue =
    environment.FRONTEND_ORIGIN?.trim() ||
    (nodeEnv === 'production' ? '' : LOCAL_FRONTEND_URL);
  const frontendBaseUrlValue =
    environment.FRONTEND_BASE_URL?.trim() ||
    (nodeEnv === 'production' ? '' : LOCAL_FRONTEND_URL);
  const frontendOrigin = validateFrontendOrigin(
    requiredValue({ FRONTEND_ORIGIN: frontendOriginValue }, 'FRONTEND_ORIGIN'),
    nodeEnv,
  );
  const frontendBaseUrl = validateFrontendBaseUrl(
    requiredValue(
      { FRONTEND_BASE_URL: frontendBaseUrlValue },
      'FRONTEND_BASE_URL',
    ),
    nodeEnv,
  );

  const validatedEnvironment: EnvironmentVariables = {
    ...environment,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    FRONTEND_ORIGIN: frontendOrigin,
    FRONTEND_BASE_URL: frontendBaseUrl,
  };

  if (nodeEnv === 'production') {
    validatedEnvironment.RESEND_API_KEY = requiredValue(
      environment,
      'RESEND_API_KEY',
    );
    validatedEnvironment.EMAIL_FROM = requiredValue(environment, 'EMAIL_FROM');
  } else {
    if (environment.RESEND_API_KEY?.trim()) {
      validatedEnvironment.RESEND_API_KEY = environment.RESEND_API_KEY.trim();
    }

    if (environment.EMAIL_FROM?.trim()) {
      validatedEnvironment.EMAIL_FROM = environment.EMAIL_FROM.trim();
    }
  }

  return validatedEnvironment;
}
