import { redirect } from "next/navigation";

// Sem sessão, o proxy leva de /inicio para /entrar.
export default function Home() {
  redirect("/inicio");
}
