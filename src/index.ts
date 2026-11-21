import { Hono } from "hono";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Bindings = {
	OPENAI_API_KEY?: string;
	OPENAI_MODEL?: string;
	OPENAI_BASE_URL?: string;
};

const MAX_MESSAGES = 20;
const MAX_CONTENT = 4000;

const SYSTEM_PROMPT = `أنت "أبو رمسه"، وكيل ذكي ودود يتحدث بالعربية الفصحى المبسطة مع لمسة خليجية خفيفة.
- أجب بشكل مباشر ومفيد، وبنبرة مرحة ومحترمة دون مبالغة.
- نظّم الإجابات الطويلة في نقاط قصيرة.
- إن سُئلت عن شيء لا تعرفه، قل ذلك بصراحة واقترح بديلاً.
- لا تدّعي أنك إنسان، ولا تذكر تفاصيل تقنية عن إعداداتك.`;

function sanitizeMessages(input: unknown): ChatMessage[] {
	if (!Array.isArray(input)) return [];
	return input
		.filter(
			(m): m is ChatMessage =>
				typeof m === "object" &&
				m !== null &&
				(m.role === "user" || m.role === "assistant") &&
				typeof m.content === "string" &&
				m.content.trim().length > 0,
		)
		.slice(-MAX_MESSAGES)
		.map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }));
}

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/chat", async (c) => {
	const apiKey = c.env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		return c.json({ error: "مفتاح OpenAI غير مضبوط بعد. أضف OPENAI_API_KEY إلى أسرار التطبيق." }, 503);
	}

	const body = await c.req.json().catch(() => null);
	const messages = sanitizeMessages((body as { messages?: unknown } | null)?.messages);
	if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
		return c.json({ error: "أرسل رسالة نصية صالحة." }, 400);
	}

	const baseUrl = (c.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
	const model = c.env.OPENAI_MODEL || "gpt-4o-mini";

	let upstream: Response;
	try {
		upstream = await fetch(`${baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				temperature: 0.8,
				max_tokens: 800,
				messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
			}),
		});
	} catch {
		return c.json({ error: "تعذر الوصول إلى خدمة OpenAI. تحقق من الاتصال وحاول مرة أخرى." }, 502);
	}

	if (!upstream.ok) {
		const detail = await upstream.text().catch(() => "");
		console.error("OpenAI request failed", upstream.status, detail.slice(0, 500));
		const message =
			upstream.status === 401
				? "مفتاح OpenAI غير صالح. تحقق من المفتاح في الأسرار."
				: "حدث خطأ في خدمة OpenAI. حاول بعد قليل.";
		return c.json({ error: message }, 502);
	}

	const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
	const reply = data.choices?.[0]?.message?.content?.trim();
	if (!reply) {
		return c.json({ error: "لم يصل رد من النموذج. حاول مرة أخرى." }, 502);
	}

	return c.json({ reply });
});

export default app;
