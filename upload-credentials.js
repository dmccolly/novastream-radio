import { getStore } from '@netlify/blobs';
import { readFileSync } from 'fs';

const store = getStore('google-drive');
const credentials = readFileSync('./google-drive-credentials.json', 'utf8');

await store.set('credentials', credentials);
console.log('Credentials uploaded to Netlify Blobs');
