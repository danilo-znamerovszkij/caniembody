import assert from 'node:assert';
import { parseForm } from './issue-to-yaml.ts';
const f = parseForm('### Robot id\n\nso101\n\n### Policy id\n\nact\n\n### Caveats\n\n_No response_\n');
assert.equal(f['Robot id'], 'so101');
assert.equal(f['Policy id'], 'act');
assert.equal(f['Caveats'], '');
console.log('issue-to-yaml ok');
