import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text } from 'react-native';
import { getMerchantConversation, sendMerchantMessage, type MerchantConversation } from '../../lib/api/business';
import type { CustomerQuoteConversation } from '../../lib/api/types';
import { QuoteChatModal } from '../QuoteChatModal';
import { useSession } from '../../store/session-context';
import { useBusiness } from '../../store/business-context';
import { useSavedDraft } from '../../lib/use-saved-draft';
import { getFriendlyApiError } from '../../lib/api/error-display';
import { Editor, Notice, useBusinessMutation } from './BusinessUI';
export function MerchantChat({ matchId, initialDraft = '', onClose }: { matchId: string; initialDraft?: string; onClose: () => void }) {
  const session = useSession(), business = useBusiness(), [conversation, setConversation] = useState<MerchantConversation | null>(null), [draft, setDraft] = useState(initialDraft), [syncIssue, setIssue] = useState('');
  const mutation = useBusinessMutation(), fetching = useRef(false), active = useRef(true), sending = useRef(false), retryAt = useRef(0), revision = useRef(0);
  const saved = useSavedDraft<string>(`merchant-chat-${session.user?.id}-${business.organizationId}-${matchId}`, draft, value => { if (!initialDraft) setDraft(value); });
  const refresh = useCallback(async () => {
    if (fetching.current || sending.current || Date.now() < retryAt.current) return;
    fetching.current = true; const version = revision.current;
    try { const data = await getMerchantConversation(matchId); if (active.current && !sending.current && revision.current === version) { setConversation(data); setIssue(''); } }
    catch (e) { if (active.current) { setIssue(getFriendlyApiError(e, 'Messages could not refresh.')); retryAt.current = Date.now() + 30000; } }
    finally { fetching.current = false; }
  }, [matchId]);
  useEffect(() => { active.current = true; void refresh(); const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 20000); return () => { active.current = false; clearInterval(timer); }; }, [refresh]);
  const send = () => void mutation.run(async () => {
    const text = draft.trim();
    if (!text || text.length > 4000) throw new Error('Use a message between 1 and 4000 characters.');
    if (!business.canManage) throw new Error('Only managers can reply to customer requests.');
    sending.current = true; revision.current++;
    try { const next = await sendMerchantMessage(matchId, text); if (active.current) { setConversation(next); setDraft(''); await saved.clearDraft(); } }
    finally { sending.current = false; }
  });
  if (!conversation) return <Editor title="Customer conversation" onClose={onClose}>{syncIssue ? <Notice text={syncIssue} onRetry={() => { retryAt.current = 0; void refresh(); }} /> : <ActivityIndicator />}<Text>Loading your conversation…</Text></Editor>;
  const adapted: CustomerQuoteConversation = { id: conversation.id, quoteRequestId: '', quoteMatchId: matchId, providerId: business.workspace.id, requesterName: conversation.quoteRequest.requesterName, requesterEmail: null, requesterPhone: null, status: !business.canManage || ['DECLINED', 'EXPIRED'].includes(conversation.quoteMatch.status) ? 'ARCHIVED' : conversation.status as CustomerQuoteConversation['status'], unlockedAt: null, customerAcceptedAt: null, updatedAt: '', messages: conversation.messages };
  return <QuoteChatModal visible conversation={adapted} conversations={[adapted]} headingName={conversation.quoteRequest.requesterName} ownRole="PROVIDER" serviceName={conversation.quoteRequest.requestedServiceName} draft={draft} sending={mutation.busy} error={mutation.error || saved.draftError} syncIssue={syncIssue} onClose={onClose} onSelect={() => {}} onDraftChange={setDraft} onSend={send} onRefresh={() => { retryAt.current = 0; void refresh(); }} />;
}
