import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function load(file,deps={}){const result={};new Function('require','exports',ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name=>name in deps?deps[name]:name.endsWith('.ttf')?'font':require(name),result);return result;}
const feed=load('lib/appointment-feed.ts'),now=Date.parse('2030-01-01T12:00:00Z');
const booking=i=>({id:String(i),status:'CONFIRMED',startsAt:new Date(now+(i+1)*3600000).toISOString(),endsAt:new Date(now+(i+1)*3600000+1800000).toISOString(),service:{name:'Service '+i},provider:{displayName:'Business '+i}});
test('20 future appointments produce one nearest appointment and an accurate total without mutating source records',()=>{
 const records=Array.from({length:20},(_,i)=>booking(19-i));const copy=records.map(x=>x.id);
 records.push({...booking(0),id:'cancelled',status:'CANCELLED'},{...booking(0),id:'no-show',status:'NO_SHOW'},{...booking(0),id:'completed',status:'COMPLETED'});
 const upcoming=feed.upcomingAppointments(records,now);assert.equal(upcoming.length,20);assert.equal(upcoming[0].id,'0');assert.deepEqual(records.slice(0,20).map(x=>x.id),copy);
 assert.equal(feed.upcomingAppointments([],now)[0],undefined);
});
test('ongoing appointments remain visible while finished, invalid and no-show records do not become next',()=>{
 const ongoing={...booking(0),startsAt:new Date(now-600000).toISOString(),endsAt:new Date(now+600000).toISOString()};
 assert.equal(feed.upcomingAppointments([ongoing],now).length,1);
 assert.equal(feed.upcomingAppointments([{...ongoing,endsAt:new Date(now).toISOString()},{...ongoing,status:'NO_SHOW'},{...ongoing,startsAt:'invalid'}],now).length,0);
 assert.equal(feed.appointmentDayKey(booking(0).startsAt),feed.appointmentDayKey(booking(1).startsAt));
 assert.match(feed.appointmentDayLabel(booking(0).startsAt,now),/^Today/);
});
test('the compact hero renders only the next appointment and View all 20 has its own action',async()=>{
 const {UpcomingAppointmentCard}=load('components/UpcomingAppointmentCard.tsx',{'react-native':{View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:x=>x}},'@expo/vector-icons':{FontAwesome6:'Icon'},'../lib/appointment-feed':feed,'../theme/tokens':load('theme/tokens.ts')});
 let details=0,all=0,tree;await act(async()=>{tree=create(React.createElement(UpcomingAppointmentCard,{booking:booking(0),count:20,onDetails:()=>details++,onViewAll:()=>all++}));});
 const text=tree.root.findAllByType('Text').flatMap(node=>node.children).filter(x=>typeof x==='string');assert(text.includes('Service 0'));assert(!text.includes('Service 1'));assert(text.includes('20'));assert(text.includes('View all 20'));
 const viewAll=tree.root.findAllByType('Pressable').find(node=>node.props.accessibilityLabel==='View all 20 upcoming appointments');await act(async()=>viewAll.props.onPress());assert.equal(all,1);assert.equal(details,0);
 await act(async()=>tree.unmount());
});
