import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import * as Location from 'expo-location';
import { requestJson } from '../lib/api/client';
import { mobileEnv } from '../lib/mobile-env';
import { readDraft, writeDraft } from '../lib/drafts';
import { useSession } from './session-context';
import { nearestSupportedCity, registeredDiscoveryLocation, type DiscoveryCity } from '../lib/discovery-location';

type Value = { cities: DiscoveryCity[]; selected: DiscoveryCity | null; loading: boolean; detecting: boolean; error: string; choose: (city: DiscoveryCity) => Promise<void>; detect: () => Promise<void>; retry: () => void };
const Context = createContext<Value | null>(null);
type Saved = { cityId?: string; mode?: 'manual' | 'automatic' };
export function DiscoveryProvider({ children }: PropsWithChildren) {
 const session = useSession(), key = `discovery-${session.user?.id ?? 'guest'}`;
 const profile = useRef(session.profile); profile.current = session.profile;
 const [cities,setCities] = useState<DiscoveryCity[]>([]), [selected,setSelected] = useState<DiscoveryCity|null>(null), [loading,setLoading] = useState(true), [detecting,setDetecting] = useState(false), [error,setError] = useState(''), [attempt,setAttempt] = useState(0);
 const generation = useRef(0), selection = useRef(0), detectingVersion = useRef<number|null>(null), mode = useRef<'manual'|'automatic'>('automatic');
 const choose = useCallback(async (city: DiscoveryCity) => {
  selection.current++; mode.current='manual'; setDetecting(false); setSelected(city); setError('');
  try { await writeDraft(key,{ cityId: city.id, mode:'manual' }); } catch { setError('City selected for this visit, but it could not be saved on this device.'); }
 },[key]);
 const detectFrom = useCallback(async (supported: DiscoveryCity[]) => {
  const version=generation.current;
  if(detectingVersion.current===version) return;
  detectingVersion.current=version; const choice=++selection.current; mode.current='automatic';
  const active=()=>version===generation.current && choice===selection.current;
  setDetecting(true); setError('');
  let timer: ReturnType<typeof setTimeout>|undefined;
  try {
   // Save only the preference. Precise device coordinates stay in memory.
   await writeDraft(key,{mode:'automatic'}).catch(()=>{});
   const permission=await Location.requestForegroundPermissionsAsync();
   if(!active()) return;
   if(permission.status!=='granted') throw new Error('Location access is unavailable.');
   const position=await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Location took too long.')),12000);})]);
   if(!active()) return;
   const {latitude,longitude}=position.coords;
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180) throw new Error('Device location is unavailable.');
   const nearest=nearestSupportedCity(supported,latitude,longitude);
   setSelected({...(nearest??{city:'',stateCode:'',stateName:'',countryCode:'',countryName:'',currencyCode:'',timezone:'',providerCount:0}),id:'current',label:nearest?`Near ${nearest.city}`:'Current area',latitude,longitude});
  } catch(e) {
   if(active()) {
    const registered=registeredDiscoveryLocation(profile.current,supported); setSelected(registered);
    setError(registered?'Using your registered location because device location is unavailable.':`${e instanceof Error?e.message:'Could not detect location.'} Showing available businesses. You can choose another city.`);
   }
  } finally {
   if(timer) clearTimeout(timer);
   if(detectingVersion.current===version) detectingVersion.current=null;
   if(active()) setDetecting(false);
  }
 },[key]);
 useEffect(()=>{
  const version=++generation.current; selection.current++; setSelected(null);setDetecting(false);setLoading(true);setError('');setCities([]);
  Promise.all([requestJson<DiscoveryCity[]>(`${mobileEnv.bookingApiUrl}/marketplace/discovery-cities`),readDraft<Saved>(key).catch(()=>null)]).then(async ([available,saved])=>{
   if(version!==generation.current) return; setCities(available);
   const stored=saved?.mode==='manual'?available.find(city=>city.id===saved.cityId):null;
   if(stored){mode.current='manual';setSelected(stored);}
   else {setSelected(registeredDiscoveryLocation(profile.current,available));if(session.user?.userType==='CUSTOMER')await detectFrom(available);}
  }).catch(e=>{if(version===generation.current){setSelected(registeredDiscoveryLocation(profile.current,[]));setError(e instanceof Error?e.message:'Could not load supported cities.');}}).finally(()=>{if(version===generation.current)setLoading(false);});
  return ()=>{generation.current++;};
 },[key,attempt,detectFrom]);
 // The account profile can arrive after discovery. Apply it only while location
 // is unresolved, never over a manually selected city or a device position.
 useEffect(()=>{if(mode.current==='automatic')setSelected(current=>current?.id==='current'?current:registeredDiscoveryLocation(session.profile,cities));},[session.profile,cities]);
 return <Context.Provider value={{cities,selected,loading,detecting,error,choose,detect:()=>detectFrom(cities),retry:()=>setAttempt(v=>v+1)}}>{children}</Context.Provider>;
}
export function useDiscovery(){const value=useContext(Context);if(!value)throw new Error('Discovery location is not ready.');return value;}
