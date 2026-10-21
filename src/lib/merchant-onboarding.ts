import type {DiscoveryCity} from './discovery-location';
export function onboardingTimeZone(city:DiscoveryCity){
 const us:Record<string,string>={CA:'America/Los_Angeles',WA:'America/Los_Angeles',OR:'America/Los_Angeles',NV:'America/Los_Angeles',AZ:'America/Phoenix',CO:'America/Denver',UT:'America/Denver',NM:'America/Denver',MT:'America/Denver',NY:'America/New_York',FL:'America/New_York',GA:'America/New_York',MA:'America/New_York',NC:'America/New_York',SC:'America/New_York',VA:'America/New_York',PA:'America/New_York',NJ:'America/New_York',OH:'America/New_York',MI:'America/Detroit',TN:'America/Chicago',TX:'America/Chicago',IL:'America/Chicago',WI:'America/Chicago',MN:'America/Chicago',AL:'America/Chicago',LA:'America/Chicago',HI:'Pacific/Honolulu',AK:'America/Anchorage'};
 return city.countryCode==='US'?(us[city.stateCode]??city.timezone):city.timezone;
}
export function onboardingVertical(slug:string,model:string){
 if(model==='HYBRID')return 'MULTI_SERVICE_BUSINESS' as const;
 if(model==='PROFESSIONAL')return /medical|clinic|doctor/.test(slug)?'MEDICAL_PRACTICE' as const:/legal|law/.test(slug)?'LEGAL_PRACTICE' as const:/tutor|education/.test(slug)?'TUTORING' as const:'CONSULTING' as const;
 return /barber/.test(slug)?'BARBER' as const:/home/.test(slug)?'HOME_SERVICES' as const:/massage|wellness|fitness/.test(slug)?'WELLNESS' as const:'BEAUTY' as const;
}
export function validateOnboardingLocation(city:DiscoveryCity|null,address:string,postal:string,timezone:string){
 if(!city)throw new Error('Choose a supported city for your business.');
 if(address.trim().length<3)throw new Error('Enter your business street address.');
 if(!postal.trim())throw new Error('Enter your postal or ZIP code.');
 try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{throw new Error('Choose a valid business time zone.');}
}
