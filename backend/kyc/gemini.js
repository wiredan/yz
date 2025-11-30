// Gemini AI KYC Verification Module
// Handles ID document validation + face match + name extraction

export async function verifyWithGemini(id_document, selfie) {
  //
  // id_document: Base64 image string
  // selfie: Base64 selfie string
  //

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return {
      verified: false,
      message: "Gemini API key missing",
    };
  }

  try {
    // -------- 1. Send ID + Selfie to Gemini Vision API --------
    const response = await fetch(
      "https://api.google.com/v1/gemini/face-verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GEMINI_API_KEY}`,
        },
        body: JSON.stringify({
          id_image: id_document,
          selfie_image: selfie,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      return {
        verified: false,
        message: "Gemini rejected the document",
      };
    }

    // -------- 2. Check face-match score --------
    if (result.face_match_score < 0.88) {
      return {
        verified: false,
        message: "Face does not match the ID document",
      };
    }

    // -------- 3. Extract legal name from ID --------
    const legal_name = result?.id_extracted_name || "Unknown";

    // -------- 4. Return verification result --------
    return {
      verified: true,
      legal_name,
      score: result.face_match_score,
    };
  } catch (err) {
    return {
      verified: false,
      message: "Gemini verification failed",
      error: err.message,
    };
  }
}