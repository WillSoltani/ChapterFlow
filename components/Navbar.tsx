import { cookies } from "next/headers";
import { NavbarClient } from "@/components/NavbarClient";

const COOKIE_NAME = "id_token";

export async function Navbar() {
  const cookieStore = await cookies();
  const loggedIn = cookieStore.has(COOKIE_NAME);

  return <NavbarClient initialLoggedIn={loggedIn} />;
}
