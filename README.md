# أبو رمسه — وكيل ذكي

تطبيق دردشة عربي (RTL) يعمل على Cloudflare Workers، مع واجهة أمامية ثابتة ومسار خلفي يستدعي OpenAI.

## التشغيل محلياً

```bash
npm install
npx wrangler dev --port 3000
```

## الإعداد

| المتغير | الوصف |
| --- | --- |
| `OPENAI_API_KEY` | مفتاح OpenAI (سرّي — لا يُحفظ في المستودع). |
| `OPENAI_MODEL` | اختياري، الافتراضي `gpt-4o-mini`. |
| `OPENAI_BASE_URL` | اختياري، الافتراضي `https://api.openai.com/v1`. |

محلياً ضع المفتاح في `.dev.vars`:

```
OPENAI_API_KEY=sk-...
```

للنشر: `npx wrangler secret put OPENAI_API_KEY` ثم `npm run deploy`.

## البنية

- `public/` — واجهة الدردشة (`index.html`, `styles.css`, `app.js`).
- `src/index.ts` — مسار `POST /api/chat` الذي يبني المحادثة ويرسلها إلى OpenAI، و`GET /api/health`.
