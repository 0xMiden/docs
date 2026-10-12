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
    test(`${root}/${file}: internal links resolve without changing version`, () => {
      const filename = path.join(root, directory, file);
      const source = readFileSync(filename, 'utf8');
      for (const [, target] of source.matchAll(/\]\(([^)]+)\)/g)) {
        if (/^https?:/.test(target)) continue;
        assert.ok(!target.startsWith('/'), `${file}: version-escaping link ${target}`);
        const resolved = path.resolve(path.dirname(filename), target.split('#')[0]);
        assert.ok(resolved.startsWith(path.resolve(root) + path.sep), target);
        assert.ok(existsSync(resolved), `${filename}: missing ${target}`);
      }
    });
  }
}
