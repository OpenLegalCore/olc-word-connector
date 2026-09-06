import { createConnection, createServer, isIP, type Server, type Socket } from "node:net";

export interface LoopbackTcpForward {
  readonly baseUrl: string;
  readonly isClosed: () => boolean;
  close(): Promise<void>;
}

export interface LoopbackTcpForwardDependencies {
  readonly approveTarget?: (host: string) => boolean;
}

function isApprovedPrivateTarget(host: string): boolean {
  if (isIP(host) !== 4) {
    return false;
  }
  const octets = host.split(".").map(Number);
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function validPort(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 65_535;
}

export async function startLoopbackTcpForward(
  targetHost: string,
  targetPort: number,
  dependencies: LoopbackTcpForwardDependencies = {}
): Promise<LoopbackTcpForward> {
  const approveTarget = dependencies.approveTarget ?? isApprovedPrivateTarget;
  if (!approveTarget(targetHost) || !validPort(targetPort)) {
    throw new Error("OLC_WORD_LIVE_FORWARD_CONFIGURATION_INVALID");
  }

  const sockets = new Set<Socket>();
  let closed = false;
  const server: Server = createServer((client) => {
    const upstream = createConnection({ host: targetHost, port: targetPort });
    sockets.add(client);
    sockets.add(upstream);
    const remove = (socket: Socket): void => {
      sockets.delete(socket);
    };
    client.once("close", () => remove(client));
    upstream.once("close", () => remove(upstream));
    client.once("error", () => upstream.destroy());
    upstream.once("error", () => client.destroy());
    client.pipe(upstream);
    upstream.pipe(client);
  });

  const localPort = await new Promise<number>((resolve, reject) => {
    const fail = (): void => reject(new Error("OLC_WORD_LIVE_FORWARD_START_FAILED"));
    server.once("error", fail);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      server.off("error", fail);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("OLC_WORD_LIVE_FORWARD_START_FAILED"));
        return;
      }
      resolve(address.port);
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${localPort}`,
    isClosed: () => closed && !server.listening && sockets.size === 0,
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      const serverClosed = new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(new Error("OLC_WORD_LIVE_FORWARD_CLOSE_FAILED"));
          } else {
            resolve();
          }
        });
      });
      const socketsClosed = [...sockets].map(
        (socket) =>
          new Promise<void>((resolve) => {
            if (socket.closed) {
              sockets.delete(socket);
              resolve();
              return;
            }
            socket.once("close", resolve);
            socket.destroy();
          })
      );
      await Promise.all([serverClosed, ...socketsClosed]);
      sockets.clear();
    },
  };
}
