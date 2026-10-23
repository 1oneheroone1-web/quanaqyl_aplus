import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Render the real components without a browser, authentication, API calls or new dependencies.
// This catches missing resources/translations and unsafe links; it does not test browser layout.
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'quanaqyl-hub-'));
const compiled = new Map();
async function compile(name) {
  if (compiled.has(name)) return compiled.get(name);
  const destination = join(directory, name + '.mjs');
  compiled.set(name, destination);
  const isJson = name.endsWith('.json');
  let filename = name;
  if (!isJson) {
    try { await readFile(join(root, name + '.tsx')); filename += '.tsx'; }
    catch { filename += '.ts'; }
  }
  const source = await readFile(join(root, filename), 'utf8');
  let output = isJson ? `export default ${source};` : ts.transpileModule(source, {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const imports = [...output.matchAll(/from\s+(['"])(@\/[^'"]+|\.{1,2}\/[^'"]+)\1/g)];
  for (const match of imports) {
    const nameToLoad = match[2].startsWith('@/') ? match[2].slice(2) : relative(root, resolve(root, dirname(name), match[2]));
    const dependency = await compile(nameToLoad);
    output = output.replace(match[0], `from ${JSON.stringify(pathToFileURL(dependency).href)}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, output);
  return destination;
}
const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
try {
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  const load = async name => import(pathToFileURL(await compile(name)).href);
  const { default: TheoryLibrary } = await load('components/theory-library');
  const { default: PhysicsHub } = await load('components/physics-hub');
  const { physicsTheoryModules, physicsGrades } = await load('lib/physics-theory');
  const { tr } = await load('lib/i18n');
  const props = { onGradeChange() {}, onModuleChange() {}, onExplore() {} };
  for (const lang of ['en', 'ru', 'kk']) {
    for (const grade of physicsGrades) {
      const html = renderToStaticMarkup(createElement(TheoryLibrary, { ...props, lang, grade, openModule: '' }));
      assert.equal((html.match(/role="radio"/g) ?? []).length, 6);
      if (grade < 9) {
        assert.ok(html.includes(escape(tr('theoryComingTitle', lang).replace('{grade}', String(grade)))));
        assert.ok(html.includes(escape(tr('tryPhysicsAction', lang))));
        assert.equal((html.match(/target="_blank"/g) ?? []).length, 0);
      } else {
        for (const chapter of physicsTheoryModules.filter(module => module.grade === grade)) assert.ok(html.includes(escape(chapter.topic[lang])));
      }
    }
    for (const chapter of physicsTheoryModules) {
      const html = renderToStaticMarkup(createElement(TheoryLibrary, { ...props, lang, grade: chapter.grade, openModule: chapter.id }));
      assert.ok(html.includes(escape(chapter.focus[lang])));
      assert.equal((html.match(/target="_blank"/g) ?? []).length, chapter.resources.length);
      assert.equal((html.match(/rel="noopener noreferrer"/g) ?? []).length, chapter.resources.length);
      for (const resource of chapter.resources) {
        assert.ok(html.includes(`href="${escape(resource.url)}"`));
        assert.ok(html.includes(escape(resource.title)));
        if (resource.role === 'support') assert.ok(html.includes(escape(resource.focus[lang])));
      }
    }
    const hub = renderToStaticMarkup(createElement(PhysicsHub, { lang, level: '9', simulation: createElement('div', { id: 'simulation-slot' }) }));
    assert.equal((hub.match(/role="tab"/g) ?? []).length, 2);
    const tabs = [...hub.matchAll(/<button\b([^>]*role="tab"[^>]*)>([\s\S]*?)<\/button>/g)];
    const activeTab = tabs.find(tab => tab[1].includes('aria-selected="true"'));
    assert.ok(activeTab?.[2].includes(escape(tr('theory', lang))));
    assert.ok(hub.includes('id="simulation-slot"'));
    const simulationPanelStart = hub.lastIndexOf('role="tabpanel"', hub.indexOf('id="simulation-slot"'));
    const simulationPanelTag = hub.slice(simulationPanelStart, hub.indexOf('>', simulationPanelStart));
    assert.ok(simulationPanelTag.includes('hidden=""'));
  }
  console.log('PASS: real hub and accordion rendering, 6 grade controls, 7–8 empty states, all 36 expanded modules and 40 safe links in EN/RU/KK. Simulation slot retained.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
