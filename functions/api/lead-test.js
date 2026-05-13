// Diagnostic endpoint — GET /api/lead-test
//
// Simula um submit de form com dados fake e retorna o JSON completo
// de cada estágio (Sheets, Pipedrive Org/Person/Deal/Custom Fields/Note).
// Usado pra ver exatamente qual estágio está falhando sem precisar
// abrir o DevTools.
//
// USO: https://canal.orbitgestao.com.br/api/lead-test
//
// Remover depois que tudo estiver OK.

export async function onRequest(context) {
  const { request, env } = context;
  const origin = new URL(request.url).origin;

  const fakeLead = {
    name: 'TESTE Diagnostic',
    email: `teste-${Date.now()}@orbit-test.com`,
    phone: '11999998888',
    empresa: 'TESTE Empresa Diagnóstica',
    cargo: 'CEO/Diretor',
    atuacao: 'TESTE',
    faturamento: 'Acima de R$1mi/mês',
    projetos: '11 a 30',
    prioridade: 'Urgente',
    variant: 'a',
    segment: '1',
    page_url: origin + '/?test=1',
    utm_source: 'lead-test',
    utm_medium: 'diagnostic',
    utm_campaign: 'lead-test-' + Date.now(),
    session_id: 'test-session-' + Date.now(),
    landing_page: origin + '/',
    origin_page: origin + '/',
    first_name: 'TESTE',
    last_name: 'Diagnostic',
  };

  // Chama o próprio /api/lead pra reproduzir exatamente o fluxo real
  let leadResponse = null;
  let leadStatus = null;
  let leadError = null;
  try {
    const res = await fetch(origin + '/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fakeLead),
    });
    leadStatus = res.status;
    leadResponse = await res.json().catch(() => null);
  } catch (e) {
    leadError = String(e.message || e);
  }

  // Env vars (sem expor tokens — só presença)
  const envCheck = {
    PIPEDRIVE_API_TOKEN: env.PIPEDRIVE_API_TOKEN ? `present (${env.PIPEDRIVE_API_TOKEN.length} chars)` : 'MISSING',
    PIPEDRIVE_PIPELINE_ID: env.PIPEDRIVE_PIPELINE_ID || 'default(35)',
    PIPEDRIVE_LABEL_ID: env.PIPEDRIVE_LABEL_ID || 'MISSING',
    SHEETS_WEBHOOK_URL: env.SHEETS_WEBHOOK_URL ? `present (${env.SHEETS_WEBHOOK_URL.length} chars)` : 'MISSING',
  };

  return new Response(JSON.stringify({
    envCheck,
    leadStatus,
    leadError,
    leadResponse,
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
