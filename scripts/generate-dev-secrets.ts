import * as fs from 'fs';
import * as crypto from 'crypto';

const env = process.argv[2];


if (!env || !['local', 'beta'].includes(env)) {
  console.error('Usage: pnpm generate:secrets <local|beta>');
  process.exit(1);
}

if (env === 'production') {
  console.error('Refusing to generate production secrets.');
  process.exit(1);
}

function token(): string {
  return crypto.randomBytes(64).toString('hex');
}

const outputFile = `.env.${env}.local`;

if (fs.existsSync(outputFile)) {
  console.error(`${outputFile} already exists. Aborting.`);
  process.exit(1);
}

const content = `
${env.toUpperCase()}_ACCESS_TOKEN_SECRET=${token()}
${env.toUpperCase()}_REFRESH_TOKEN_SECRET=${token()}
`.trim();

fs.writeFileSync(outputFile, content + '\n');
console.log(`Secrets written to ${outputFile}`);