#!/usr/bin/env node

import { DEFAULT_KIT_PATH, DEFAULT_TOKENS_PATH, loadKitManifest, loadTokens, summarizeTokens } from './lib.mjs';

const tokensPath = getArgValue('--tokens', DEFAULT_TOKENS_PATH);
const kitPath = getArgValue('--kit', DEFAULT_KIT_PATH);

const tokens = loadTokens(tokensPath);
const kit = loadKitManifest(kitPath);
const summary = summarizeTokens(tokens);

console.log(`Design system tokens: ${summary.collections} collections, ${summary.modes} modes, ${summary.variables} variables.`);
console.log(`Figma UI kit manifest: ${kit.figmaPages.length} ${pluralize('page', kit.figmaPages.length)}, ${kit.textStyles.length} text styles, ${kit.components.length} components, ${kit.patterns.length} patterns.`);
console.log('Design system validation passed.');

function pluralize(label, count) {
  return count === 1 ? label : label + 's';
}

function getArgValue(name, fallback) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const value = process.argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}
