import { RpcProvider } from "starknet";

export function makeProvider() {
  const { STARKNET_RPC_URL } = process.env;
  if (!STARKNET_RPC_URL) throw new Error("Missing STARKNET_RPC_URL");
  return new RpcProvider({ nodeUrl: STARKNET_RPC_URL });
}
