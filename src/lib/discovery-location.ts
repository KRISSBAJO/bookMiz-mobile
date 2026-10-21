export type DiscoveryCity = { id: string; city: string; stateCode: string; stateName: string; countryCode: string; countryName: string; currencyCode: string; timezone: string; label: string; latitude: number | null; longitude: number | null; providerCount: number };
export function nearestSupportedCity(cities: DiscoveryCity[], latitude: number, longitude: number, maxMiles = 75) {
 if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) return null;
 const radians = (n: number) => n * Math.PI/180;
 const ranked = cities.filter(city => city.latitude != null && city.longitude != null).map(city => {
  const a = Math.sin(radians(city.latitude! - latitude)/2)**2 + Math.cos(radians(latitude))*Math.cos(radians(city.latitude!))*Math.sin(radians(city.longitude! - longitude)/2)**2;
  return { city, distance: 3958.8*2*Math.asin(Math.sqrt(Math.min(1,a))) };
 }).sort((a,b)=>a.distance-b.distance);
 return ranked[0] && ranked[0].distance <= maxMiles ? ranked[0].city : null;
}
export function registeredDiscoveryLocation(profile: {city?: string | null; stateCode?: string | null; countryCode?: string | null; homeLatitude?: number | null; homeLongitude?: number | null} | null, cities: DiscoveryCity[]): DiscoveryCity | null {
 if (!profile?.city || !profile.countryCode) return null;
 const city = cities.find(city => city.city.toLowerCase() === profile.city!.trim().toLowerCase() && city.countryCode === profile.countryCode!.toUpperCase() && (!profile.stateCode || city.stateCode.toLowerCase() === profile.stateCode.toLowerCase()));
 return city ?? {id:'registered',city:profile.city,stateCode:profile.stateCode??'',stateName:profile.stateCode??'',countryCode:profile.countryCode.toUpperCase(),countryName:profile.countryCode.toUpperCase(),currencyCode:'',timezone:'',label:[profile.city,profile.stateCode,profile.countryCode].filter(Boolean).join(', '),latitude:profile.homeLatitude??null,longitude:profile.homeLongitude??null,providerCount:0};
}
export function discoverySearch(city: DiscoveryCity | null) {
 if (!city) return {};
 const coordinates = city.latitude != null && city.longitude != null ? {latitude:city.latitude,longitude:city.longitude} : {};
 return city.id === 'current' ? coordinates : {city:city.city,stateCode:city.stateCode||undefined,countryCode:city.countryCode||undefined,radiusMiles:500,...coordinates};
}
