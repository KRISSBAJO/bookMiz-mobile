import { requestJson } from "@/src/lib/api/client";
import { mobileEnv } from "@/src/lib/mobile-env";
import type {
  AgentDashboard,
  AgentOperationsQueueResponse,
  AgentOperationsRequestDetail,
  PlatformAgentPayoutAccount,
  PlatformAgentPayoutRequest,
  PlatformPayoutAccountResolution,
  PlatformPayoutBankDirectory,
} from "@/src/lib/api/types";

const growthUrl = `${mobileEnv.bookingApiUrl}/growth/agent`;

export function getAgentDashboard() {
  return requestJson<AgentDashboard>(`${growthUrl}/dashboard`, {
    method: "GET",
    auth: true,
  });
}

export function getAgentOperationsRequests(params?: {
  status?: string;
  serviceModel?: string;
  search?: string;
  stateCode?: string;
  countryCode?: string;
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();

  if (params?.status) {
    search.set("status", params.status);
  }

  if (params?.serviceModel) {
    search.set("serviceModel", params.serviceModel);
  }

  if (params?.search) {
    search.set("search", params.search);
  }

  if (params?.stateCode) {
    search.set("stateCode", params.stateCode);
  }

  if (params?.countryCode) {
    search.set("countryCode", params.countryCode);
  }

  if (params?.page) {
    search.set("page", String(params.page));
  }

  if (params?.pageSize) {
    search.set("pageSize", String(params.pageSize));
  }

  return requestJson<AgentOperationsQueueResponse>(
    `${growthUrl}/ops/requests${search.size ? `?${search.toString()}` : ""}`,
    {
      method: "GET",
      auth: true,
    },
  );
}

export function getAgentOperationsRequestDetail(quoteRequestId: string) {
  return requestJson<AgentOperationsRequestDetail>(
    `${growthUrl}/ops/requests/${encodeURIComponent(quoteRequestId)}`,
    {
      method: "GET",
      auth: true,
    },
  );
}

export function createAgentPayoutRequest(payload?: {
  payoutAccountId?: string;
  amountCents?: number;
  agentNote?: string;
}) {
  return requestJson<PlatformAgentPayoutRequest>(`${growthUrl}/payout-requests`, {
    method: "POST",
    auth: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });
}

export function updateAgentPayoutAccount(payload: {
  accountId?: string;
  countryCode?: string;
  currencyCode?: string;
  accountHolderName?: string;
  bankName?: string;
  bankCode?: string;
  branchCode?: string;
  accountNumber?: string;
  routingNumber?: string;
  accountReference?: string;
  destinationLabel?: string;
  payoutNotes?: string;
  setAsDefault?: boolean;
}) {
  return requestJson<PlatformAgentPayoutAccount>(`${growthUrl}/payout-account`, {
    method: "PATCH",
    auth: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function listAgentPayoutBanks(countryCode: string) {
  const search = new URLSearchParams();
  search.set("countryCode", countryCode);

  return requestJson<PlatformPayoutBankDirectory>(`${growthUrl}/payout-banks?${search.toString()}`, {
    method: "GET",
    auth: true,
  });
}

export function resolveAgentPayoutAccount(params: {
  countryCode: string;
  bankCode: string;
  accountNumber: string;
}) {
  const search = new URLSearchParams();
  search.set("countryCode", params.countryCode);
  search.set("bankCode", params.bankCode);
  search.set("accountNumber", params.accountNumber);

  return requestJson<PlatformPayoutAccountResolution>(
    `${growthUrl}/payout-account/resolve?${search.toString()}`,
    {
      method: "GET",
      auth: true,
    },
  );
}

export function setDefaultAgentPayoutAccount(accountId: string) {
  return requestJson<PlatformAgentPayoutAccount>(
    `${growthUrl}/payout-accounts/${encodeURIComponent(accountId)}/default`,
    {
      method: "POST",
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
}
