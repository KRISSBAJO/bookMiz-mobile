import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { Action, Choices, Notice, ui } from '../components/business/BusinessUI';
import { useSession } from '../store/session-context';
import { billingHistory, issueBillingDocument, shareBillingDocument, type BillingItem } from '../lib/api/billing';
import { formatBusinessMoney } from '../lib/business-policy';
export function FinancialDocumentsScreen() {
 const session=useSession(),router=useRouter(),[chosen,setChosen]=useState('');
 const businesses=session.businesses.filter(b=>['ORG_ADMIN','SERVICE_PROVIDER'].includes(b.role));
 const org=businesses.some(b=>b.id===chosen)?chosen:businesses[0]?.id;
 const merchant=session.user?.userType!=='CUSTOMER';
 if(!session.user)return <Screen title="Invoices & receipts"><Text style={ui.muted}>Sign in to see your documents.</Text><Action label="Sign in" onPress={()=>router.replace('/login' as never)}/></Screen>;
 if(merchant&&!org)return <Screen title="Invoices & receipts"><Text style={ui.muted}>A business owner or provider account is required to manage financial documents.</Text></Screen>;
 return <FinancialWorkspace key={`${session.user.id}:${merchant?org:'customer'}`} scope={merchant?org:undefined} merchant={merchant} picker={merchant&&businesses.length>1?<Choices label="Business" items={businesses.map(b=>({id:b.id,label:b.displayName}))} value={org!} onChange={setChosen}/>:null}/>;
}
function FinancialWorkspace({scope,merchant,picker}:{scope?:string;merchant:boolean;picker:ReactNode}) {
 const router=useRouter();
 const [rows,setRows]=useState<BillingItem[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation = useRef(0), lock = useRef(false), active=useRef(true);
 const load = useCallback(async (after?: string) => { const key = ++generation.current; setBusy(true); setError(''); try { const result = await billingHistory(scope, after); if (key === generation.current) { setRows(old => after ? [...old, ...result.items] : result.items); setCursor(result.nextCursor); } } catch(e) { if(key === generation.current) setError(e instanceof Error ? e.message : 'Could not load documents.'); } finally { if(key === generation.current) setBusy(false); } }, [scope]);
 useEffect(() => { active.current=true;setRows([]); void load(); return () => { active.current=false;generation.current++; }; }, [load]);
 async function run(work: () => Promise<unknown>) { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await work(); if(active.current)await load(); } catch(e) { if(active.current)setError(e instanceof Error ? e.message : 'Could not complete this action.'); } finally { lock.current = false; if(active.current)setBusy(false); } }
 return <Screen title="Invoices & receipts" subtitle="Original amounts. Clear payment and refund history." refreshing={busy} onRefresh={() => void load()}>
 <Action label="Back" secondary onPress={() => router.back()} />
 {picker}
 {error ? <Notice text={error} onRetry={() => void load()} /> : null}{busy && !rows.length ? <ActivityIndicator /> : null}
 {!busy && !rows.length && !error ? <View style={ui.card}><Text style={ui.title}>Your document history starts here</Text><Text style={ui.muted}>Invoices appear for amounts owed. Receipts are available after a payment is confirmed.</Text></View> : null}
 {rows.map(row => <View key={row.bookingId} style={ui.card}>
  <Text style={ui.label}>{merchant ? row.customerName : row.businessName}</Text><Text style={ui.title}>{row.serviceName}</Text><Text style={ui.muted}>{row.bookingStatus.replaceAll('_',' ')} · {new Date(row.startsAt).toLocaleDateString()}</Text>
  <Text style={ui.text}>Original booking: {formatBusinessMoney(row.originalAmountCents, row.currencyCode)}</Text><Text style={ui.text}>Confirmed payments: {formatBusinessMoney(row.paidCents, row.currencyCode)}</Text><Text style={ui.text}>Confirmed refunds: {formatBusinessMoney(row.refundedCents, row.currencyCode)}</Text><Text style={ui.title}>Due: {row.amountDueCents === null ? 'Review required' : formatBusinessMoney(row.amountDueCents, row.currencyCode)}</Text>
  {row.issues.map(issue => <Notice key={issue} text={issue} />)}
  {row.payments.map(p => <View key={p.id}><Text style={ui.muted}>{p.method} · {p.processorMode === 'test' ? 'TEST PAYMENT' : p.processorMode} · {formatBusinessMoney(p.amountCents, p.currencyCode)}</Text>{p.refundStatus ? <Text style={ui.muted}>Refund: {p.refundStatus.replaceAll('_',' ')} · {formatBusinessMoney(p.refundedCents, p.currencyCode)} confirmed</Text> : null}</View>)}
  {row.documents.map(d => <Action key={d.id} secondary disabled={busy} label={`${d.number} · ${d.kind === 'INVOICE' ? 'Invoice' : 'Receipt'} · PDF`} onPress={() => void run(() => shareBillingDocument(row.bookingId, d, scope))} />)}
  {!row.issues.length && merchant && (row.amountDueCents ?? 0) > 0 && !row.documents.some(d => d.kind === 'INVOICE') ? <Action label="Generate invoice" disabled={busy} onPress={() => void run(() => issueBillingDocument(row.bookingId, 'invoice', scope))} /> : null}
  {!row.issues.length && row.payments.length > row.documents.filter(d => d.kind === 'RECEIPT').length ? <Action label="Generate payment receipts" secondary disabled={busy} onPress={() => void run(() => issueBillingDocument(row.bookingId, 'receipts', scope))} /> : null}
 </View>)}{cursor ? <Action label="Load more" secondary disabled={busy} onPress={() => void load(cursor)} /> : null}
 </Screen>;
}
