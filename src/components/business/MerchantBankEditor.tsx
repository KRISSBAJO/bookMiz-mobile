import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useBusiness } from '../../store/business-context';
import { businessRequest } from '../../lib/api/business';
import type { PayoutAccount } from '../../lib/api/business-money';
import { Action, Choices, Editor, Field, Notice, ui, useBusinessData, useBusinessMutation } from './BusinessUI';

export function MerchantBankEditor({ account, onClose, onSaved }: { account?: PayoutAccount; onClose: () => void; onSaved: () => Promise<void> }) {
  const b = useBusiness(), mutation = useBusinessMutation();
  const banks = useBusinessData(useCallback(() => businessRequest<{ banks: { code: string; name: string; active: boolean; currencyCode: string | null }[] }>('money/banks', b.organizationId), [b.organizationId]));
  const [search, setSearch] = useState(''), [bank, setBank] = useState(account?.bankCode ?? ''), [number, setNumber] = useState(''), [verified, setVerified] = useState<{ bankCode: string; number: string; accountName: string; bankName: string } | null>(null), [makeDefault, setMakeDefault] = useState(account?.isDefault ? 'yes' : 'no');
  const options = banks.data?.banks.filter(item => item.active && (!item.currencyCode || item.currencyCode === 'NGN')) ?? [];
  const resolve = () => void mutation.run(async () => {
    if (!/^\d{10}$/.test(number)) throw new Error('Enter the 10-digit Nigerian account number.');
    if (!options.some(item => item.code === bank)) throw new Error('Choose your bank.');
    const result = await businessRequest<{ accountName: string; bankName: string }>('money/banks/resolve', b.organizationId, 'POST', { bankCode: bank, accountNumber: number });
    setVerified({ bankCode: bank, number, accountName: result.accountName, bankName: result.bankName });
  });
  const valid = verified?.number === number && verified.bankCode === bank;
  return <Editor title={account ? 'Update Paystack destination' : 'Add Paystack destination'} subtitle="Nigerian bank account · NGN" busy={mutation.busy} onClose={onClose}>
    <Text style={ui.muted}>Bank details are encrypted by BookMiz. This form does not save an account-number draft on your device. Stripe bank details are managed through Stripe’s hosted setup.</Text>
    {banks.error ? <Notice text={banks.error} onRetry={() => void banks.refresh()} /> : null}{mutation.error ? <Notice text={mutation.error} /> : null}
    <Field label="Find your bank" value={search} onChangeText={setSearch} placeholder="Search bank name" />
    <Choices label="Bank" value={bank} items={options.filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.code === bank).slice(0, 30).map(item => ({ id: item.code, label: item.name }))} onChange={value => { setBank(value); setVerified(null); }} />
    <Field label="Account number" keyboardType="number-pad" autoComplete="off" maxLength={10} value={number} onChangeText={value => { setNumber(value.replace(/\D/g, '').slice(0, 10)); setVerified(null); }} />
    {!valid ? <Action label="Verify account holder" secondary busy={mutation.busy} disabled={banks.loading} onPress={resolve} /> : <View style={ui.card}><Text style={ui.muted}>VERIFIED ACCOUNT HOLDER</Text><Text style={ui.title}>{verified.accountName}</Text><Text style={ui.text}>{verified.bankName} · •••• {verified.number.slice(-4)}</Text></View>}
    <Choices label="Use as default destination" items={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} value={makeDefault} onChange={setMakeDefault} />
    <Action label="Save bank destination" disabled={!valid} busy={mutation.busy} onPress={() => void mutation.run(async () => {
      if (!verified || !valid) throw new Error('Verify the current bank and account number first.');
      await businessRequest('settings/payout-account', b.organizationId, 'PATCH', { ...(account ? { accountId: account.id } : {}), countryCode: 'NG', currencyCode: 'NGN', bankCode: verified.bankCode, accountNumber: verified.number, accountHolderName: verified.accountName, bankName: verified.bankName, setAsDefault: makeDefault === 'yes' });
      setNumber(''); setVerified(null); await onSaved();
    })} />
  </Editor>;
}
