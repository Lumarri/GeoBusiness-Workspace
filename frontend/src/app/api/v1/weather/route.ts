import { proxy } from "@/lib/proxy";
export async function GET(request: Request) {
  return proxy("/api/v1/weather", new URL(request.url).search);
}
