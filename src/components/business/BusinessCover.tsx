import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { mobileEnv } from '../../lib/mobile-env';
import { tokens as t } from '../../theme/tokens';

export function businessCoverUrl(value?: string | null) {
  const url = value?.trim();
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) return `${mobileEnv.webAppUrl.replace(/\/$/, '')}${url}`;
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : null; }
  catch { return null; }
}

export function BusinessCover({ url, name, wide = false }: { url?: string | null; name: string; wide?: boolean }) {
  const source = businessCoverUrl(url), [failed, setFailed] = useState<string | null>(null);
  const remote = !!source && source !== failed;
  return <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: '#e9e7df' }}>
    <Image key={source || 'default'} testID="business-cover-image" accessible={false} source={remote ? { uri: source } : require('../../../assets/bookmiz/default-business-cover.png')} onError={() => { if (source) setFailed(source); }} resizeMode="cover" style={{ width: '100%', height: wide ? 210 : 160 }} />
    <View style={{ backgroundColor: '#132849', paddingHorizontal: 18, paddingVertical: 13, gap: 3 }}><Text style={{ color: '#cfdfb9', fontFamily: t.font.medium, fontSize: 9, letterSpacing: 1.3 }}>YOUR BUSINESS</Text><Text style={{ color: '#fff', fontFamily: t.font.displayBold, fontSize: 22, lineHeight: 28 }}>{name}</Text></View>
  </View>;
}
