import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadScenarios, selectScenarios } from './scenarios';

describe('scenario loading', () => {
  it('loads and selects comma-separated scenario ids', () => {
    const all = loadScenarios();
    const selected = selectScenarios(all, ['sdg12-ewaste,sdg6-wastewater']);
    expect(selected.map((scenario) => scenario.id)).toEqual(['sdg12-ewaste', 'sdg6-wastewater']);
  });

  it('reports available ids for an unknown selector', () => {
    const all = loadScenarios();
    expect(() => selectScenarios(all, ['missing'])).toThrow(/Available: .*sdg12-ewaste/);
  });

  it('validates scenario schema', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rosellas-eval-'));
    try {
      writeFileSync(join(dir, 'bad.json'), JSON.stringify({ id: 'bad' }));
      expect(() => loadScenarios(dir)).toThrow(/title must be a non-empty string/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
