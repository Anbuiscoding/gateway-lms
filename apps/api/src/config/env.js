// Loads environment variables no matter where npm starts the process from.
// Order matters: dotenv never overrides a value that is already set, so apps/api/.env wins over the root .env.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, '../../.env') });       // apps/api/.env
config({ path: path.resolve(here, '../../../../.env') }); // repo root .env

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Copy .env.example to .env in the project root and fill it in.');
  process.exit(1);
}
