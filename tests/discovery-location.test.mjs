import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react');
const {act,create}=require('react-test-renderer');globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function compile(file,deps={}){const output={};new Function('require','exports',ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name=>name in deps?deps[name]:require(name),output);return output;}
const policy=compile('lib/discovery-location.ts');
const chicago={id:'chicago',city:'Chicago',stateCode:'IL',countryCode:'US',stateName:'Illinois',countryName:'United States',label:'Chicago, Illinois, United States',currencyCode:'USD',timezone:'America/Chicago',latitude:41.88,longitude:-87.63,providerCount:2};
const paris={...chicago,id:'paris',city:'Paris',stateCode:'IDF',stateName:'Ile-de-France',countryCode:'FR',countryName:'France',label:'Paris, Ile-de-France, France',latitude:48.86,longitude:2.35};
const registered={city:'London',stateCode:'England',countryCode:'GB',homeLatitude:51.5072,homeLongitude:-0.1276};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
test('Home location control opens the city picker while the profile photo opens Account',async()=>{
 const routes=[],router={push:route=>routes.push(route)},native={View:'View',Text:'Text',Pressable:'Pressable',Image:'Image',TextInput:'TextInput',ScrollView:'ScrollView',RefreshControl:'RefreshControl',StyleSheet:{create:x=>x}},theme={tokens:{colors:{},font:{},radius:{}}};
 const common={'react-native':native,'expo-router':{useRouter:()=>router},'@expo/vector-icons':{FontAwesome6:'Icon'},'../theme/tokens':theme};
 const location=compile('components/BookingLocationControl.tsx',common);
 const Home=compile('screens/HomeScreen.tsx',{...common,'expo-status-bar':{StatusBar:'StatusBar'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'expo-router/react-navigation':{useFocusEffect:cb=>React.useEffect(cb,[cb])},'../components/BookingLocationControl':location,'../components/UpcomingAppointmentCard':{UpcomingAppointmentCard:'UpcomingAppointmentCard'},'../lib/appointment-feed':{upcomingAppointments:()=>[]},'../store/discovery-context':{useDiscovery:()=>({selected:chicago,detecting:false})},'../lib/discovery-location':policy,'@/src/components/marketplace/ProviderCard':{ProviderCard:'ProviderCard'},'@/src/components/SectionHeader':{SectionHeader:'SectionHeader'},'@/src/components/ProfileAvatar':{ProfileAvatar:'ProfileAvatar'},'@/src/lib/api/bookings':{},'@/src/lib/api/marketplace':{},'@/src/lib/api/error-display':{},'@/src/lib/marketplace-display':{},'@/src/store/session-context':{useSession:()=>({user:null,profile:null})},'@/src/theme/tokens':theme}).HomeScreen;
 let tree;await act(async()=>{tree=create(React.createElement(Home));});
 const button=tree.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel==='Change booking location: '+chicago.label);assert(button,'prominent booking location control exists');
 assert(tree.root.findAllByType('Text').some(n=>n.children.includes('BOOKING LOCATION')));assert(tree.root.findAllByType('Text').some(n=>n.children.includes('Change')));
 await act(async()=>button.props.onPress());assert.equal(routes.pop(),'/choose-city');
 await act(async()=>tree.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel==='Account').props.onPress());assert.equal(routes.pop(),'/(tabs)/account');
 await act(async()=>tree.unmount());
});
test('city picker searches supported places, saves selection and offers current location',async()=>{
 let selected,detected=0,backs=0;const ui={};const Picker=compile('screens/CityPickerScreen.tsx',{'react-native':{View:'View',Text:'Text',TextInput:'TextInput',Pressable:'Pressable',ActivityIndicator:'ActivityIndicator'},'expo-router':{useRouter:()=>({back:()=>backs++})},'../components/Screen':{Screen:({children})=>React.createElement('Screen',{},children)},'../components/business/BusinessUI':{Action:'Button',Notice:'Notice',ui},'../store/discovery-context':{useDiscovery:()=>({cities:[chicago,paris],choose:async c=>{selected=c;},detect:async()=>{detected++;}})}}).CityPickerScreen;
 let tree;await act(async()=>{tree=create(React.createElement(Picker));});await act(async()=>tree.root.findByType('TextInput').props.onChangeText('Illinois'));assert.equal(tree.root.findAllByType('Pressable').length,1);
 await act(async()=>tree.root.findByType('Pressable').props.onPress());assert.equal(selected.id,'chicago');assert.equal(backs,1);
 await act(async()=>tree.root.findAllByType('Button').find(n=>n.props.label==='Use my location').props.onPress());assert.equal(detected,1);await act(async()=>tree.unmount());
});
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
