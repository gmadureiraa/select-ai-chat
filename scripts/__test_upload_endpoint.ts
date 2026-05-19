// Testa /api/upload direto com FormData (sem auth = espera 401)
const buf = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
  "1f15c4890000000d49444154789c63f8ffff3f0005fe02fe707d3d4e0000000049454e44ae426082",
  "hex"
);
const form = new FormData();
form.append("file", new Blob([buf], { type: "image/png" }), "ChatGPT Image 19 de mai. de 2026, 10_28_37.png");
form.append("path", "planning-media/planning/test-client");

console.log("--- POST sem auth (espera 401) ---");
const r1 = await fetch("https://kai.kaleidos.com.br/api/upload", { method: "POST", body: form });
console.log("status:", r1.status, "body:", await r1.text());

console.log("\n--- POST com auth fake (espera 401) ---");
const r2 = await fetch("https://kai.kaleidos.com.br/api/upload", {
  method: "POST", body: form, headers: { authorization: "Bearer fake" },
});
console.log("status:", r2.status, "body:", await r2.text());

console.log("\n--- POST sem multipart (espera 401 antes) ---");
const r3 = await fetch("https://kai.kaleidos.com.br/api/upload", {
  method: "POST", body: "raw", headers: { "content-type": "image/png" },
});
console.log("status:", r3.status, "body:", await r3.text());
