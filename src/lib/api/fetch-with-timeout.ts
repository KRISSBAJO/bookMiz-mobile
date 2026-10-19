export async function requestWithTimeout<T>(url: string, init: RequestInit, consume: (response: Response) => Promise<T>, timeoutMs = 15000) {
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener("abort", relayAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw error;
      const detail = error instanceof Error ? error.message : "";
      throw new Error(
        /ssl|certificate|certpath|trust anchor/i.test(detail)
          ? "Could not connect securely. Check your connection and try again."
          : "Could not connect. Check your internet connection and try again.",
      );
    }
    return await consume(response);
  } catch (error) {
    if (timedOut) throw new Error("Connection timed out. Check your internet connection and try again.");
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", relayAbort);
  }
}
