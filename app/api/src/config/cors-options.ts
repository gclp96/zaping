const LOCAL_FRONTEND_ORIGIN = 'http://localhost:3000';

export type CorsConfig = {
  nodeEnv: string;
  frontendOrigin: string;
};

export function buildCorsOptions({ nodeEnv, frontendOrigin }: CorsConfig) {
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  if (!frontendOrigin || frontendOrigin === '*') {
    throw new Error('FRONTEND_ORIGIN must be a concrete origin');
  }

  const allowedOrigins =
    nodeEnv === 'production'
      ? [frontendOrigin]
      : Array.from(new Set([frontendOrigin, LOCAL_FRONTEND_ORIGIN]));

  return {
    origin: (
      requestOrigin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => {
      callback(null, !requestOrigin || allowedOrigins.includes(requestOrigin));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
