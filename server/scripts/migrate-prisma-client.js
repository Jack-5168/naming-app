#!/usr/bin/env node
/**
 * Migration Script - Replace PrismaClient instances with shared prisma
 *
 * Run: node scripts/migrate-prisma-client.js
 */

import {
  readFileSync, writeFileSync, readdirSync, statSync,
} from 'fs';
import { join, relative } from 'path';

const SRC_DIR = join(process.cwd(), 'src');
const IMPORT_STATEMENT = 'import { prisma } from \'../lib/prisma\';';
const IMPORT_REPLACE = (filePath) => `import { prisma } from '../lib/prisma';

// Legacy prisma removed - using shared instance`;

function findTsFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      findTsFiles(fullPath, files);
    } else if (
      entry.endsWith('.ts')
      && !entry.includes('.test.')
      && !entry.includes('.spec.')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function migrateFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');

  // Check if file uses PrismaClient
  if (!content.includes('new PrismaClient()')) {
    return false;
  }

  console.log(`Migrating: ${relative(SRC_DIR, filePath)}`);

  // Replace import
  if (content.includes("import { PrismaClient } from '@prisma/client'")) {
    content = content.replace(
      "import { PrismaClient } from '@prisma/client';",
      IMPORT_STATEMENT,
    );
  }

  // Remove "const prisma = new PrismaClient();"
  content = content.replace(/const prisma = new PrismaClient\(\);/g, '');

  // Remove standalone PrismaClient declarations
  content = content.replace(
    /const prisma = new PrismaClient\(\{\n.*\}\);/gs,
    '',
  );

  writeFileSync(filePath, content);
  return true;
}

// Main execution
const files = findTsFiles(SRC_DIR);
let migrated = 0;

for (const file of files) {
  if (migrateFile(file)) {
    migrated++;
  }
}

console.log(`\nMigrated ${migranted} files`);

// Verification
const remaining = [];
for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  if (content.includes('new PrismaClient()')) {
    remaining.push(relative(SRC_DIR, file));
  }
}

if (remaining.length > 0) {
  console.log(`\nRemaining ${remaining.length} files with new PrismaClient():`);
  remaining.forEach((f) => console.log(`  - ${f}`));
} else {
  console.log('\n✓ All PrismaClient instances migrated!');
}
