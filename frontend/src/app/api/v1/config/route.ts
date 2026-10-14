import { proxy } from "@/lib/proxy";
export const dynamic = "force-dynamic";
export async function GET() { return proxy("/api/v1/config"); }

