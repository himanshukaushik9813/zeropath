import { createServer } from "node:http";

// @ts-ignore — circomlibjs has no TS types
import { buildPoseidon } from "circomlibjs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceEvent = {
  chain: string;
  leafIndex: number;
  intentHash: string;
  sourceCommitment: string;
  destinationCommitment: string;
  routeCommitment: string;
  blockNumber: number;
};

type DemoSecret = {
  leafIndex: number;
  secret: string;
  amount: string;
  assetId: string;
  routeSalt: string;
  receiverViewKey: string;
  epoch: number;
};

type SparseMerkleTree = {
  root: bigint;
  leaves: Map<number, bigint>;
  depth: number;
};

// ---------------------------------------------------------------------------
// Sparse Poseidon Merkle tree (depth 32, memory-efficient)
// ---------------------------------------------------------------------------

const TREE_DEPTH = 32;

let poseidon: any;
let F: any; // finite field utilities from circomlibjs

// Precomputed zero-hashes: zeroHashes[i] = hash of empty subtree at depth i
let zeroHashes: bigint[];

async function initPoseidon() {
  poseidon = await buildPoseidon();
  F = poseidon.F;

  // Precompute zero hashes for sparse tree
  zeroHashes = new Array(TREE_DEPTH + 1);
  zeroHashes[0] = 0n;
  for (let i = 1; i <= TREE_DEPTH; i++) {
    zeroHashes[i] = poseidonHash([zeroHashes[i - 1], zeroHashes[i - 1]]);
  }
}

function poseidonHash(inputs: bigint[]): bigint {
  return F.toObject(poseidon(inputs));
}

/**
 * Build a sparse Merkle tree from a small set of leaves at known indices.
 * Only stores populated nodes; uses precomputed zero-hashes for empty subtrees.
 */
function buildSparseMerkleTree(leafEntries: Array<{ index: number; value: bigint }>): SparseMerkleTree {
  const leaves = new Map<number, bigint>();
  for (const entry of leafEntries) {
    leaves.set(entry.index, entry.value);
  }

  // Build layers bottom-up, only tracking non-default nodes
  const layers: Map<number, bigint>[] = [new Map(leaves)];

  for (let depth = 0; depth < TREE_DEPTH; depth++) {
    const currentLayer = layers[depth];
    const nextLayer = new Map<number, bigint>();

    // Collect all parent indices that have at least one non-default child
    const parentIndices = new Set<number>();
    for (const idx of currentLayer.keys()) {
      parentIndices.add(Math.floor(idx / 2));
    }

    for (const parentIdx of parentIndices) {
      const leftIdx = parentIdx * 2;
      const rightIdx = parentIdx * 2 + 1;
      const left = currentLayer.get(leftIdx) ?? zeroHashes[depth];
      const right = currentLayer.get(rightIdx) ?? zeroHashes[depth];
      nextLayer.set(parentIdx, poseidonHash([left, right]));
    }

    layers.push(nextLayer);
  }

  const root = layers[TREE_DEPTH].get(0) ?? zeroHashes[TREE_DEPTH];

  // Store layers on the tree object for proof generation
  (leaves as any).__layers = layers;

  return { root, leaves, depth: TREE_DEPTH };
}

function getMerkleProof(tree: SparseMerkleTree, leafIndex: number) {
  const layers: Map<number, bigint>[] = (tree.leaves as any).__layers;
  const path: string[] = [];
  const indices: number[] = [];
  let idx = leafIndex;

  for (let depth = 0; depth < TREE_DEPTH; depth++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = layers[depth].get(siblingIdx) ?? zeroHashes[depth];
    path.push(sibling.toString());
    indices.push(idx % 2);
    idx = Math.floor(idx / 2);
  }

  return {
    root: tree.root.toString(),
    path,
    indices,
    pending: false,
  };
}

// ---------------------------------------------------------------------------
// Demo data (pre-seeded for hackathon)
// ---------------------------------------------------------------------------

const demoSecrets: DemoSecret[] = [
  {
    leafIndex: 0,
    secret: "12345678901234567890",
    amount: "5000",
    assetId: "1",
    routeSalt: "111111111111111",
    receiverViewKey: "222222222222222",
    epoch: 4219,
  },
  {
    leafIndex: 1,
    secret: "98765432109876543210",
    amount: "10000",
    assetId: "1",
    routeSalt: "333333333333333",
    receiverViewKey: "444444444444444",
    epoch: 4219,
  },
  {
    leafIndex: 2,
    secret: "55555555555555555555",
    amount: "2500",
    assetId: "2",
    routeSalt: "666666666666666",
    receiverViewKey: "777777777777777",
    epoch: 4219,
  },
  {
    leafIndex: 3,
    secret: "11111111111111111111",
    amount: "7500",
    assetId: "1",
    routeSalt: "888888888888888",
    receiverViewKey: "999999999999999",
    epoch: 4219,
  },
];

let sourceTree: SparseMerkleTree;
let batchTree: SparseMerkleTree;
const events: SourceEvent[] = [];

async function seedDemoData() {
  await initPoseidon();

  const sourceEntries: Array<{ index: number; value: bigint }> = [];
  const batchEntries: Array<{ index: number; value: bigint }> = [];

  for (const demo of demoSecrets) {
    const secret = BigInt(demo.secret);
    const amount = BigInt(demo.amount);
    const assetId = BigInt(demo.assetId);
    const routeSalt = BigInt(demo.routeSalt);
    const receiverViewKey = BigInt(demo.receiverViewKey);
    const epoch = BigInt(demo.epoch);

    // Derive values matching the circuit constraints
    const nullifierHash = poseidonHash([secret, 1n]);
    const destinationCommitment = poseidonHash([receiverViewKey, secret, routeSalt]);

    // Source event leaf: Poseidon(secret, amount, asset_id, destination_commitment, route_salt)
    const sourceLeaf = poseidonHash([secret, amount, assetId, destinationCommitment, routeSalt]);
    sourceEntries.push({ index: demo.leafIndex, value: sourceLeaf });

    // Batch leaf: Poseidon(nullifier_hash, destination_commitment, asset_id, epoch, amount)
    const batchLeaf = poseidonHash([nullifierHash, destinationCommitment, assetId, epoch, amount]);
    batchEntries.push({ index: demo.leafIndex, value: batchLeaf });

    // Record as source event
    events.push({
      chain: "ethereum",
      leafIndex: demo.leafIndex,
      intentHash: `0x${sourceLeaf.toString(16).padStart(64, "0")}`,
      sourceCommitment: `0x${sourceLeaf.toString(16).padStart(64, "0")}`,
      destinationCommitment: `0x${destinationCommitment.toString(16).padStart(64, "0")}`,
      routeCommitment: `0x${routeSalt.toString(16).padStart(64, "0")}`,
      blockNumber: 19_000_000 + demo.leafIndex,
    });
  }

  console.log("Building source event sparse Merkle tree (depth 32)...");
  sourceTree = buildSparseMerkleTree(sourceEntries);
  console.log(`  Source root: ${sourceTree.root.toString()}`);

  console.log("Building batch sparse Merkle tree (depth 32)...");
  batchTree = buildSparseMerkleTree(batchEntries);
  console.log(`  Batch root:  ${batchTree.root.toString()}`);
  console.log(`  Demo events: ${events.length}`);
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

async function main() {
  await seedDemoData();

  const port = Number(process.env.PORT ?? 8787);
  const server = createServer(async (request, response) => {
    // CORS headers for frontend
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true, service: "zeropath-relayer" });
    }

    // Merkle proof for source event tree
    if (request.method === "GET" && url.pathname.startsWith("/v1/merkle-proof/source/")) {
      const parts = url.pathname.split("/");
      const leafIndex = Number(parts[parts.length - 1]);
      if (isNaN(leafIndex) || leafIndex < 0 || leafIndex >= sourceTree.leaves.length) {
        return json(response, 200, { root: "0", path: [], indices: [], pending: true });
      }
      return json(response, 200, getMerkleProof(sourceTree, leafIndex));
    }

    // Merkle proof for batch tree
    if (request.method === "GET" && url.pathname.startsWith("/v1/merkle-proof/batch/")) {
      const parts = url.pathname.split("/");
      const leafIndex = Number(parts[parts.length - 1]);
      if (isNaN(leafIndex) || leafIndex < 0 || leafIndex >= batchTree.leaves.length) {
        return json(response, 200, { root: "0", path: [], indices: [], pending: true });
      }
      return json(response, 200, getMerkleProof(batchTree, leafIndex));
    }

    // Legacy format: /v1/merkle-proof/{chain}/{leafIndex}
    if (request.method === "GET" && url.pathname.startsWith("/v1/merkle-proof/")) {
      const [, , , chain, leafIndex] = url.pathname.split("/");
      const idx = Number(leafIndex);
      if (isNaN(idx) || idx < 0) {
        return json(response, 200, { root: "0", path: [], indices: [], pending: true });
      }
      // Return both source and batch proofs
      const sourceProof = getMerkleProof(sourceTree, idx);
      const batchProof = getMerkleProof(batchTree, idx);
      return json(response, 200, {
        chain,
        leafIndex: idx,
        source: sourceProof,
        batch: batchProof,
      });
    }

    if (request.method === "GET" && url.pathname === "/v1/events") {
      return json(response, 200, { events });
    }

    // Demo secrets endpoint (hackathon only — exposes pre-seeded private inputs)
    if (request.method === "GET" && url.pathname === "/v1/demo-secrets") {
      const enriched = demoSecrets.map((demo) => {
        const secret = BigInt(demo.secret);
        const amount = BigInt(demo.amount);
        const assetId = BigInt(demo.assetId);
        const routeSalt = BigInt(demo.routeSalt);
        const receiverViewKey = BigInt(demo.receiverViewKey);
        const epoch = BigInt(demo.epoch);

        const nullifierHash = poseidonHash([secret, 1n]);
        const destinationCommitment = poseidonHash([receiverViewKey, secret, routeSalt]);

        return {
          ...demo,
          nullifierHash: nullifierHash.toString(),
          destinationCommitment: destinationCommitment.toString(),
          sourceEventRoot: sourceTree.root.toString(),
          batchRoot: batchTree.root.toString(),
        };
      });
      return json(response, 200, { secrets: enriched });
    }

    // Roots endpoint — returns current tree roots for contract initialization
    if (request.method === "GET" && url.pathname === "/v1/roots") {
      return json(response, 200, {
        sourceEventRoot: sourceTree.root.toString(),
        batchRoot: batchTree.root.toString(),
      });
    }

    return json(response, 404, { error: "not_found" });
  });

  server.listen(port, () => {
    console.log(`ZeroPath relayer listening on http://localhost:${port}`);
    console.log(`  GET /health`);
    console.log(`  GET /v1/merkle-proof/{chain}/{leafIndex}`);
    console.log(`  GET /v1/merkle-proof/source/{leafIndex}`);
    console.log(`  GET /v1/merkle-proof/batch/{leafIndex}`);
    console.log(`  GET /v1/events`);
    console.log(`  GET /v1/roots`);
    console.log(`  GET /v1/demo-secrets`);
  });
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
