import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --- Helper: Create temporary Puter account ---
async function createTempAccount() {
  const url = "https://puter.com/signup";
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0",
    "Origin": "http://localhost",
    "Referer": "http://localhost"
  };

  const response = await axios.post(url, { is_temp: true }, { headers });
  return response.data.token;
}

// --- Helper: Get User App Token ---
async function getAppToken(authToken) {
  const url = "https://api.puter.com/auth/get-user-app-token";
  const headers = {
    Authorization: `Bearer ${authToken}`,
    "Content-Type": "application/json",
    Origin: "http://localhost"
  };
  const response = await axios.post(url, { origin: "http://localhost" }, { headers });
  return response.data.token;
}

// --- Helper: Generate image ---
async function generateImage(appToken, prompt) {
  const url = "https://api.puter.com/drivers/call";
  const payload = {
    interface: "puter-txt2img",
    driver: "together-ai",
    test_mode: false,
    method: "txt2img",
    args: {
      prompt,
      model: "google/gemini-3-pro-image",
      disable_safety_checker: true
    }
  };

  const headers = {
    Authorization: `Bearer ${appToken}`,
    "Content-Type": "application/json",
    Origin: "http://localhost"
  };

  const response = await axios.post(url, payload, { headers });
  if (response.data.success) {
    return response.data.result.src; // base64 or URL
  } else {
    throw new Error(JSON.stringify(response.data));
  }
}

// --- API Route ---
app.get("/generate", async (req, res) => {
  try {
    const prompt = req.query.prompt || "A futuristic cyberpunk city, neon, 4k";

    // 1. Get temp account
    const token = await createTempAccount();

    // 2. Get app token
    const appToken = await getAppToken(token);

    // 3. Generate image
    const imgSrc = await generateImage(appToken, prompt);

    // 4. If base64, convert to buffer
    if (imgSrc.startsWith("data:image")) {
      const base64Data = imgSrc.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      res.setHeader("Content-Type", "image/png");
      return res.send(buffer);
    }

    // 5. If URL, proxy it
    const imgResp = await axios.get(imgSrc, { responseType: "arraybuffer" });
    res.setHeader("Content-Type", "image/png");
    res.send(imgResp.data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Start Server ---
app.listen(PORT, () => console.log(`🚀 Puter API running on port ${PORT}`));
