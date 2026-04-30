# Setup — Pages Function + Pipedrive + Apps Script

Substitui o n8n. Form da LP → Cloudflare Pages Function `/api/lead` →
em paralelo:
1. Append no Sheet (via Apps Script Web App)
2. Pipedrive: Organization → Person → Deal → Note

Setup é único — depois disso tudo roda automático em cada lead.

---

## 1. Rotacionar a API key do Pipedrive (urgente)

A key foi compartilhada em chat e o repo é público. Vai em:

**Pipedrive → Configurações → Pessoal → API → Gerar nova chave**

Anota a chave nova **só pra você**. Não cola em chat, não commita.

---

## 2. Criar a etiqueta no Pipedrive

**Pipedrive → Configurações → Customizações → Campos personalizados → Deals → Label**

Adiciona uma opção **"Orbit Canal"**, salva. Depois:

**a)** Abre qualquer Deal → clica no menu Label → vê a etiqueta listada → inspeciona o HTML pra pegar o ID, OU

**b)** Mais fácil: chama a API:
```
curl "https://api.pipedrive.com/v1/dealFields?api_token=SUA_CHAVE_NOVA" | jq '.data[] | select(.key=="label")'
```
Procura o array `options` na resposta — o ID da opção "Orbit Canal" é o que vamos usar.

Anota esse ID (número, tipo `42`).

---

## 3. Apps Script para o Sheet

(Substitui o que o n8n fazia: append linha no Sheet a cada lead.)

1. Abre o Sheet **"Banco VSL Orbit Gestão"**
2. **Extensions → Apps Script**
3. Apaga o `function myFunction()` padrão
4. Cola **todo o conteúdo de `docs/apps-script-sheet.js`** (do repo)
5. 💾 Save (nome do projeto: "Orbit Sheet Webhook" ou qualquer)
6. **Deploy → New deployment → ⚙️ Select type → Web app**
7. Preenche:
   - **Description:** `Orbit LP — append lead`
   - **Execute as:** `Me (seu-email@gmail.com)`
   - **Who has access:** **`Anyone`** ← obrigatório, é o webhook
8. **Deploy** → autoriza o acesso → **copia a Web app URL**
   (formato: `https://script.google.com/macros/s/AKfy.../exec`)

Anota essa URL.

---

## 4. Env vars no Cloudflare Pages

**Cloudflare Dashboard → Workers & Pages → vsl-orbit → Settings → Environment variables**

Adiciona em **Production** (e Preview se quiser):

| Variable name             | Value                                                |
|---------------------------|------------------------------------------------------|
| `PIPEDRIVE_API_TOKEN`     | (chave nova do passo 1)                              |
| `PIPEDRIVE_PIPELINE_ID`   | `35`                                                 |
| `PIPEDRIVE_LABEL_ID`      | (ID da etiqueta do passo 2 — só o número)            |
| `SHEETS_WEBHOOK_URL`      | (URL do Apps Script do passo 3)                      |

**Marca `PIPEDRIVE_API_TOKEN` como "Encrypt"** (cadeado) — fica encriptado, não aparece nos logs.

Save → Cloudflare faz redeploy automático em ~30s.

---

## 5. Teste end-to-end

Aba anônima → `https://canal.orbitgestao.com.br`:
- Preenche o chat até o final
- Cai no `/obrigado`

**Confere em 3 lugares:**

**a) Pipedrive:**
- Funil "Orbit" (35) — deal novo aparece com título `Orbit Canal — {nome} · {empresa}`
- Etiqueta "Orbit Canal" no deal
- Person vinculada ao deal com email + phone
- Org com nome da empresa
- Note pinned no deal com TODOS os campos do lead

**b) Sheet:**
- Linha nova com 18 colunas preenchidas

**c) GTM Preview:**
- `custom_page_view` no load
- `form_submit` quando o chat finaliza (1x só)
- `form_submit_success` depois (HTTP 200 do `/api/lead`)
- SE aparecer `form_submit_error` → algo deu errado

**Pra debugar:**
- Cloudflare Pages → vsl-orbit → **Functions** → vê os logs da `/api/lead` (cada request fica gravado com a resposta JSON)
- A resposta tem `{ sheet: "ok", pipedrive: {orgId, personId, dealId} }` se tudo deu certo, ou `{ sheet: {error: "..."}, pipedrive: {error: "..."} }` se falhar

---

## Desligar o n8n

Depois que o teste passar, no n8n você pode:
- Desativar o workflow (toggle off no canto superior)
- OU manter ativo como backup (não custa, mas pode duplicar leads se ainda houver alguma página apontando pra lá)

A LP já não aponta mais pro webhook do n8n — só pro `/api/lead`.

---

## Troubleshooting

- **`form_submit_error` no GTM** → abre Network do browser, vê o response do `/api/lead`. Se vier `{ pipedrive: { error: "..." } }`, é problema na config do Pipedrive (token errado, label_id inválido, pipeline 35 não existe).
- **Sheet não atualiza** → testa o Apps Script direto: cola a URL no browser (vai mostrar `{"ok":true,"service":"orbit-lead-sheet"}` se o GET funcionar). Se der erro, redeployar com permissões ok.
- **Deal aparece mas sem label** → confirma que `PIPEDRIVE_LABEL_ID` é o ID NUMÉRICO da option, não da label inteira. Se houver várias labels, separa por vírgula: `42,57`.
- **Pipedrive duplica orgs** → de propósito, cada lead cria org nova. Pra dedupe, configura regra no Pipedrive (Settings → Duplicate detection).
