import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function fixture(options={}) {
 const calls=[],api={};
 class File {
  constructor(uri,name){this.uri=name?`${uri.uri}/${name}`:uri;this.size=options.size??25;this.exists=true;}
  async base64(){calls.push('read');return 'ZmlsZQ==';}
  delete(){calls.push('delete');this.exists=false;}
  static async downloadFileAsync(url,target,init){calls.push({download:url,init});if(options.failDownload)throw Error('Download failed');}
 }
 const deps={
  'expo-document-picker':{getDocumentAsync:async()=>options.cancel?{canceled:true}:{assets:[{uri:options.uri??'cache/file.pdf',name:'file.pdf',mimeType:'application/pdf'}]}},
  'expo-file-system':{File,Paths:{cache:{uri:'cache'}}},
  'expo-sharing':{isAvailableAsync:async()=>true,shareAsync:async()=>calls.push('share')},
  './api/client':{requestJson:async(url,init)=>calls.push({url,init}),getAuthTokens:()=>({accessToken:'fixture-token'})},
  './mobile-env':{mobileEnv:{bookingApiUrl:'https://booking-api.bookmiz.com/api',identityApiUrl:'https://identity-api.bookmiz.com/api'}},
 };
 new Function('exports','require',ts.transpileModule(readFileSync(new URL('../src/lib/quote-attachments.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api,key=>deps[key]);
 return {api,calls};
}
test('file picker cancellation and oversize files never upload or read bytes; only owned cache copies are removed',async()=>{
 let f=fixture({cancel:true});assert.equal(await f.api.pickQuoteAttachment(),null);assert.deepEqual(f.calls,[]);
 f=fixture({size:6*1024*1024});await assert.rejects(()=>f.api.pickQuoteAttachment(),/5 MB/);assert.deepEqual(f.calls,['delete']);
 f=fixture({uri:'external/user-document.pdf'});assert.equal((await f.api.pickQuoteAttachment()).fileName,'file.pdf');assert.deepEqual(f.calls,['read']);
});
test('customer and merchant files use their authenticated conversation endpoints without changing content',async()=>{
 const f=fixture(),attachment={fileName:'quote.pdf',mimeType:'application/pdf',contentBase64:'ZmlsZQ=='},thread={id:'thread',quoteRequestId:'request',quoteMatchId:'match'};
 await f.api.sendQuoteAttachment(thread,'REQUESTER',attachment,'Price details');await f.api.sendQuoteAttachment(thread,'PROVIDER',attachment,'');
 assert.match(f.calls[0].url,/quotes\/request\/conversations\/thread\/messages$/);assert.equal(f.calls[0].init.auth,true);assert.deepEqual(JSON.parse(f.calls[0].init.body),{content:'Price details',attachment});
 assert.match(f.calls[1].url,/quote-matches\/match\/conversation\/messages$/);assert.equal(JSON.parse(f.calls[1].init.body).content,'Shared a file');
});
test('file downloads refresh authentication, use a private bearer request, share and clear the temporary copy on success or failure',async()=>{
 for(const failDownload of [false,true]) {
  const f=fixture({failDownload});const operation=f.api.openQuoteAttachment('thread','message',{id:'file',fileName:'estimate.pdf',mimeType:'application/pdf'});
  if(failDownload)await assert.rejects(()=>operation,/Download failed/);else await operation;
  assert.match(f.calls[0].url,/auth\/me$/);assert.equal(f.calls[0].init.auth,true);
  assert.match(f.calls[1].download,/conversations\/thread\/messages\/message\/attachments\/file\/download$/);assert.equal(f.calls[1].init.headers.Authorization,'Bearer fixture-token');assert.equal(f.calls.at(-1),'delete');assert.equal(f.calls.includes('share'),!failDownload);
 }
});
