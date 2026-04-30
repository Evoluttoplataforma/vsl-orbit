# VSL Orbit — Landing Page

Landing page de captação para `canal.orbitgestao.com.br`, com **teste A/B simultâneo de VSL e copy** (variantes A e B), captura de leads via n8n → Google Sheets, e dashboard interno de acompanhamento.

## Stack

- **HTML estático** + Tailwind CDN (sem build step)
- **Vimeo Player SDK** pra VSLs
- **GTM** (`GTM-W6H3729J`) pra tracking
- **n8n** como middleware de form → Google Sheets
- **Hospedagem**: Cloudflare Pages

## Estrutura

```
.
├── index.html          # LP principal com A/B routing client-side
├── obrigado.html       # Thank-you page (vídeo dinâmico por cargo)
├── dashboard.html      # Dashboard interno (?key=orbit2026)
├── _headers            # Cloudflare Pages — security headers
├── _redirects          # /obrigado, /dashboard
├── brand/
│   ├── favicon.ico
│   ├── logo-orbit-white.png
│   ├── design-system/  # living style guide
│   └── team/           # fotos do time pro card "online agora"
└── docs/
    ├── briefing-operacao.md     # Doc oficial v3 da operação
    ├── briefing-copy.md         # Copy da LP por variante
    ├── design-system-extract.md # Notas de extração das refs
    ├── n8n-workflow.json        # Workflow pra reimportar no n8n
    └── reference/               # HTML originais de referência
```

## A/B Routing

URL: `canal.orbitgestao.com.br?s={1|2|3}&v={a|b}`

- `s` — segmento de origem (1=Power Users Evo, 2=Light Users Evo, 3=Pipedrive)
- `v` — variante A/B; se ausente, sorteia 50/50 e fixa em `localStorage` (sticky por visitante)

| `v` | VSL | Copy | Tom |
|---|---|---|---|
| `a` | Igor + Christian | Dor + Evolução | Empático |
| `b` | Christian solo | Oportunidade + Math | Pragmático |

## Captura de Lead

Form (chat conversacional com a Olívia) → POST → webhook n8n → Google Sheets.

Webhook em produção:
```
https://webhook.rodriguinhodomarketing.com.br/webhook/orbit-lead-vsl
```

O n8n calcula um **score** (Hot / Warm / Cold) cruzando `faturamento` + `prioridade`.

## Dashboard

Acesso: `dashboard.html?key=orbit2026` (ou login com a senha `orbit2026`).

Lê o Sheet via gviz JSON (refresh automático a 60s) e mostra:
- KPIs (Total · Hot · Warm · Cold)
- Comparativo Variant A vs B
- Gráficos: leads por dia · score por variant · top fontes UTM · faixa de faturamento
- Tabela de leads recentes + export CSV
- Filtros: período · variant · score · segmento

## Deploy

Cloudflare Pages com diretório raiz do repo. Sem build step. Custom domain: `canal.orbitgestao.com.br`.

## Ambiente

- **GTM**: `GTM-W6H3729J`
- **Sheet de leads**: `1XcvNpThEypgFh_q93T4oCTY-9_9pQ0kSywzdqQLy2bk`
- **Vimeo IDs**:
  - VSL A (Igor + Christian): `1188088507`
  - VSL B (Christian solo): `1188086372`
  - Obrigado consultor: `1188103539`
  - Obrigado empresário: `1188106890`
- **WhatsApp do time** (Gabriel): `+55 11 97199-9192`
