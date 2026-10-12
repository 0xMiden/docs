import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {loadFreshModule} from '@docusaurus/utils';
import {compile} from '@mdx-js/mdx';
import yaml from 'yaml';

const versions = [
  {root: 'docs', sidebar: 'sidebars.ts'},
  {root: 'versioned_docs/version-0.17', sidebar: 'versioned_sidebars/version-0.17-sidebars.json'},
];
const directory = 'builder/agentic';

function docIds(item) {
  if (typeof item === 'string') return [item];
  if (item.type === 'doc') return [item.id];
  if (item.type === 'category') {
    return [
      ...(item.link?.type === 'doc' ? [item.link.id] : []),
      ...item.items.flatMap(docIds),
    ];
  }
  return [];
}

async function linkTargets(source) {
  const targets = [];
  await compile(source, {remarkPlugins: [function collectLinks() {
    return function walk(node) {
      if (node.type === 'link') targets.push(node.url);
      if (['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type) && node.name === 'Card') {
        const href = node.attributes.find(attribute => attribute.name === 'href');
        if (href) {
          assert.equal(typeof href.value, 'string', 'Card href must be a static string for version-local validation');
          targets.push(href.value);
        }
      }
      node.children?.forEach(walk);
    };
  }]});
  return targets;
}

function assertVersionLocalLink(root, filename, target) {
  if (/^https?:/.test(target)) return;
  assert.ok(!target.startsWith('/'), `${filename}: version-escaping link ${target}`);
  const pathname = target.split(/[?#]/)[0];
  if (!pathname) return;
  const resolved = path.resolve(path.dirname(filename), pathname);
  assert.ok(resolved.startsWith(path.resolve(root) + path.sep), target);
  const candidates = [resolved, `${resolved}.md`, `${resolved}.mdx`,
    path.join(resolved, 'index.md'), path.join(resolved, 'index.mdx')];
  assert.ok(candidates.some(candidate => existsSync(candidate) && /\.mdx?$/.test(candidate)),
    `${filename}: missing ${target}`);
}

test('link validation includes Card hrefs as well as Markdown links', async () => {
  assert.deepEqual(await linkTargets('[Setup](setup.md)\n\n<Card title="Build" href="./first-app">Build</Card>'),
    ['setup.md', './first-app']);
});

test('Card links reject missing destinations and paths that escape the selected release', async () => {
  const filename = 'docs/builder/agentic/index.md';
  for (const href of ['./missing-card-destination', '/next/builder/agentic/setup']) {
    const targets = await linkTargets(`<Card title="Invalid" href="${href}">Invalid</Card>`);
    assert.throws(() => assertVersionLocalLink('docs', filename, targets[0]));
  }
  assertVersionLocalLink('docs', filename, './setup');
  assertVersionLocalLink('docs', filename, '../smart-contracts/');
});

// Validate each release against its own sidebar so current docs can evolve independently.
for (const {root, sidebar} of versions) {
  const pages = readdirSync(path.join(root, directory)).filter(file => file.endsWith('.md')).sort();

  test(`${root}: Agentic navigation covers its pages and stays a Build sibling`, async () => {
    const {builderSidebar} = await loadFreshModule(path.resolve(sidebar));
    const category = builderSidebar.find(item => item.type === 'category' && item.label === 'Agentic');
    assert.ok(category, `${sidebar}: missing Agentic category`);
    assert.equal(category.link?.type, 'doc');
    assert.equal(category.link.id, 'builder/agentic/index');
    const ids = docIds(category);
    assert.equal(new Set(ids).size, ids.length, `${sidebar}: duplicate Agentic doc IDs`);
    assert.deepEqual(ids.sort(), pages.map(file => `${directory}/${file.slice(0, -3)}`));
    const build = builderSidebar.findIndex(item => item.value?.includes('>Build<'));
    const solutions = builderSidebar.findIndex(item => item.value?.includes('>Solutions<'));
    const agentic = builderSidebar.indexOf(category);
    assert.ok(build >= 0 && agentic > build && agentic < solutions);
  });

  for (const file of pages) {
    test(`${root}/${file}: valid frontmatter and compilable MDX`, async () => {
      const source = readFileSync(path.join(root, directory, file), 'utf8');
      const match = source.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
      assert.ok(match, `${file}: missing frontmatter`);
      const [, frontmatter, body] = match;
      const metadata = yaml.parse(frontmatter);
      assert.ok(metadata?.title && metadata.description);
      await compile(body);
    });
    test(`${root}/${file}: Markdown and Card links resolve without changing version`, async () => {
      const filename = path.join(root, directory, file);
      const source = readFileSync(filename, 'utf8').replace(/^---\n[\s\S]+?\n---\n/, '');
      for (const target of await linkTargets(source)) assertVersionLocalLink(root, filename, target);
    });
  }
}
