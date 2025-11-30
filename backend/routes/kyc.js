import { verifyKYCWithGemini } from "../kyc/gemini";

export async function handleKYC(req, env) {
  const body = await req.json();
  const { id_front, id_back, selfie, user_id } = body;

  const result = await verifyKYCWithGemini(id_front, id_back, selfie);

  if (!result.valid) {
    return Response.json({ ok: false, error: "KYC failed" }, { status: 400 });
  }

  // Extract OCR name match
  const extractedName = extractName(result.ocr);

  await env.DB.prepare(`
    UPDATE users SET 
      kyc_status = 'verified',
      legal_name = ?,
      can_change_name = 0 
    WHERE id = ?
  `).bind(extractedName, user_id).run();

  return Response.json({ ok: true, verified: true });
}

function extractName(ocrData) {
  // Simplified extraction
  const text = JSON.stringify(ocrData).toUpperCase();
  const match = text.match(/NAME[:\\s]+([A-Z\\s]+)/);
  return match ? match[1].trim() : "UNKNOWN";
}