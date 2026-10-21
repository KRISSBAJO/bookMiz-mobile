import { useState } from 'react';
import { Image, Switch, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useBusiness } from '../../store/business-context';
import { businessRequest, type MerchantService, type ServiceCategory } from '../../lib/api/business';
import { moneyInput } from '../../lib/business-policy';
import { Action, Choices, Editor, Field, Notice, ui, useBusinessMutation } from './BusinessUI';
export function ServiceEditor({ service, categoryId, categories, onClose, onSaved }: { service?: MerchantService; categoryId?: string; categories: ServiceCategory[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const b = useBusiness(), mutation = useBusinessMutation();
  const [name, setName] = useState(service?.name ?? ''), [description, setDescription] = useState(service?.description ?? ''), [price, setPrice] = useState(((service?.priceCents ?? 0) / 100).toFixed(2)), [duration, setDuration] = useState(String(service?.durationMinutes ?? 30));
  const [category, setCategory] = useState(categoryId ?? categories[0]?.id ?? ''), [newCategory, setNewCategory] = useState(''), [localCategories, setCategories] = useState(categories), [image, setImage] = useState(service?.imageUrl ?? ''), [active, setActive] = useState(service?.isActive ?? true), [approval, setApproval] = useState(service?.requiresApproval ?? false), [channel, setChannel] = useState(service?.defaultChannel ?? b.workspace.deliveryModes?.[0] ?? 'IN_PERSON');
  const currency = service?.currencyCode ?? b.workspace.currencyCode;
  const [instructions, setInstructions] = useState(service?.bookingInstructions ?? ''), [before, setBefore] = useState(String(service?.bufferBeforeMinutes ?? 0)), [after, setAfter] = useState(String(service?.bufferAfterMinutes ?? 0));
  async function upload() {
    await mutation.run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets[0]) return;
      const file = new File(result.assets[0].uri);
      try {
        if ((result.assets[0].size ?? file.size) > 3 * 1024 * 1024) throw new Error('Choose an image up to 3 MB.');
        const cloud = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME, preset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        if (!cloud || !preset) throw new Error('Photo uploads are not configured in this app version. You can paste an existing HTTPS image URL below.');
        const form = new FormData();
        form.append('file', `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${await file.base64()}`); form.append('upload_preset', preset); form.append('folder', 'bookmiz/services');
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
        const data = await response.json();
        if (!response.ok || !data.secure_url?.startsWith('https://')) throw new Error('Could not upload the photo. Please try again.');
        setImage(data.secure_url);
      } finally { if (file.uri.startsWith(Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`) && file.exists) { try { file.delete(); } catch {} } }
    });
  }
  async function save() {
    await mutation.run(async () => {
      if (!b.canManage) throw new Error('A manager must save this service.');
      if (!name.trim() || !category) throw new Error('Enter a service name and choose a category.');
      const minutes = Number(duration), pre = Number(before), post = Number(after);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440 || !Number.isInteger(pre) || pre < 0 || !Number.isInteger(post) || post < 0) throw new Error('Use a duration of 5–1440 minutes and non-negative whole-minute buffers.');
      const photoChanged = !service || image !== (service.imageUrl ?? '');
      if (photoChanged) { const url = new URL(image); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Add a valid HTTPS service photo.'); }
      const payload = { categoryId: category, name: name.trim(), description: description.trim(), priceCents: moneyInput(price), currencyCode: currency, durationMinutes: minutes, bufferBeforeMinutes: pre, bufferAfterMinutes: post, ...(photoChanged ? { imageUrl: image } : {}), isActive: active, requiresApproval: approval, defaultChannel: channel, availableChannels: service ? [...new Set([...service.availableChannels, channel])] : [channel], bookingInstructions: instructions.trim() };
      await businessRequest(service ? `services/${service.id}` : 'services', b.organizationId, service ? 'PATCH' : 'POST', payload);
    }, async () => { await onSaved(); onClose(); });
  }
  return <Editor title={service ? 'Edit service' : 'Create a service'} subtitle="Clear pricing. A service customers can book." busy={mutation.busy} onClose={onClose} footer={<Action label={service ? 'Save changes' : 'Create service'} busy={mutation.busy} onPress={() => void save()} />}>
    {mutation.error ? <Notice text={mutation.error} /> : null}
    {image.startsWith('https://') ? <Image source={{ uri: image }} style={{ height: 160, width: '100%', borderRadius: 16 }} accessibilityLabel="Service photo" /> : null}<Action label="Choose service photo" secondary icon="image" disabled={mutation.busy} onPress={() => void upload()} /><Field label="Service photo URL" value={image} onChangeText={setImage} autoCapitalize="none" placeholder="https://…" />
    <Field label="Service name" value={name} onChangeText={setName} maxLength={160} /><Field label="Description" value={description} onChangeText={setDescription} multiline />
    <Choices label="Category" items={localCategories.map(c => ({ id: c.id, label: c.name }))} value={category} onChange={setCategory} />
    <View style={ui.card}><Field label="New category (optional)" value={newCategory} onChangeText={setNewCategory} /><Action label="Add category" secondary disabled={!newCategory.trim() || mutation.busy} onPress={() => void mutation.run(async () => { const c = await businessRequest<{ id: string; name: string }>('service-categories', b.organizationId, 'POST', { name: newCategory.trim() }); setCategories(items => [...items, { ...c, services: [] }]); setCategory(c.id); setNewCategory(''); })} /></View>
    <View style={ui.row}><View style={ui.grow}><Field label="Price" keyboardType="decimal-pad" value={price} onChangeText={setPrice} /></View><View style={ui.grow}><Field label="Duration (minutes)" keyboardType="number-pad" value={duration} onChangeText={setDuration} /></View></View>
    <View style={ui.card}><Text style={ui.label}>Service currency</Text><Text style={ui.title}>{currency}</Text><Text style={ui.muted}>{service ? 'This service keeps its original currency. Existing appointments keep their agreed price and currency.' : 'New services use your business currency, selected from your country during setup. Multiple service currencies are not enabled yet.'}</Text></View>
    <Choices label="Appointment type" items={['IN_PERSON', 'HOME_VISIT', 'PHONE', 'VIDEO'].map(c => ({ id: c, label: c.replaceAll('_', ' ') }))} value={channel} onChange={setChannel} />
    <View style={ui.row}><View style={ui.grow}><Field label="Buffer before (minutes)" value={before} onChangeText={setBefore} keyboardType="number-pad" /></View><View style={ui.grow}><Field label="Buffer after (minutes)" value={after} onChangeText={setAfter} keyboardType="number-pad" /></View></View>
    <Field label="Booking instructions" multiline value={instructions} onChangeText={setInstructions} />
    <View style={ui.row}><Text style={[ui.text, ui.grow]}>Available for booking</Text><Switch accessibilityLabel="Service available for booking" value={active} onValueChange={setActive} /></View><View style={ui.row}><Text style={[ui.text, ui.grow]}>Require approval</Text><Switch accessibilityLabel="Require booking approval" value={approval} onValueChange={setApproval} /></View>
  </Editor>;
}
