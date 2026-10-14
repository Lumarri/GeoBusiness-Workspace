import { proxy } from "@/lib/proxy";
export async function GET(request: Request) {
  return proxy("/api/v1/locations/search", new URL(request.url).search);
}
