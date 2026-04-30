// Apps Script — Web App para appendar leads no Google Sheet.
// Substitui o nó "Append to Sheet" do n8n.
//
// SETUP (5min, 1x só):
//   1. Abre o Sheet "Banco VSL Orbit Gestão"
//   2. Extensions → Apps Script
//   3. Apaga o conteúdo padrão e cola TODO esse arquivo
//   4. Clica em 💾 Save (qualquer nome de projeto)
//   5. Deploy → New deployment → ⚙️ → Type: "Web app"
//   6. Configura:
//        Description:    "Orbit LP — append lead"
//        Execute as:     "Me (seu-email)"
//        Who has access: "Anyone"   ← importante, é o webhook URL
//   7. Clica em Deploy → autoriza acesso → copia a "Web app URL"
//      (formato: https://script.google.com/macros/s/AKfy.../exec)
//   8. Cola essa URL como env var no Cloudflare Pages:
//        Workers & Pages → vsl-orbit → Settings → Environment variables
//        Name:  SHEETS_WEBHOOK_URL
//        Value: (cole a URL)
//
// PRA DEBUGAR:
//   - View → Logs no editor do Apps Script
//   - Cada execução fica em: Executions

const SHEET_ID   = '1XcvNpThEypgFh_q93T4oCTY-9_9pQ0kSywzdqQLy2bk';
const SHEET_NAME = 'Página1';

// Ordem das colunas da Página1 — manter sincronizado com o header do Sheet
const COLUMNS = [
  'timestamp', 'name', 'email', 'phone', 'empresa', 'cargo',
  'atuacao', 'faturamento', 'projetos', 'prioridade', 'variant',
  'segment', 'page_url', 'score',
  'utm_campaign', 'utm_content', 'utm_term', 'utm_source'
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" não encontrado');

    const row = COLUMNS.map(function(col) { return data[col] != null ? data[col] : ''; });
    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, score: data.score || null }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err && err.message || err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET para healthcheck (não obrigatório)
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'orbit-lead-sheet' }))
    .setMimeType(ContentService.MimeType.JSON);
}
