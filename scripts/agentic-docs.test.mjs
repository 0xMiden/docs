import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {compile} from '@mdx-js/mdx';
import yaml from 'yaml';

const roots = ['docs', 'versioned_docs/version-0.17'];
const directory = 'builder/agentic';
const pages = readdirSync(path.join(roots[0], directory)).filter(file => file.endsWith('.md')).sort();
const versionSidebar = JSON.parse(readFileSync('versioned_sidebars/version-0.17-sidebars.json', 'utf8'));
const currentSidebar = readFileSync('sidebars.ts', 'utf8');
const category = versionSidebar.builderSidebar.find(item => item.label === 'Agentic');

test('current and v0.17 contain the same complete Agentic content', () => {
  assert.equal(pages.length, 8);
  assert.deepEqual(readdirSync(path.join(roots[1], directory)).sort(), pages);
  for (const file of pages) {
    assert.equal(readFileSync(path.join(roots[0], directory, file), 'utf8'),
      readFileSync(path.join(roots[1], directory, file), 'utf8'), file);
  }
});

test('Agentic navigation matches in both versions and stays a Build sibling', () => {
  assert.equal(category.link.id, 'builder/agentic/index');
  const currentBlock = currentSidebar.match(/label: "Agentic",[\s\S]*?\n    },/)[0];
  const ids = [...currentBlock.matchAll(/"(builder\/agentic\/[^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, [category.link.id, ...category.items]);
  assert.equal(new Set(ids).size, pages.length);
  for (const id of ids) assert.ok(existsSync(`docs/${id}.md`), id);
  const build = versionSidebar.builderSidebar.findIndex(item => item.value?.includes('>Build<'));
  const solutions = versionSidebar.builderSidebar.findIndex(item => item.value?.includes('>Solutions<'));
  const agentic = versionSidebar.builderSidebar.indexOf(category);
  assert.ok(agentic > build && agentic < solutions);
  for (const label of ['Smart Contracts', 'Tutorials', 'Tools']) {
    assert.ok(versionSidebar.builderSidebar.slice(build, solutions).some(item => item.label === label));
  }
});

for (const file of pages) {
  test(`${file}: valid frontmatter and compilable MDX`, async () => {
    const source = readFileSync(path.join(roots[0], directory, file), 'utf8');
    const [, frontmatter, body] = source.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
    const metadata = yaml.parse(frontmatter);
    assert.ok(metadata.title && metadata.description);
    await compile(body);
  });
  test(`${file}: internal links resolve in both docs trees without changing version`, () => {
    for (const root of roots) {
      const filename = path.join(root, directory, file);
      const source = readFileSync(filename, 'utf8');
      for (const [, target] of source.matchAll(/\]\(([^)]+)\)/g)) {
        if (/^https?:/.test(target)) continue;
        assert.ok(!target.startsWith('/'), `${file}: version-escaping link ${target}`);
        const resolved = path.resolve(path.dirname(filename), target.split('#')[0]);
        assert.ok(resolved.startsWith(path.resolve(root) + path.sep), target);
        assert.ok(existsSync(resolved), `${filename}: missing ${target}`);
      }
    }
  });
}
