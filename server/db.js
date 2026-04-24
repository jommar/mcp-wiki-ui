import pkg from 'pg';
import 'dotenv/config';

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'wiki',
  password: process.env.DB_PASSWORD || 'wiki',
  database: process.env.DB_NAME || 'wiki',
});

pool.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch').catch(() => {});
pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm').catch(() => {});

export { pool };
