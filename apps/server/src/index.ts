import { RPCHandler } from "@orpc/server/fetch";
import { appRouter } from "./router";
import { env } from "./env";
import { join } from "node:path";

const rpcHandler = new RPCHandler(appRouter);
const port = env.PORT;

const server = Bun.serve({
  port,
  fetch: async (request) => {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/rpc")) {
      const result = await rpcHandler.handle(request, { prefix: "/rpc" });

      if (result.matched) {
        return result.response;
      }
    }

    if (pathname.startsWith("/api/pdf/")) {
      const filename = pathname.slice("/api/pdf/".length);
      if (filename.includes("..") || filename.includes("/")) {
        return new Response("Invalid filename", { status: 400 });
      }
      const filePath = join(process.cwd(), "generated", "pdf", filename);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${filename}"`,
          },
        });
      } else {
        return new Response("File not found", { status: 404 });
      }
    }

    if (pathname === "/api/health") {
      return Response.json({ ok: true, service: "zeme-server" });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`zeme server listening on http://localhost:${server.port}`);
