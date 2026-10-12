import { ApiRequestError } from "@/src/lib/api/types";

export function getFriendlyApiError(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    if (error.details?.length) {
      const detailMessage = error.details
        .map((item) => item.message)
        .filter(Boolean)
        .join(" ");

      if (detailMessage) {
        return detailMessage;
      }
    }

    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}
