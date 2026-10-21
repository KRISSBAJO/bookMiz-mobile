import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { Action, Notice, ui } from '../components/business/BusinessUI';
import { useDiscovery } from '../store/discovery-context';
export function CityPickerScreen(){const location=useDiscovery(),router=useRouter();const [query,setQuery]=useState('');
 const cities=useMemo(()=>location.cities.filter(city=>city.label.toLowerCase().includes(query.trim().toLowerCase())),[query,location.cities]);
 return <Screen title="Where are you booking?" subtitle="Explore a supported city, at home or abroad."><Action label="Back" secondary onPress={()=>router.back()}/><Action label={location.detecting?'Finding your location…':'Use my location'} busy={location.detecting} onPress={()=>void location.detect()}/>{location.error?<Notice text={location.error} onRetry={location.retry}/>:null}
 <TextInput accessibilityLabel="Search supported cities" value={query} onChangeText={setQuery} placeholder="City, state or country" style={ui.input}/>{location.loading?<ActivityIndicator/>:null}
 {cities.slice(0,100).map(city=><Pressable key={city.id} accessibilityRole="button" accessibilityState={{selected:location.selected?.id===city.id}} onPress={()=>void location.choose(city).then(()=>router.back())} style={[ui.card,location.selected?.id===city.id?{borderColor:'#132849',backgroundColor:'#f2f8e8'}:null]}><Text style={ui.title}>{city.city}</Text><Text style={ui.muted}>{city.stateName}, {city.countryName}</Text><Text style={ui.muted}>{city.providerCount?`${city.providerCount} businesses with services`:'New city - availability is growing'} · {city.currencyCode}</Text></Pressable>)}
 {!location.loading&&!cities.length?<Text style={ui.muted}>No supported city matches. Try the country or a nearby city.</Text>:null}<View><Text style={ui.muted}>Your browsing city is separate from your profile address. Prices keep each service's currency; choosing a city never converts an amount.</Text></View></Screen>;
}
