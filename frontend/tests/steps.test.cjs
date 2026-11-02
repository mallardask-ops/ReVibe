const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const steps = {};
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/steps.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function("require", "exports", code)(require, steps);
const { groupSteps, summarizeSteps, durationSeconds, editChanges } = steps;

const tool = (id, toolName, input = {}, status = 'completed') => ({ id, type: 'effect', detail: { toolName, input }, state: { status } });
const msg = id => ({ id, type: 'message', role: 'assistant' });

test('consecutive tool calls fold into one group; lone calls stay single', () => {
  const items = groupSteps([msg('a'), tool('t1', 'bash'), tool('t2', 'read_file'), msg('b'), tool('t3', 'bash'), msg('c')]);
  assert.deepEqual(items.map(i => i.kind), ['entry', 'group', 'entry', 'entry', 'entry']);
  assert.deepEqual(items[1].entries.map(e => e.id), ['t1', 't2']);
  assert.equal(items[3].entry.id, 't3');
});

test('commands the user ran with ! stay on their own', () => {
  const manual = id => ({ id, type: 'effect', turnId: null, detail: { toolName: 'shell', kind: 'shell' }, state: { status: 'completed' } });
  const agentShell = { ...tool('t2', 'shell'), turnId: 'turn-1', detail: { toolName: 'shell', kind: 'shell' } };
  const items = groupSteps([manual('m1'), manual('m2'), tool('t1', 'bash'), agentShell]);
  assert.deepEqual(items.map(i => i.kind), ['entry', 'entry', 'group']);
  assert.deepEqual(items[2].entries.map(e => e.id), ['t1', 't2']);
});

test('summary names commands, files and other tools in order of appearance', () => {
  const s = summarizeSteps([
    tool('1', 'bash'), tool('2', 'bash'), tool('3', 'read_file', { path: 'src/ui/theme.rs' }),
    tool('4', 'read_file', { path: 'a/config.rs' }), tool('5', 'read_file', { path: 'b/mod.rs' }), tool('6', 'web_fetch'),
  ]);
  assert.equal(s, 'Ran 2 commands · Read theme.rs and 2 more · Used 1 tool');
  assert.equal(summarizeSteps([tool('1', 'edit_file', { path: 'x/a.rs' }), tool('2', 'write_file', { path: 'b.rs' })]), 'Edited a.rs and b.rs');
});

test('durations accept second and millisecond timestamps', () => {
  assert.equal(durationSeconds({ createdAt: 100, updatedAt: 106 }), 6);
  assert.equal(durationSeconds({ createdAt: 1_700_000_000_000, updatedAt: 1_700_000_008_400 }), 8);
  assert.equal(durationSeconds({ createdAt: 10, updatedAt: 5 }), null);
});

test('file edits count only the lines that changed', () => {
  const edit = { type: 'effect', detail: { kind: 'file_edit', input: { oldString: 'a\nb\nc\nd', newString: 'a\nB\nb2\nc\nd' } }, state: { status: 'completed' } };
  const c = editChanges(edit);
  assert.equal(c.added, 2);
  assert.equal(c.removed, 1);
  assert.deepEqual(c.hunks[0], { removed: ['b'], added: ['B', 'b2'], context: 1 });
  const batch = { type: 'effect', detail: { kind: 'file_edit', input: { changes: [{ oldString: 'x', newString: 'y' }, { oldString: 'p', newString: '' }] } } };
  assert.deepEqual([editChanges(batch).added, editChanges(batch).removed], [1, 2]);
  const write = { type: 'effect', detail: { kind: 'file_write', input: { content: 'one\ntwo' } }, state: { output: { previousContent: '' } } };
  assert.deepEqual([editChanges(write).added, editChanges(write).removed], [2, 0]);
  assert.equal(editChanges({ type: 'effect', detail: { kind: 'shell' } }), null);
});

test('tool output is always text, whatever shape Vibe sends', () => {
  const out = (output, outputText = '') => steps.toolOutputText({ state: { output, outputText } });
  assert.equal(out(null, 'plain'), 'plain');
  assert.equal(out({ filePath: '/a', content: 'file body' }), 'file body');
  assert.equal(out({ stdout: 'hi', stderr: 'oops', output: '' }), 'hi\noops');
  assert.equal(out({ stdout: '', stderr: '', output: '' }), '');
  assert.equal(out({ content: [], error: { message: 'not found' } }), 'not found');
  assert.equal(out(undefined), '');
  const rest = out({ _meta: { a: 1 }, type: 'success', content: [] });
  assert.equal(typeof rest, 'string');
  assert.deepEqual(JSON.parse(rest), { type: 'success', content: [] });
});
