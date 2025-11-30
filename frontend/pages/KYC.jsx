export default function KYC() {
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submitKYC() {
    setLoading(true);

    const res = await fetch("/api/kyc/verify", {
      method: "POST",
      body: JSON.stringify({
        id_front: front,
        id_back: back,
        selfie,
        user_id: user.id
      })
    });

    const data = await res.json();
    setLoading(false);

    if (data.ok) {
      alert("KYC Verified!");
    } else {
      alert("KYC Failed: " + data.error);
    }
  }

  return (
    <div>
      <h1>KYC Verification</h1>

      <input type="file" onChange={e => fileToBase64(e.target.files[0], setFront)} />
      <input type="file" onChange={e => fileToBase64(e.target.files[0], setBack)} />
      <input type="file" onChange={e => fileToBase64(e.target.files[0], setSelfie)} />

      <button disabled={loading} onClick={submitKYC}>
        {loading ? "Verifying..." : "Submit KYC"}
      </button>
    </div>
  );
}

function fileToBase64(file, cb) {
  const reader = new FileReader();
  reader.onload = e => cb(e.target.result.split(",")[1]);
  reader.readAsDataURL(file);
}