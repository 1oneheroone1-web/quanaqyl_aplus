import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Exercise scoring and recommendations without the production identity or database.
const directory = await mkdtemp(join(tmpdir(), 'quanaqyl-check-'));
try {
  const theorySource = JSON.parse(await readFile(new URL('../lib/theory-source.json', import.meta.url), 'utf8'));
  for (const name of ['catalog', 'grading', 'learning', 'profile', 'physics-theory', 'i18n']) {
    const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/from '\.\/catalog'/g, "from './catalog.mjs'")
      .replace("import source from './theory-source.json';", `const source = ${JSON.stringify(theorySource)};`);
    await writeFile(join(directory, `${name}.mjs`), output);
  }
  const load = name => import(pathToFileURL(join(directory, `${name}.mjs`)));
  const { problems, parseAnswer, markAnswer } = await load('catalog');
  const { gradeAttempt, InvalidAttempt } = await load('grading');
  const { topicEvidence, learningPath, studyStreak, recentActivity } = await load('learning');
  const { defaultProfile, validateProfile } = await load('profile');
  const { physicsTheoryModules, physicsGrades, theoryModulesForGrade, defaultPhysicsGrade, theoryEntryForTopic } = await load('physics-theory');
  const { strings } = await load('i18n');
  const resources = physicsTheoryModules.flatMap(module => module.resources);
  assert.equal(physicsTheoryModules.length, 36);
  assert.equal(resources.length, 40);
  assert.equal(new Set(physicsTheoryModules.map(module => module.id)).size, 36);
  assert.equal(new Set(resources.map(resource => resource.id)).size, 40);
  assert.equal(new Set(resources.map(resource => resource.url)).size, 28);
  assert.deepEqual(physicsGrades, [7, 8, 9, 10, 11, 12]);
  assert.deepEqual(physicsGrades.map(grade => theoryModulesForGrade(grade).length), [0, 0, 7, 9, 10, 10]);
  assert.deepEqual([9, 10, 11, 12].map(grade => theoryModulesForGrade(grade).flatMap(module => module.resources).length), [9, 10, 10, 11]);
  for (const grade of physicsGrades) assert.equal(defaultPhysicsGrade(String(grade)), grade);
  for (const level of ['uni', 'a', '', 'invalid']) assert.equal(defaultPhysicsGrade(level), 9);
  for (const module of physicsTheoryModules) {
    assert.match(module.id, /^(9|10|11|12)-[a-z]+(?:-[a-z]+)*$/);
    assert.equal(module.resources.filter(resource => resource.role === 'primary').length, 1);
    assert.equal(module.resources[0].role, 'primary');
    const primary = theorySource.resources.find(row => row.id === module.resources[0].sourceId);
    assert.equal(module.topic.en, primary.topic);
    assert.equal(module.focus.en, primary.focus);
    assert.equal(module.module, primary.module);
    assert.equal(module.grade, primary.grade);
    for (const lang of ['en', 'ru', 'kk']) assert.ok(module.topic[lang]?.trim() && module.focus[lang]?.trim());
    for (const topic of module.relatedTopicIds) assert.ok(problems.some(problem => problem.topic === topic));
    for (const resource of module.resources) {
      const original = theorySource.resources.find(row => row.id === resource.sourceId);
      assert.ok(original);
      for (const key of ['url', 'title', 'provider']) assert.equal(resource[key], original[key]);
      assert.equal(resource.type, original.resourceType);
      assert.equal(resource.focus.en, original.focus);
      assert.equal(module.module, original.module);
      assert.equal(new URL(resource.url).protocol, 'https:');
      for (const lang of ['en', 'ru', 'kk']) assert.ok(resource.focus[lang]?.trim());
    }
  }
  assert.deepEqual(resources.map(resource => resource.sourceId), theorySource.resources.map(row => row.id));
  assert.deepEqual(resources.filter(resource => resource.role === 'support').map(resource => resource.sourceId), ['g9-03', 'g9-06', 'g10-03', 'g12-09']);
  assert.equal(theoryEntryForTopic(1, '11').id, '11-kinematics');
  assert.equal(theoryEntryForTopic(1, '7').id, '9-kinematics');
  assert.equal(theoryEntryForTopic(999, '9'), undefined);
  for (const [key, values] of Object.entries(strings)) {
    for (const lang of ['en', 'ru', 'kk']) assert.ok(values[lang]?.trim(), `${key}: ${lang}`);
  }
  const id = '377661df-6f57-4006-bfed-42a81ca3a6ec';
  const diagnostic = { id, mode: 'diagnostic', responses: [{ problemId: 'f1-0', values: ['30'] }] };
  assert.equal(gradeAttempt(diagnostic).correct, 1);
  assert.equal(gradeAttempt({ ...diagnostic, correct: 999, responses: [{ problemId: 'f1-0', values: ['29'] }] }).correct, 0);
  for (const input of [null, [], {}, { ...diagnostic, id: 'bad-id' }, { ...diagnostic, responses: [null] }, { ...diagnostic, responses: [...diagnostic.responses, ...diagnostic.responses] }, { ...diagnostic, responses: [{ problemId: 'f1-1', values: ['16'] }] }, { ...diagnostic, responses: [{ problemId: 'f1-0', values: [''] }] }, { ...diagnostic, mode: 'practice' }]) {
    assert.throws(() => gradeAttempt(input), InvalidAttempt);
  }
  const practice = { id, mode: 'practice', responses: [{ problemId: 'f1-0', values: ['30'] }, { problemId: 'f1-1', values: ['16'] }] };
  assert.equal(gradeAttempt(practice).correct, 2);
  assert.throws(() => gradeAttempt({ ...practice, responses: [practice.responses[0], { problemId: 'f2-0', values: ['4'] }] }), InvalidAttempt);
  assert.equal(parseAnswer('−14,57'), -14.57);
  assert.equal(parseAnswer('5.45e-13'), 5.45e-13);
  for (const bad of ['', 'Infinity', '1/0', '3 m', 'NaN', '1e999', '<script>']) assert.equal(parseAnswer(bad), null);
  const electron = problems.find(p => p.id === 'c-electron');
  assert.equal(markAnswer('0', electron.parts[1]), false);
  assert.equal(markAnswer('5.45e-13', electron.parts[1]), true);
  // Independently derived physics examples, including signs and unit conversion.
  const expected = { 'c-balloon': [10 + 4**2/(2*9.81), (4 + Math.sqrt(4**2 + 2*9.81*10))/9.81, -Math.sqrt(4**2 + 2*9.81*10)], 'c-projectile': [15**2/(2*9.81), 30**2*Math.sin(Math.PI/3)/9.81, 30/9.81] };
  for (const [problemId, values] of Object.entries(expected)) assert.equal(gradeAttempt({ id, mode: 'practice', responses: [{ problemId, values: values.map(String) }] }).correct, values.length);
  const older = gradeAttempt({ ...diagnostic, responses: [{ problemId: 'f1-0', values: ['0'] }] }, 1);
  const newer = gradeAttempt(diagnostic, 2);
  assert.equal(topicEvidence([older, newer], 1).score, 100);
  assert.equal(topicEvidence([], 1).score, null);
  assert.deepEqual(new Set(learningPath([], '7').map(p => p.topic)), new Set([0, 1, 3, 4]));
  assert.equal(learningPath([older], '7')[0].topic, 1);
  const now = new Date(2026, 9, 4, 12);
  const attempts = [new Date(2026,9,4),new Date(2026,9,3),new Date(2026,9,2)].map(date => ({ ...newer, date: +date }));
  assert.equal(studyStreak(attempts, now), 3);
  assert.equal(studyStreak([], now), 0);
  assert.equal(recentActivity(attempts, now).reduce((n,d)=>n+d.count,0), 3);
  const profile = { ...defaultProfile('Alua'), phone: '+7 700 123 45 67' };
  assert.equal(validateProfile(profile).phone, '+77001234567');
  assert.equal(validateProfile({ ...profile, phone: '123' }), 'invalid_phone');
  assert.equal(validateProfile({ ...profile, hours: '99' }), 'invalid_profile');
  assert.equal(validateProfile({ ...profile, name: '   ' }), 'invalid_profile');
  assert.equal(new Set(problems.map(p => p.id)).size, problems.length);
  for (const problem of problems) {
    for (const lang of ['en','ru','kk']) {
      assert.ok(problem.title[lang] && problem.stem[lang] && problem.hint[lang]);
      assert.ok(problem.steps.every(step => step[lang]));
    }
  }
  console.log(`PASS: scoring, input rejection, physics calculations, adaptive priorities, streaks, profile validation, translations (${problems.length} problems), all 40 theory resources in 36 modules, support roles, empty grades 7–8, three languages and study links.`);
} finally { await rm(directory, { recursive: true, force: true }); }
