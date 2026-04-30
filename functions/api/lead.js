// Cloudflare Pages Function — endpoint POST /api/lead
//
// Recebe o submit do chat da LP e dispara em paralelo:
//   1. Append no Google Sheet (via Apps Script Web App URL — env: SHEETS_WEBHOOK_URL)
//   2. Pipedrive: cria Organization → Person → Deal (no funil PIPEDRIVE_PIPELINE_ID,
//      com label PIPEDRIVE_LABEL_ID) → Note pinned no deal com tudo que o lead preencheu
//
// Env vars necessárias (Cloudflare Pages → Settings → Environment variables):
//   PIPEDRIVE_API_TOKEN     — token da API do Pipedrive (NÃO commitar)
//   PIPEDRIVE_PIPELINE_ID   — ID do funil Orbit (default: 35)
//   PIPEDRIVE_LABEL_ID      — ID(s) da etiqueta "Orbit Canal" (CSV se múltiplas: "1,2")
//   SHEETS_WEBHOOK_URL      — URL do Apps Script Web App (ver docs/apps-script-sheet.js)

const HIGH_REVENUE  = ['R$100k-R$500k/mês', 'R$500k-R$1mi/mês', 'Acima de R$1mi/mês'];
const HIGH_PRIORITY = ['Urgente', '30 dias'];

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

function normalize(body) {
  const faturamento = String(body.faturamento || '');
  const prioridade  = String(body.prioridade  || '');
  const hasRevenue  = HIGH_REVENUE.includes(faturamento);
  const hasPriority = HIGH_PRIORITY.includes(prioridade);

  let score = 'Cold';
  if (hasRevenue && hasPriority) score = 'Hot';
  else if (hasRevenue || hasPriority) score = 'Warm';

  return {
    timestamp:    new Date().toISOString(),
    name:         String(body.name || '').trim(),
    email:        String(body.email || '').trim().toLowerCase(),
    phone:        onlyDigits(body.phone),
    empresa:      String(body.empresa || '').trim(),
    cargo:        String(body.cargo || ''),
    atuacao:      String(body.atuacao || ''),
    faturamento,
    projetos:     String(body.projetos || ''),
    prioridade,
    variant:      String(body.variant || ''),
    segment:      String(body.segment || ''),
    page_url:     String(body.page_url || ''),
    score,
    utm_source:   String(body.utm_source   || ''),
    utm_medium:   String(body.utm_medium   || ''),
    utm_campaign: String(body.utm_campaign || ''),
    utm_content:  String(body.utm_content  || ''),
    utm_term:     String(body.utm_term     || ''),
    gclid:        String(body.gclid  || ''),
    fbclid:       String(body.fbclid || ''),
    ttclid:       String(body.ttclid || ''),
    msclkid:      String(body.msclkid || ''),
    session_id:   String(body.session_id   || ''),
    landing_page: String(body.landing_page || ''),
    origin_page:  String(body.origin_page  || ''),
    first_name:   String(body.first_name   || ''),
    last_name:    String(body.last_name    || '')
  };
}

async function appendToSheet(lead, url) {
  if (!url) throw new Error('SHEETS_WEBHOOK_URL not configured');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });
  if (!res.ok) throw new Error(`Sheets HTTP ${res.status}`);
  return { ok: true };
}

async function pdFetch(path, token, init = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://api.pipedrive.com/v1${path}${sep}api_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  let json;
  try { json = await res.json(); } catch (e) { json = null; }
  if (!res.ok || !json || json.success === false) {
    const msg = (json && (json.error || JSON.stringify(json))) || `HTTP ${res.status}`;
    throw new Error(`Pipedrive ${path}: ${msg}`);
  }
  return json;
}

function formatNote(lead) {
  return [
    '<b>Lead capturado pela LP Orbit Canal</b>',
    '',
    `<b>Score:</b> ${lead.score}`,
    '',
    '<b>Contato</b>',
    `Nome: ${lead.name || '—'}`,
    `Email: ${lead.email || '—'}`,
    `Telefone: ${lead.phone || '—'}`,
    '',
    '<b>Empresa</b>',
    `Empresa: ${lead.empresa || '—'}`,
    `Cargo: ${lead.cargo || '—'}`,
    `Atuação: ${lead.atuacao || '—'}`,
    `Faturamento: ${lead.faturamento || '—'}`,
    `Projetos atuais: ${lead.projetos || '—'}`,
    `Prioridade: ${lead.prioridade || '—'}`,
    '',
    '<b>A/B + Segmento</b>',
    `Variant: ${lead.variant || '—'}`,
    `Segmento: ${lead.segment || 'direto'}`,
    '',
    '<b>Atribuição</b>',
    `UTM source: ${lead.utm_source || '—'}`,
    `UTM medium: ${lead.utm_medium || '—'}`,
    `UTM campaign: ${lead.utm_campaign || '—'}`,
    `UTM content: ${lead.utm_content || '—'}`,
    `UTM term: ${lead.utm_term || '—'}`,
    `gclid: ${lead.gclid || '—'}`,
    `fbclid: ${lead.fbclid || '—'}`,
    `Landing page: ${lead.landing_page || '—'}`,
    `Origin page: ${lead.origin_page || '—'}`,
    '',
    '<b>Sessão</b>',
    `Session ID: ${lead.session_id || '—'}`,
    `Page URL: ${lead.page_url || '—'}`,
    `Capturado em: ${lead.timestamp}`,
  ].join('<br>');
}

async function createInPipedrive(lead, env) {
  const token = env.PIPEDRIVE_API_TOKEN;
  if (!token) throw new Error('PIPEDRIVE_API_TOKEN not configured');

  const pipelineId = parseInt(env.PIPEDRIVE_PIPELINE_ID || '35', 10);
  const labelIdsCsv = env.PIPEDRIVE_LABEL_ID || '';
  const labelIds = labelIdsCsv
    .split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);

  // 1. Organization
  const orgName = lead.empresa || `${lead.name || 'Lead'} — sem empresa informada`;
  const orgRes = await pdFetch('/organizations', token, {
    method: 'POST',
    body: JSON.stringify({ name: orgName }),
  });
  const orgId = orgRes.data && orgRes.data.id;

  // 2. Person
  const personBody = { name: lead.name || lead.email || 'Lead sem nome' };
  if (orgId) personBody.org_id = orgId;
  if (lead.email) personBody.email = [{ value: lead.email, primary: true, label: 'work' }];
  if (lead.phone) personBody.phone = [{ value: lead.phone, primary: true, label: 'work' }];

  const personRes = await pdFetch('/persons', token, {
    method: 'POST',
    body: JSON.stringify(personBody),
  });
  const personId = personRes.data && personRes.data.id;

  // 3. Deal
  const dealTitle = `Orbit Canal — ${lead.name || 'Lead'}${lead.empresa ? ' · ' + lead.empresa : ''}`;
  const dealBody = { title: dealTitle, pipeline_id: pipelineId };
  if (personId) dealBody.person_id = personId;
  if (orgId)    dealBody.org_id = orgId;
  // Pipedrive v1: contas antigas usam `label` (singular, integer);
  // contas com multi-label usam `label_ids` (array). Tentamos label
  // primeiro pois é a forma mais compatível.
  if (labelIds.length === 1) dealBody.label = labelIds[0];
  else if (labelIds.length > 1) dealBody.label_ids = labelIds;

  const dealRes = await pdFetch('/deals', token, {
    method: 'POST',
    body: JSON.stringify(dealBody),
  });
  const dealId = dealRes.data && dealRes.data.id;

  // 4. Note pinned no deal
  const noteBody = {
    content: formatNote(lead),
    pinned_to_deal_flag: 1,
  };
  if (dealId)   noteBody.deal_id = dealId;
  if (personId) noteBody.person_id = personId;
  if (orgId)    noteBody.org_id = orgId;

  await pdFetch('/notes', token, {
    method: 'POST',
    body: JSON.stringify(noteBody),
  });

  return { orgId, personId, dealId };
}

export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight (mesmo domínio em produção, mas útil pra dev)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin':  'https://canal.orbitgestao.com.br',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age':       '86400',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // Honeypot — aceita silenciosamente, não conta o bot que pegou
  if (body.website) {
    return json({ ok: true, dropped: 'honeypot' });
  }

  const lead = normalize(body);

  const [sheetResult, pdResult] = await Promise.allSettled([
    appendToSheet(lead, env.SHEETS_WEBHOOK_URL),
    createInPipedrive(lead, env),
  ]);

  const out = {
    ok: true,
    score: lead.score,
    sheet: sheetResult.status === 'fulfilled'
      ? 'ok'
      : { error: String(sheetResult.reason && sheetResult.reason.message || sheetResult.reason) },
    pipedrive: pdResult.status === 'fulfilled'
      ? pdResult.value
      : { error: String(pdResult.reason && pdResult.reason.message || pdResult.reason) },
  };

  return json(out);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://canal.orbitgestao.com.br',
    },
  });
}
