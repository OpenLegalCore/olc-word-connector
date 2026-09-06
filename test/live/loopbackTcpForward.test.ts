import { once } from "node:events";
import { createConnection, createServer, type Server, type Socket } from "node:net";

import { describe, expect, it } from "vitest";

import { startLoopbackTcpForward } from "./loopbackTcpForward";

async function listen(server: Server): Promise<number> {
  server.listen({ host: "127.0.0.1", port: 0, exclusive: true });
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("TEST_LISTENER_ADDRESS_INVALID");
  }
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("loopbackTcpForward lifecycle", () => {
  it("waits for active socket close events before reporting closed", async () => {
    const upstreamSockets = new Set<Socket>();
    const upstream = createServer((socket) => {
      upstreamSockets.add(socket);
      socket.once("close", () => upstreamSockets.delete(socket));
    });
    const upstreamPort = await listen(upstream);
    const forward = await startLoopbackTcpForward("127.0.0.1", upstreamPort, {
      approveTarget: (host) => host === "127.0.0.1",
    });
    const forwardUrl = new URL(forward.baseUrl);
    const client = createConnection({
      host: forwardUrl.hostname,
      port: Number(forwardUrl.port),
    });
    client.on("error", () => undefined);

    try {
      await once(client, "connect");
      await forward.close();

      expect(forward.isClosed()).toBe(true);
    } finally {
      client.destroy();
      await forward.close();
      for (const socket of upstreamSockets) {
        socket.destroy();
      }
      await closeServer(upstream);
    }
  });
});
