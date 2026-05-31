import { client } from "./biip/client.gen";
import { env } from "../env";

console.log("[BIIP Client] Initializing custom client and interceptors...");

// Configure the base URL dynamically from environment variables
client.setConfig({
  baseUrl: env.BIIP_BASE_URL,
});

// Interceptor to audit and format outgoing requests
client.interceptors.request.use((request, options) => {
  // Inject standard application identifier headers
  request.headers.set("X-Application-Name", "Zeme LT");
  request.headers.set("User-Agent", "ZemeServer/1.0");

  // Log outgoing requests during development/debug phases
  console.log(`[BIIP Client] Request: ${request.method} ${request.url}`);
  
  // Attach a timestamp to the options meta object to track response latency
  if (options && typeof options === "object") {
    (options as any).meta = {
      ...(options as any).meta,
      startTime: Date.now(),
    };
  }

  return request;
});

// Interceptor to monitor responses, log performance metrics, and log errors
client.interceptors.response.use((response, request, options) => {
  const startTime = (options as any)?.meta?.startTime;
  const duration = startTime ? `${Date.now() - startTime}ms` : "unknown";

  if (response.ok) {
    console.log(
      `[BIIP Client] Response Success: ${response.status} ${request.method} ${request.url} (Latency: ${duration})`
    );
  } else {
    console.error(
      `[BIIP Client] Response Error: ${response.status} ${response.statusText} for ${request.method} ${request.url} (Latency: ${duration})`
    );
  }

  return response;
});

// Interceptor to catch and format underlying network/connection errors
client.interceptors.error.use((error, response, request) => {
  console.error(
    `[BIIP Client] Network or Connection Error:`,
    error instanceof Error ? error.message : error
  );
  return error;
});

// Export the pre-configured global client for use
export { client as biipClient };
