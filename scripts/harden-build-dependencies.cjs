const fs = require('node:fs');
const path = require('node:path');

// Temporary mitigations for GHSA-86w9-cpqp-85rv and GHSA-vfj7-8cjw-p6xm.
// Upstream currently has no fixed release. Fail closed if the expected source changes.
function patch(packageName, relativePath, before, after, marker) {
  const file = path.join(path.dirname(require.resolve(packageName + '/package.json')), relativePath);
  const source = fs.readFileSync(file,'utf8');
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error('Review the security mitigation for ' + packageName + ' before building.');
  fs.writeFileSync(file,source.replace(before,after));
}

patch('node-forge','lib/rsa.js',
  'obj.value.length !== 2) {',
  'obj.value.length !== 2 ||\n            /* BookMiz: reject extra DigestAlgorithm elements. */\n            !Array.isArray(obj.value[0].value) ||\n            obj.value[0].value.length > 2) {',
  'BookMiz: reject extra DigestAlgorithm elements');

patch('braces','lib/parse.js',
  'while (index < length) {',
  'while (index < length) {\n    // BookMiz: bound AST nesting before recursive compilation.\n    if (stack.length > 128) throw new RangeError("Pattern nesting exceeds the supported limit");',
  'BookMiz: bound AST nesting');
console.log('Applied mobile build dependency security mitigations.');
