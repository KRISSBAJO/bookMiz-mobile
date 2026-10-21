import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react');
const {act,create}=require('react-test-renderer');globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function compile(file,deps={}){const output={};new Function('require','exports',ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name=>name in deps?deps[name]:require(name),output);return output;}
const policy=compile('lib/discovery-location.ts');
const chicago={id:'chicago',city:'Chicago',stateCode:'IL',countryCode:'US',stateName:'Illinois',countryName:'United States',label:'Chicago, Illinois, United States',currencyCode:'USD',timezone:'America/Chicago',latitude:41.88,longitude:-87.63,providerCount:2};
const paris={...chicago,id:'paris',city:'Paris',stateCode:'IDF',countryCode:'FR',latitude:48.86,longitude:2.35};
const registered={city:'London',stateCode:'England',countryCode:'GB',homeLatitude:51.5072,homeLongitude:-0.1276};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
async function setup({permission='denied',gps,saved=null,account={user:{id:'one',userType:'CUSTOMER'},profile:registered}}={}){
 let current=account,value,calls=0,writes=[];
 const module=compile('store/discovery-context.tsx',{'expo-location':{Accuracy:{Balanced:3},requestForegroundPermissionsAsync:async()=>{calls++;return {status:permission};},getCurrentPositionAsync:async()=>gps?.promise??{coords:{latitude:51.5072,longitude:-0.1276}}},'../lib/api/client':{requestJson:async()=>[chicago,paris]},'../lib/mobile-env':{mobileEnv:{bookingApiUrl:'https://booking.example.test/api'}},'../lib/drafts':{readDraft:async()=>saved,writeDraft:async(key,data)=>{writes.push({key,data});}},'./session-context':{useSession:()=>current},'../lib/discovery-location':policy});
 function Probe(){value=module.useDiscovery();return null;}
 let root;await act(async()=>{root=create(React.createElement(module.DiscoveryProvider,null,React.createElement(Probe)));});
 return {get value(){return value;},get calls(){return calls;},writes,update:async next=>{current=next;await act(async()=>root.update(React.createElement(module.DiscoveryProvider,null,React.createElement(Probe))));},close:async()=>act(async()=>root.unmount())};
}
test('denied GPS falls back to registered city outside supported coverage without changing its country',async()=>{
 const s=await setup();assert.equal(s.value.selected.city,'London');assert.equal(s.value.selected.countryCode,'GB');assert.match(s.value.error,/registered location/);assert.equal(policy.discoverySearch(s.value.selected).countryCode,'GB');assert.equal(s.calls,1);await s.close();
});
test('being outside coverage preserves actual GPS origin for cross-border nearest results',async()=>{
 const s=await setup({permission:'granted'});assert.equal(s.value.selected.id,'current');assert.equal(s.value.selected.label,'Current area');const query=policy.discoverySearch(s.value.selected);assert.equal(query.latitude,51.5072);assert.equal(query.city,undefined);assert.equal(query.countryCode,undefined);assert(s.writes.every(row=>!JSON.stringify(row.data).includes('51.5072')));await s.close();
});
test('manual selection wins over a late GPS response and is scoped to the current account',async()=>{
 const gps=deferred(),s=await setup({permission:'granted',gps});await act(async()=>s.value.choose(paris));await act(async()=>gps.resolve({coords:{latitude:41.88,longitude:-87.63}}));assert.equal(s.value.selected.id,'paris');assert.equal(s.value.detecting,false);assert.deepEqual(s.writes.at(-1),{key:'discovery-one',data:{cityId:'paris',mode:'manual'}});await s.close();
});
test('a saved manual city avoids GPS and missing profile still leaves discovery available',async()=>{
 const s=await setup({saved:{cityId:'paris',mode:'manual'}});assert.equal(s.value.selected.id,'paris');assert.equal(s.calls,0);await s.close();
 const guest=await setup({account:{user:null,profile:null}});assert.equal(guest.value.selected,null);assert.equal(guest.value.cities.length,2);assert.equal(guest.value.loading,false);assert.deepEqual(policy.discoverySearch(null),{});await guest.close();
});
test('registered cities sharing a name never cross country boundaries and zero coordinates are valid',()=>{
 assert.equal(policy.registeredDiscoveryLocation({city:'Paris',countryCode:'FR'},[chicago,paris]).id,'paris');
 assert.equal(policy.registeredDiscoveryLocation({city:'Paris',countryCode:'US'},[paris]).id,'registered');
 assert.equal(policy.nearestSupportedCity([{...chicago,latitude:0,longitude:0}],0,0).id,'chicago');
 assert.equal(policy.nearestSupportedCity([paris],51.5072,-0.1276),null);
});
