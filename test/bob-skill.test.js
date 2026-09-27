import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SKILL_FILE = path.resolve('bob/skill/HUMBLE.md');
const SRC_DIR = path.resolve('src');

test('bob skill file exists', () => {
  assert.ok(fs.existsSync(SKILL_FILE), `Skill file not found at ${SKILL_FILE}`);
});

test('skill file mentions only existing MCP tools', () => {
  const skill = fs.readFileSync(SKILL_FILE, 'utf8');
  const mcpTools = [
    'firstrun_plan',
    'firstrun_verify',
    'firstrun_status',
    'firstrun_evidence',
    'firstrun_guide',
    'firstrun_drift',
  ];
  for (const tool of mcpTools) {
    assert.match(skill, new RegExp(`\\b${tool}\\b`), `Skill should mention MCP tool ${tool}`);
  }
});

test('all MCP tools exist in src/mcp.js', () => {
  const mcp = fs.readFileSync(path.join(SRC_DIR, 'mcp.js'), 'utf8');
  const tools = [
    'firstrun_plan',
    'firstrun_verify',
    'firstrun_status',
    'firstrun_evidence',
    'firstrun_guide',
    'firstrun_drift',
  ];
  for (const tool of tools) {
    assert.match(mcp, new RegExp(`registerTool\\(['"]${tool}['"]`), `MCP tool ${tool} not registered in src/mcp.js`);
  }
});

test('skill file mentions only existing CLI commands', () => {
  const skill = fs.readFileSync(SKILL_FILE, 'utf8');
  const cli = fs.readFileSync(path.join(SRC_DIR, 'cli.js'), 'utf8');
  const commands = [
    'plan',
    'verify',
    'replay',
    'audit',
    'scout',
    'doctor',
    'scribe',
    'guide',
    'guard',
    'apply',
    'pr',
    'ui',
    'mcp',
    'lens',
    'dock',
    'bob',
    'clean',
  ];
  for (const cmd of commands) {
    const pattern = cmd.includes(' ') ? cmd.replace(' ', '\\s+') : cmd;
    assert.match(cli, new RegExp(`case ['"]${pattern}['"]`), `CLI command ${cmd} not found in src/cli.js`);
  }
});

test('skill file mentions only existing mode slugs', () => {
  const skill = fs.readFileSync(SKILL_FILE, 'utf8');
  const modes = fs.readFileSync(path.join(SRC_DIR, 'brain/modes.js'), 'utf8');
  const slugs = ['firstrun', 'firstrun-doctor', 'firstrun-planner', 'firstrun-guide'];
  for (const slug of slugs) {
    assert.match(modes, new RegExp(`slug:\\s*['"]${slug}['"]`), `Mode slug ${slug} not found in src/brain/modes.js`);
  }
});

test('skill file mentions passport.svg and passportBadge', () => {
  const skill = fs.readFileSync(SKILL_FILE, 'utf8');
  const passport = fs.readFileSync(path.join(SRC_DIR, 'scribe/passport.js'), 'utf8');
  assert.match(skill, /passport\.svg/, 'Skill should mention passport.svg');
  assert.match(passport, /export function passportBadge/, 'passportBadge not exported from src/scribe/passport.js');
});

test('skill file mentions custom_modes.yaml and mcp.json', () => {
  const skill = fs.readFileSync(SKILL_FILE, 'utf8');
  assert.match(skill, /custom_modes\.yaml/, 'Skill should mention custom_modes.yaml');
  assert.match(skill, /mcp\.json/, 'Skill should mention mcp.json');
  assert.ok(fs.existsSync(path.resolve('.bob/custom_modes.yaml')), '.bob/custom_modes.yaml missing');
  assert.ok(fs.existsSync(path.resolve('.bob/mcp.json')), '.bob/mcp.json missing');
});

test('skill file mentions bin/firstrun.js entry point', () => {
  const skill = fs.readFileSync(SKILL_FILE, 'utf8');
  assert.match(skill, /bin\/firstrun\.js/, 'Skill should mention bin/firstrun.js');
  assert.ok(fs.existsSync(path.resolve('bin/firstrun.js')), 'bin/firstrun.js missing');
});