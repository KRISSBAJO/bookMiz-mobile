import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const exports={};
const code=ts.transpileModule(readFileSync(new URL('../src/lib/booking-payment-display.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
new Function('exports',code)(exports);
const {bookingPaymentLabel,shouldRefreshBookingPayment}=exports;
test('paid cancellation remains refund pending until the backend confirms the refund',()=>{
  const b={status:'CANCELLED',paymentStatus:'PAID',paymentMode:'test'};
  assert.equal(bookingPaymentLabel(b),'Refund pending');assert.equal(shouldRefreshBookingPayment(b),true);
  const settled={...b,paymentStatus:'REFUNDED'};
  assert.equal(bookingPaymentLabel(settled),'Refunded');assert.equal(shouldRefreshBookingPayment(settled),false);
});
test('an unpaid cancellation never promises a refund; ordinary paid visits stay paid',()=>{
  assert.equal(bookingPaymentLabel({status:'CANCELLED',paymentStatus:'UNPAID',paymentMode:'test'}),'Unpaid');
  assert.equal(shouldRefreshBookingPayment({status:'CANCELLED',paymentStatus:'UNPAID',paymentMode:'test'}),false);
  assert.equal(bookingPaymentLabel({status:'CONFIRMED',paymentStatus:'PAID',paymentMode:'live'}),'Paid');
  assert.equal(bookingPaymentLabel({status:'CANCELLED',paymentStatus:'PAID'}),'Paid');
  assert.equal(bookingPaymentLabel({status:'CONFIRMED'}),'Payment status unavailable');
});
