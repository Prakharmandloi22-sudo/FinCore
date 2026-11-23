import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  jwt: {
    secret: process.env.JWT_SECRET || 'fincore-super-secure-jwt-dev-secret-key-32-bytes',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    reauthSecret: process.env.REAUTH_TOKEN_SECRET || 'fincore-sensitive-reauth-action-secret',
    reauthExpiry: '5m'
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'fincore_db',
    user: process.env.DB_USER || 'fincore_user',
    password: process.env.DB_PASSWORD || 'fincore_secure_password_replace_in_prod',
    ssl: process.env.DB_SSL === 'true',
    url: process.env.DATABASE_URL
  },
  analytics: {
    url: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8000',
    apiKey: process.env.ANALYTICS_API_KEY || 'fincore-internal-service-key-7890'
  },
  payments: {
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'whsec_test_mock_webhook_secret_fincore_2026',
    apiKey: process.env.PAYMENT_PROVIDER_API_KEY || 'pk_test_simulated_fincore_key_2026'
  },
  notifications: {
    sandboxEnabled: process.env.NOTIFICATION_SANDBOX_ENABLED !== 'false'
  }
};

