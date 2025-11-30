import { handleKYC } from "./routes/kyc";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/api/kyc/verify") {
      return handleKYC(req, env);
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  }
}