import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EstadoVazio } from "@/components/ui/basicos";

export default function NaoEncontrado() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <EstadoVazio
        icone={FileQuestion}
        titulo="Página não encontrada"
        texto="O endereço pode estar errado, ou a licitação saiu da base porque já encerrou há muito tempo."
        acao={
          <Link href="/buscar" className="text-sm font-semibold text-accent hover:underline">
            Ir para a busca
          </Link>
        }
      />
    </main>
  );
}
