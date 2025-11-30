export async function verifyKYCWithGemini(idFront, idBack, selfie) {
  const payload = {
    requests: [
      {
        image: { content: idFront },
        features: [{ type: "TEXT_DETECTION" }, { type: "DOCUMENT_DETECTION" }]
      },
      {
        image: { content: idBack },
        features: [{ type: "TEXT_DETECTION" }]
      },
      {
        image: { content: selfie },
        features: [{ type: "FACE_DETECTION" }]
      }
    ]
  };

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=" + GEMINI_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  return {
    ocr: data.responses,
    valid: !data.error,
    details: data
  };
}