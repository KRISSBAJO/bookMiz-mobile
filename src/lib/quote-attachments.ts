import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { requestJson, getAuthTokens } from './api/client';
import { mobileEnv } from './mobile-env';
import type { CustomerQuoteConversation } from './api/types';
export type QuoteAttachmentUpload = {fileName:string;mimeType:string;contentBase64:string};
export type QuoteAttachment = {id:string;fileName:string;mimeType:string;sizeBytes:number};
const base = `${mobileEnv.bookingApiUrl}/marketplace`;
export async function pickQuoteAttachment(): Promise<QuoteAttachmentUpload | null> {
  const result = await DocumentPicker.getDocumentAsync({type:['application/pdf','image/jpeg','image/png','image/webp','text/plain'],copyToCacheDirectory:true,multiple:false});
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0], file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > 5 * 1024 * 1024) throw new Error('Choose a file up to 5 MB.');
    if (!asset.mimeType) throw new Error('This file type could not be identified. Choose a PDF, image or text file.');
    return {fileName:asset.name,mimeType:asset.mimeType,contentBase64:await file.base64()};
  } finally {
    if (file.uri.startsWith(Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`) && file.exists) file.delete();
  }
}
export async function sendQuoteAttachment(conversation: CustomerQuoteConversation, role:'REQUESTER'|'PROVIDER', attachment:QuoteAttachmentUpload, caption:string) {
  const path = role === 'PROVIDER' ? `/quote-matches/${conversation.quoteMatchId}/conversation/messages`
    : `/quotes/${conversation.quoteRequestId}/conversations/${conversation.id}/messages`;
  return requestJson(`${base}${path}`,{auth:true,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:caption.trim() || 'Shared a file',attachment})});
}
export async function openQuoteAttachment(conversationId:string,messageId:string,attachment:QuoteAttachment) {
  await requestJson(`${mobileEnv.identityApiUrl}/auth/me`,{auth:true});
  const accessToken = getAuthTokens()?.accessToken;
  if (!accessToken) throw new Error('Sign in again to open this file.');
  if (!await Sharing.isAvailableAsync()) throw new Error('File opening is unavailable on this device.');
  const target = new File(Paths.cache,`bookmiz-chat-${attachment.id.replace(/[^a-zA-Z0-9-]/g,'_')}-${attachment.fileName.replace(/[^a-zA-Z0-9_.-]/g,'_').slice(-100)}`);
  try {
    await File.downloadFileAsync(`${base}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}/download`,target,{headers:{Authorization:`Bearer ${accessToken}`},idempotent:true});
    await Sharing.shareAsync(target.uri,{mimeType:attachment.mimeType});
  } finally { if(target.exists) target.delete(); }
}
