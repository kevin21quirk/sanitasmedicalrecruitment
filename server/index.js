import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Sanitas CRM API on http://localhost:${port}`));
