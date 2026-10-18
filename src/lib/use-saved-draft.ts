import { useEffect, useRef, useState } from "react";
import { readDraft, writeDraft } from "@/src/lib/drafts";

export function useSavedDraft<T>(
  key: string | null,
  value: T,
  restore: (value: T) => void,
  enabled = true,
) {
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!key || !enabled) return;
    let active = true;
    readDraft<T>(key)
      .then((draft) => {
        if (active && draft) restoreRef.current(draft);
      })
      .catch(() => {
        if (active) setDraftError("Could not restore the saved draft.");
      })
      .finally(() => {
        if (active) setHydratedKey(key);
      });
    return () => {
      active = false;
    };
  }, [key, enabled]);
  useEffect(() => {
    if (!key || hydratedKey !== key || !enabled) return;
    const timer = setTimeout(() => {
      void writeDraft(key, JSON.parse(serialized))
        .then(() => setDraftError(null))
        .catch(() =>
          setDraftError(
            "Draft could not be saved on this device. Keep this page open until you finish.",
          ),
        );
    }, 400);
    timerRef.current = timer;
    return () => clearTimeout(timer);
  }, [key, hydratedKey, enabled, serialized]);
  return {
    draftError,
    clearDraft: async () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (key) await writeDraft(key, null);
    },
  };
}
