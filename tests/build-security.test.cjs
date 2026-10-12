const { test } = require('node:test');
const assert = require('node:assert/strict');

test('deep brace and parenthesis patterns are rejected before stack exhaustion', () => {
  const braces = require('braces');
  for (const [open,close] of [['{','}'],['(',')']]) assert.throws(() => braces(open.repeat(2000)+'x'+close.repeat(2000)), /nesting exceeds/);
  assert.deepEqual(braces.expand('file-{a,b}.js'),['file-a.js','file-b.js']);
});

test('RSA verification accepts valid signatures and rejects nested DigestAlgorithm garbage', () => {
  const forge = require('node-forge');
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 3 });
  const hash = forge.md.sha256.create().update('BookMiz regression fixture');
  const digest = hash.digest().getBytes();
  assert(keys.publicKey.verify(digest, keys.privateKey.sign(hash)));
  const a = forge.asn1;
  const malformed = a.create(a.Class.UNIVERSAL,a.Type.SEQUENCE,true,[
    a.create(a.Class.UNIVERSAL,a.Type.SEQUENCE,true,[
      a.create(a.Class.UNIVERSAL,a.Type.OID,false,a.oidToDer(forge.oids.sha256).getBytes()),
      a.create(a.Class.UNIVERSAL,a.Type.NULL,false,''),
      a.create(a.Class.UNIVERSAL,a.Type.OCTETSTRING,false,'garbage'),
    ]),
    a.create(a.Class.UNIVERSAL,a.Type.OCTETSTRING,false,digest),
  ]);
  const signature = keys.privateKey.sign(a.toDer(malformed).getBytes(),'NONE');
  assert.throws(() => keys.publicKey.verify(digest,signature), /valid RSASSA/);
});
