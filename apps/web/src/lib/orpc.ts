import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ParcelReport, ParcelSearchItem } from "@zeme/shared";

type ParcelClient = {
  parcel: {
    autocomplete(input: { query: string }): Promise<ParcelSearchItem[]>;
    getReport(input: { cadastralRegNo: string; forceRefresh?: boolean }): Promise<ParcelReport>;
  };
};

const link = new RPCLink({
  url: `${window.location.origin}/rpc`,
});

export const orpcClient = createORPCClient<ParcelClient>(link);
