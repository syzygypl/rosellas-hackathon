import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_TOKENS_PATH = 'design-system/tokens/rosellas.tokens.json';
export const DEFAULT_KIT_PATH = 'design-system/figma/ui-kit.json';

const FIGMA_TYPES = new Set(['BOOLEAN', 'COLOR', 'FLOAT', 'STRING']);

export function readJson(filePath) {
  const absolutePath = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

export function loadTokens(filePath = DEFAULT_TOKENS_PATH) {
  const tokens = readJson(filePath);
  return validateTokens(tokens);
}

export function loadKitManifest(filePath = DEFAULT_KIT_PATH) {
  const manifest = readJson(filePath);
  return validateKitManifest(manifest);
}

export function validateTokens(tokens) {
  assertObject(tokens, 'Token document');
  assertString(tokens.name, 'Token document name');
  assertString(tokens.version, 'Token document version');
  assertArray(tokens.collections, 'Token document collections');

  const collectionNames = new Set();

  for (const collection of tokens.collections) {
    assertObject(collection, 'Collection');
    assertString(collection.name, 'Collection name');
    assert(!collectionNames.has(collection.name), `Duplicate collection name: ${collection.name}`);
    collectionNames.add(collection.name);
    assertArray(collection.modes, `Collection "${collection.name}" modes`);
    assert(collection.modes.length > 0, `Collection "${collection.name}" must define at least one mode`);

    const modeNames = new Set();
    let canonicalTokenTypes = null;

    for (const mode of collection.modes) {
      assertObject(mode, `Mode in collection "${collection.name}"`);
      assertString(mode.name, `Mode name in collection "${collection.name}"`);
      assert(!modeNames.has(mode.name), `Duplicate mode "${mode.name}" in collection "${collection.name}"`);
      modeNames.add(mode.name);
      assertArray(mode.tokens, `Tokens for "${collection.name}/${mode.name}"`);

      const tokenTypes = new Map();

      for (const token of mode.tokens) {
        assertObject(token, `Token in "${collection.name}/${mode.name}"`);
        assertString(token.name, `Token name in "${collection.name}/${mode.name}"`);
        assert(!token.name.includes('.') && !token.name.includes('{') && !token.name.includes('}'), `Figma variable names cannot contain '.', '{', or '}': ${collection.name}/${token.name}`);
        assertString(token.type, `Token type for "${collection.name}/${token.name}"`);
        assert(FIGMA_TYPES.has(token.type), `Unsupported token type "${token.type}" for "${collection.name}/${token.name}"`);
        assert(!tokenTypes.has(token.name), `Duplicate token "${token.name}" in "${collection.name}/${mode.name}"`);
        validateTokenValue(token, collection.name);
        validateCodeSyntax(token, collection.name);
        tokenTypes.set(token.name, token.type);
      }

      if (canonicalTokenTypes === null) {
        canonicalTokenTypes = tokenTypes;
      } else {
        assertSameTokenSet(collection.name, canonicalTokenTypes, tokenTypes);
      }
    }
  }

  return tokens;
}

export function validateKitManifest(manifest) {
  assertObject(manifest, 'UI kit manifest');
  assertString(manifest.name, 'UI kit manifest name');
  assertString(manifest.version, 'UI kit manifest version');
  assertArray(manifest.figmaPages, 'UI kit Figma pages');
  assertArray(manifest.textStyles, 'UI kit text styles');
  assertArray(manifest.components, 'UI kit components');
  assertArray(manifest.patterns, 'UI kit patterns');
  assertArray(manifest.exampleScreens, 'UI kit example screens');

  assert(manifest.figmaPages.length === 1, 'UI kit manifest must define exactly one Figma page for Starter-plan compatibility');

  const pageNames = new Set();
  for (const page of manifest.figmaPages) {
    assertObject(page, 'Figma page');
    assertString(page.name, 'Figma page name');
    assertString(page.purpose, `Figma page purpose for "${page.name}"`);
    assert(!pageNames.has(page.name), `Duplicate Figma page name: ${page.name}`);
    pageNames.add(page.name);
  }

  for (const style of manifest.textStyles) {
    assertObject(style, 'Text style');
    assertString(style.name, 'Text style name');
    assertString(style.family, `Text style family for "${style.name}"`);
    assertNumber(style.size, `Text style size for "${style.name}"`);
  }

  for (const component of manifest.components) {
    assertObject(component, 'Component');
    assertString(component.name, 'Component name');
    assertArray(component.variants, `Variants for component "${component.name}"`);
  }

  return manifest;
}

export function summarizeTokens(tokens) {
  const collections = tokens.collections.length;
  const modes = tokens.collections.reduce((count, collection) => count + collection.modes.length, 0);
  const variables = tokens.collections.reduce((count, collection) => count + collection.modes[0].tokens.length, 0);

  return { collections, modes, variables };
}

export function flattenCollectionTokens(collection) {
  const byName = new Map();

  for (const mode of collection.modes) {
    for (const token of mode.tokens) {
      if (!byName.has(token.name)) {
        byName.set(token.name, new Map());
      }

      byName.get(token.name).set(mode.name, token);
    }
  }

  return byName;
}

export function toFigmaValue(token) {
  switch (token.type) {
    case 'BOOLEAN':
      return token.value;
    case 'COLOR':
      return colorToFigmaValue(token.value);
    case 'FLOAT':
      return token.value;
    case 'STRING':
      return token.value;
    default:
      throw new Error(`Unsupported token type: ${token.type}`);
  }
}

export function colorToFigmaValue(value) {
  const normalizedValue = value.trim();

  if (!/^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(normalizedValue)) {
    throw new Error(`Invalid color value: ${value}`);
  }

  const hex = normalizedValue.replace('#', '');
  let r;
  let g;
  let b;
  let a = 255;

  if (hex.length === 3 || hex.length === 4) {
    r = Number.parseInt(hex[0] + hex[0], 16);
    g = Number.parseInt(hex[1] + hex[1], 16);
    b = Number.parseInt(hex[2] + hex[2], 16);
    if (hex.length === 4) {
      a = Number.parseInt(hex[3] + hex[3], 16);
    }
  } else if (hex.length === 6 || hex.length === 8) {
    r = Number.parseInt(hex.slice(0, 2), 16);
    g = Number.parseInt(hex.slice(2, 4), 16);
    b = Number.parseInt(hex.slice(4, 6), 16);
    if (hex.length === 8) {
      a = Number.parseInt(hex.slice(6, 8), 16);
    }
  } else {
    throw new Error(`Invalid color value: ${value}`);
  }

  return {
    r: roundColorChannel(r / 255),
    g: roundColorChannel(g / 255),
    b: roundColorChannel(b / 255),
    a: roundColorChannel(a / 255)
  };
}

export function metadataForVariable(token) {
  const metadata = {};

  if (typeof token.description === 'string') {
    metadata.description = token.description;
  }

  if (typeof token.hiddenFromPublishing === 'boolean') {
    metadata.hiddenFromPublishing = token.hiddenFromPublishing;
  }

  if (Array.isArray(token.scopes)) {
    metadata.scopes = token.scopes;
  }

  if (token.codeSyntax) {
    metadata.codeSyntax = token.codeSyntax;
  }

  return metadata;
}

function validateTokenValue(token, collectionName) {
  const label = `${collectionName}/${token.name}`;

  switch (token.type) {
    case 'BOOLEAN':
      assert(typeof token.value === 'boolean', `BOOLEAN token "${label}" must use a boolean value`);
      break;
    case 'COLOR':
      assertString(token.value, `COLOR token value for "${label}"`);
      colorToFigmaValue(token.value);
      break;
    case 'FLOAT':
      assertNumber(token.value, `FLOAT token value for "${label}"`);
      break;
    case 'STRING':
      assertString(token.value, `STRING token value for "${label}"`);
      break;
  }
}

function validateCodeSyntax(token, collectionName) {
  if (token.codeSyntax === undefined) {
    return;
  }

  assertObject(token.codeSyntax, `codeSyntax for "${collectionName}/${token.name}"`);

  for (const [platform, value] of Object.entries(token.codeSyntax)) {
    assert(['WEB', 'ANDROID', 'iOS'].includes(platform), `Unsupported codeSyntax platform "${platform}" for "${collectionName}/${token.name}"`);
    assertString(value, `codeSyntax.${platform} for "${collectionName}/${token.name}"`);
  }
}

function assertSameTokenSet(collectionName, expected, actual) {
  for (const [name, type] of expected) {
    assert(actual.has(name), `Mode token mismatch in "${collectionName}": missing token "${name}"`);
    assert(actual.get(name) === type, `Mode token type mismatch in "${collectionName}/${name}"`);
  }

  for (const name of actual.keys()) {
    assert(expected.has(name), `Mode token mismatch in "${collectionName}": unexpected token "${name}"`);
  }
}

function roundColorChannel(value) {
  return Number(value.toFixed(6));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertObject(value, label) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertNumber(value, label) {
  assert(typeof value === 'number' && Number.isFinite(value), `${label} must be a finite number`);
}
