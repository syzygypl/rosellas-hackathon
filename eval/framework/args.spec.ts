import { parseArgs } from './args';

describe('parseArgs', () => {
  it('parses repeated and comma-separated scenario arguments', () => {
    const args = parseArgs(['run', '-s', 'sdg12-ewaste,sdg6-wastewater', '--scenario=sdg7-remote-electricity']);
    expect(args.command).toBe('run');
    expect(args.scenarios).toEqual(['sdg12-ewaste,sdg6-wastewater', 'sdg7-remote-electricity']);
  });

  it('parses push flags', () => {
    expect(parseArgs(['push', '--dry-run', '--enable'])).toMatchObject({
      command: 'push',
      dryRun: true,
      enable: true,
    });
  });

  it('rejects conflicting judge flags', () => {
    expect(() => parseArgs(['run', '--require-llm-judge', '--skip-llm-judge'])).toThrow(/either/);
  });
});
