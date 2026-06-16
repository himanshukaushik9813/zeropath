import { createServer } from "node:http";

type SourceEvent = {
  chain: string;
  leafIndex: number;
  intentHash: string;
  sourceCommitment: string;
  destinationCommitment: string;
  routeCommitment: string;
  blockNumber: number;
};

const events: SourceEvent[] = [];

async function main() {
  const port = Number(process.env.PORT ?? 8787);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true, service: "zeropath-relayer" });
    }

    if (request.method === "GET" && url.pathname.startsWith("/v1/merkle-proof/")) {
      const [, , , chain, leafIndex] = url.pathname.split("/");
      return json(response, 200, buildMerkleProof(chain, Number(leafIndex)));
    }

    if (request.method === "GET" && url.pathname === "/v1/events") {
      return json(response, 200, { events });
    }

    return json(response, 404, { error: "not_found" });
  });

  server.listen(port, () => {
    console.log(`ZeroPath relayer listening on ${port}`);
  });
}

function buildMerkleProof(chain: string, leafIndex: number) {
  const event = events.find((item) => item.chain === chain && item.leafIndex === leafIndex);
  if (!event) {
    return {
      root: "0x" + "00".repeat(32),
      path: [],
      indices: [],
      pending: true,
    };
  }

  return {
    root: pseudoHash(`${event.chain}:${event.blockNumber}`),
    path: Array.from({ length: 32 }, (_, index) => pseudoHash(`${event.intentHash}:${index}`)),
    indices: Array.from({ length: 32 }, (_, index) => (leafIndex >> index) & 1),
    pending: false,
  };
}

function pseudoHash(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return "0x" + hash.toString(16).padStart(64, "0");
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
