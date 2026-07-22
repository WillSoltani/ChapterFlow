import "server-only";
import { handleSessionGet } from "../_lib/session-route-handler";

export async function GET(req: Request) {
  return handleSessionGet(req);
}
