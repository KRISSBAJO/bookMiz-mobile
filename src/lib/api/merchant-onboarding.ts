import {requestJson} from './client';
import {mobileEnv} from '../mobile-env';
import type {AuthResponseData} from './types';
export type OwnerRegistration={organizationName:string;firstName:string;lastName:string;email:string;password:string;phone?:string;serviceModel:'LOCAL'|'PROFESSIONAL'|'HYBRID';businessVertical:string;deliveryModes:string[]};
export const registerOwnerMobile=(payload:OwnerRegistration)=>requestJson<AuthResponseData>(`${mobileEnv.identityApiUrl}/auth/mobile/register-owner`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
export type BusinessSetup={organizationId:string;cityId:string;businessCategoryId:string;displayName:string;addressLine1:string;postalCode:string;timezone:string;businessEmail?:string;businessPhone?:string;description?:string;acceptedTerms:boolean};
export const onboardBusiness=(payload:BusinessSetup)=>requestJson<{created:boolean;provider:{id:string;organizationId:string;currencyCode:string}}>(`${mobileEnv.bookingApiUrl}/providers/onboard`,{auth:true,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
