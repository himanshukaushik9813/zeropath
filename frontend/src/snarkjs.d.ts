// snarkjs ships no type declarations. Declare the minimal surface used by the
// in-browser proof pipeline (frontend/src/store/protocol-store.ts).
declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{
      proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
      publicSignals: string[];
    }>;
    verify(
      vk: unknown,
      publicSignals: string[],
      proof: unknown
    ): Promise<boolean>;
  };
}
