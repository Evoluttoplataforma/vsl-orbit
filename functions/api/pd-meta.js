// Diagnostic endpoint — GET /api/pd-meta
//
// Lista os campos personalizados (deal + person) e as labels do funil
// configurado, pra descobrir os field keys / label IDs que precisamos
// mapear no /api/lead.
//
// USO:
//   GET https://canal.orbitgestao.com.br/api/pd-meta
//
// Retorna JSON com:
//   - dealFields[]    — só campos custom (com key, name, options)
//   - personFields[]  — só campos custom
//   - dealLabels[]    — labels de deal (id + label + color)
//   - pipeline        — info do pipeline configurado
//
// Remover este arquivo depois que o mapeamento estiver pronto.

async function pdFetch(path, token) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://api.pipedrive.com/v1${path}${sep}api_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    throw new Error(`Pipedrive ${path}: ${(json && json.error) || res.status}`);
  }
  return json;
}

function stripField(f) {
  return {
    key: f.key,
    name: f.name,
    field_type: f.field_type,
    options: f.options ? f.options.map((o) => ({ id: o.id, label: o.label })) : undefined,
  };
}

export async function onRequest(context) {
  const { env } = context;
  const token = env.PIPEDRIVE_API_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'PIPEDRIVE_API_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const pipelineId = parseInt(env.PIPEDRIVE_PIPELINE_ID || '35', 10);

  try {
    const [dealFields, personFields, dealLabels, pipeline] = await Promise.all([
      pdFetch('/dealFields?start=0&limit=500', token),
      pdFetch('/personFields?start=0&limit=500', token),
      pdFetch('/dealFields/find?term=label', token).catch(() => ({ data: [] })),
      pdFetch(`/pipelines/${pipelineId}`, token).catch(() => ({ data: null })),
    ]);

    // Custom fields = aqueles cuja `edit_flag` é true (campos próprios)
    // ou que não estão na lista de campos default. Critério prático:
    // mantemos só os campos onde edit_flag === true.
    const customDeal = (dealFields.data || [])
      .filter((f) => f.edit_flag === true)
      .map(stripField);

    const customPerson = (personFields.data || [])
      .filter((f) => f.edit_flag === true)
      .map(stripField);

    // Labels de deal: vêm como um campo do tipo enum/set chamado "label"
    const labelField = (dealFields.data || []).find((f) => f.key === 'label');
    const labels = labelField && labelField.options
      ? labelField.options.map((o) => ({ id: o.id, label: o.label, color: o.color }))
      : [];

    return new Response(JSON.stringify({
      ok: true,
      pipeline: pipeline.data,
      currentLabelEnv: env.PIPEDRIVE_LABEL_ID || null,
      dealLabels: labels,
      dealCustomFields: customDeal,
      personCustomFields: customPerson,
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
