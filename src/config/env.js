const required = (name, { production = false } = {}) => {
  const value = process.env[name];
  if (production && !value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export function getEnv() {
  const production = process.env.NODE_ENV === 'production';
  return Object.freeze({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL', { production }),
    openaiApiKey: required('OPENAI_API_KEY', { production }),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    apiKey: process.env.CORLEON_API_KEY,
  });
}

export function assertProductionEnv() {
  getEnv();
  return true;
}
