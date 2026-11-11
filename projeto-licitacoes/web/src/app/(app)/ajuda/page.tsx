import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Ajuda" };

const SECOES = [
  { id: "usar", titulo: "Como usar o LS Busca" },
  { id: "caminho", titulo: "Do edital ao contrato" },
  { id: "modalidades", titulo: "Modalidades" },
  { id: "julgamento", titulo: "Como se escolhe o vencedor" },
  { id: "habilitacao", titulo: "Habilitação" },
  { id: "me-epp", titulo: "Vantagens de ME e EPP" },
  { id: "glossario", titulo: "Glossário" },
  { id: "perguntas", titulo: "Perguntas frequentes" },
];

const MODALIDADES = [
  ["Pregão", "Para bens e serviços comuns, aqueles que o mercado define por padrões objetivos. A disputa é por lances e vence, em regra, o menor preço ou o maior desconto."],
  ["Concorrência", "Para obras, serviços de engenharia, serviços especiais e bens de maior complexidade. Pode julgar por preço, por técnica e preço, entre outros critérios."],
  ["Concurso", "Para escolher trabalho técnico, científico ou artístico, com prêmio ou remuneração ao vencedor."],
  ["Leilão", "Para vender bens do órgão. Vence quem der o maior lance, desde que acima do valor mínimo de avaliação."],
  ["Diálogo competitivo", "Para objetos inovadores ou complexos: o órgão conversa com os licitantes para definir a melhor solução e só depois pede propostas."],
  ["Dispensa", "Contratação direta em casos que a lei lista, como valores pequenos, emergência ou licitação sem interessados. Muitas dispensas abrem prazo para propostas, por isso aparecem aqui."],
  ["Inexigibilidade", "Contratação direta quando competir é inviável, por exemplo fornecedor exclusivo ou serviço técnico singular."],
  ["Credenciamento", "Procedimento em que o órgão habilita todos os interessados que cumprirem as regras, sem disputa de preço, para prestar o serviço quando for chamado."],
];

const JULGAMENTO = [
  ["Menor preço", "Ganha a proposta mais barata que cumpre o edital."],
  ["Maior desconto", "Ganha quem oferecer o maior desconto sobre uma tabela ou valor de referência."],
  ["Técnica e preço", "A nota técnica e o preço entram juntos, com pesos definidos no edital."],
  ["Melhor técnica ou conteúdo artístico", "O preço é fixo e vence a melhor qualidade técnica ou artística."],
  ["Maior lance", "Usado no leilão: ganha quem pagar mais."],
  ["Maior retorno econômico", "Usado em contratos que geram economia ao órgão; a remuneração vem de parte dessa economia."],
];

const HABILITACAO = [
  ["Jurídica", "Mostra que a empresa existe e quem a representa: contrato social ou estatuto, registro e documentos dos sócios."],
  ["Fiscal, social e trabalhista", "Regularidade com tributos federais, estaduais e municipais, com o FGTS e com a Justiça do Trabalho (as certidões negativas)."],
  ["Econômico-financeira", "Capacidade de bancar o contrato: balanço patrimonial, índices contábeis e certidão de falência ou recuperação judicial."],
  ["Técnica", "Experiência comprovada: atestados de capacidade técnica, registro em conselho profissional e, às vezes, equipe e equipamentos."],
  ["Declarações", "Declarações de que a empresa cumpre exigências legais, como a de não empregar menores em trabalho proibido."],
];

const GLOSSARIO = [
  ["PNCP", "Portal Nacional de Contratações Públicas, onde os órgãos publicam editais, atas e contratos. É de lá que o LS Busca tira os dados."],
  ["Edital", "O documento que fixa todas as regras da licitação: objeto, prazos, exigências, critério de julgamento e minuta do contrato."],
  ["Termo de referência", "Anexo do edital que descreve com precisão o que o órgão quer comprar ou contratar."],
  ["Esclarecimento e impugnação", "Esclarecimento tira dúvidas sobre o edital; impugnação pede a correção de uma exigência que a empresa considera irregular."],
  ["Modo de disputa", "Como os lances acontecem: aberto (lances públicos e sucessivos), fechado (proposta única e sigilosa) ou combinação dos dois."],
  ["SRP e ata de registro de preços", "O Sistema de Registro de Preços registra os preços numa ata para compras futuras, sem obrigar o órgão a comprar tudo de uma vez."],
  ["Carona", "Quando outro órgão aproveita uma ata de registro de preços que não foi dele, dentro dos limites da lei."],
  ["Adjudicação e homologação", "Adjudicar é entregar o objeto ao vencedor; homologar é a autoridade confirmar que o processo foi regular."],
  ["Recurso", "Pedido para rever uma decisão, como a classificação ou a habilitação de um concorrente. Tem prazo curto."],
  ["Amparo legal", "O artigo da lei que fundamenta aquela contratação, principalmente nas contratações diretas."],
];

const PERGUNTAS = [
  ["De onde vêm as licitações?", "Do PNCP, o portal oficial. O sistema consulta o portal enquanto está aberto e mostra as licitações com proposta em aberto. Confira sempre o edital no site do órgão ou da plataforma de disputa."],
  ["Preciso de certificado digital?", "Em geral sim para assinar propostas e contratos, e muitas plataformas de disputa pedem cadastro prévio. O edital diz qual plataforma e quais requisitos valem para aquela licitação."],
  ["Até quando posso impugnar o edital?", "A Lei 14.133 permite impugnar até três dias úteis antes da data de abertura da sessão. Passado o prazo, ainda é possível pedir esclarecimentos, mas a impugnação perde o efeito."],
  ["O valor estimado é o que vou receber?", "Não. É o valor de referência que o órgão calculou. O contrato sai pelo valor da proposta vencedora, que costuma ser menor."],
  ["O que o LS Busca não faz?", "Ele não participa da disputa por você nem substitui a leitura do edital. As páginas de ajuda são um resumo informativo; para dúvidas jurídicas, consulte um profissional."],
];

function Bloco({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3 rounded-lg border border-line bg-bg p-4">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Definicoes({ itens }: { itens: string[][] }) {
  return (
    <dl className="flex flex-col divide-y divide-line rounded-md border border-line">
      {itens.map(([termo, texto]) => (
        <div key={termo} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-4">
          <dt className="shrink-0 text-sm font-semibold text-ink sm:w-52">{termo}</dt>
          <dd className="text-sm text-muted">{texto}</dd>
        </div>
      ))}
    </dl>
  );
}

const LINK = "font-semibold text-accent hover:underline";

export default function PaginaAjuda() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Ajuda</h1>
        <p className="text-sm text-muted">
          Como usar o sistema e um guia rápido das licitações pela Lei 14.133/2021 (a Nova Lei de Licitações e Contratos).
        </p>
      </header>

      <nav aria-label="Nesta página" className="flex flex-wrap gap-2">
        {SECOES.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink hover:border-accent">
            {s.titulo}
          </a>
        ))}
      </nav>

      <Bloco id="usar" titulo="Como usar o LS Busca">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
          <li>
            Diga o que a empresa vende em <Link href="/inicio/ramo" className={LINK}>Ramo da empresa</Link>. Com isso o sistema mede o quanto cada
            licitação combina com você.
          </li>
          <li>
            Veja o que combina em <Link href="/para-voce" className={LINK}>Para sua empresa</Link> e em <Link href="/inicio" className={LINK}>Início</Link>.
          </li>
          <li>
            Procure por assunto, órgão, número de processo ou CNPJ em <Link href="/buscar" className={LINK}>Buscar</Link>. De qualquer tela, <kbd className="rounded-sm border border-line px-1 text-xs">Ctrl K</kbd> abre
            a busca rápida. O filtro “Aderência ao ramo” deixa só as melhores.
          </li>
          <li>
            Gostou de uma licitação? Clique em <strong>Acompanhar</strong>. Ela entra no <Link href="/funil" className={LINK}>Funil</Link> e seus prazos aparecem em{" "}
            <Link href="/funil/prazos" className={LINK}>Prazos</Link> e no calendário do Início.
          </li>
          <li>
            Salve uma busca como alerta para ver, em <Link href="/alertas" className={LINK}>Alertas</Link> e no sino, o que entrou de novo.
          </li>
          <li>
            Cadastre as certidões em <Link href="/documentos" className={LINK}>Documentos</Link> para ser avisado antes de vencerem.
          </li>
        </ol>
        <p className="text-xs text-muted">
          Se o contraste ou o tamanho da letra atrapalhar, o botão de ajustes de leitura, no alto da tela, liga alto contraste e texto grande.
        </p>
      </Bloco>

      <Bloco id="caminho" titulo="Do edital ao contrato">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
          <li><strong>Achar a oportunidade.</strong> Use os filtros de UF, modalidade, valor e prazo.</li>
          <li><strong>Ler o edital e os anexos.</strong> Objeto, quantidades, prazos, local de entrega e exigências. A maioria das desclassificações vem de exigência não cumprida.</li>
          <li><strong>Conferir a habilitação.</strong> Veja se a empresa tem todos os documentos válidos.</li>
          <li><strong>Cadastrar-se na plataforma de disputa</strong> indicada no edital e enviar a proposta antes do horário de encerramento. Depois dele não há como enviar.</li>
          <li><strong>Participar da sessão.</strong> Acompanhe os lances e fique atento às convocações para enviar documentos ou amostras.</li>
          <li><strong>Habilitação, recursos e homologação.</strong> O vencedor tem os documentos analisados; os demais podem recorrer nos prazos do edital.</li>
          <li><strong>Contrato ou ata.</strong> Cumpridas as etapas, assina-se o contrato ou a ata de registro de preços.</li>
        </ol>
      </Bloco>

      <Bloco id="modalidades" titulo="Modalidades">
        <Definicoes itens={MODALIDADES} />
      </Bloco>

      <Bloco id="julgamento" titulo="Como se escolhe o vencedor">
        <p className="text-sm text-muted">O edital diz qual critério vale. Os principais:</p>
        <Definicoes itens={JULGAMENTO} />
      </Bloco>

      <Bloco id="habilitacao" titulo="Habilitação">
        <p className="text-sm text-muted">
          É a fase em que o órgão confere se a empresa pode contratar. O edital lista o que exige; em geral o conjunto é este:
        </p>
        <Definicoes itens={HABILITACAO} />
        <p className="text-sm text-muted">
          Guarde os dados e as validades em <Link href="/documentos" className={LINK}>Documentos</Link>. Certidão vencida no dia da habilitação é motivo comum de
          perda de uma licitação ganha.
        </p>
      </Bloco>

      <Bloco id="me-epp" titulo="Vantagens de ME e EPP">
        <p className="text-sm text-muted">
          A Lei Complementar 123/2006 dá um tratamento diferenciado a microempresas, empresas de pequeno porte e MEI. Em resumo:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          <li>Empate ficto: a proposta de ME ou EPP até 5% acima da melhor (10% em algumas modalidades) pode cobrir o preço e ficar com o item.</li>
          <li>Regularização fiscal tardia: quem vence mas tem certidão fiscal com pendência ganha um prazo para regularizar.</li>
          <li>Itens de valor de até R$ 80 mil podem ser reservados só para ME e EPP.</li>
          <li>Em compras de bens divisíveis, o edital pode reservar uma cota de até 25% para elas.</li>
        </ul>
        <p className="text-xs text-muted">
          Informe o porte em <Link href="/empresa" className={LINK}>Perfil da empresa</Link>. Os detalhes e as exceções estão na lei e no edital.
        </p>
      </Bloco>

      <Bloco id="glossario" titulo="Glossário">
        <Definicoes itens={GLOSSARIO} />
      </Bloco>

      <Bloco id="perguntas" titulo="Perguntas frequentes">
        <div className="flex flex-col gap-2">
          {PERGUNTAS.map(([pergunta, resposta]) => (
            <details key={pergunta} className="rounded-md border border-line px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-ink">{pergunta}</summary>
              <p className="mt-2 text-sm text-muted">{resposta}</p>
            </details>
          ))}
        </div>
      </Bloco>
    </main>
  );
}
