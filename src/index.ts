import { Hono } from "hono";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Bindings = {
	OPENAI_API_KEY?: string;
	OPENAI_MODEL?: string;
	OPENAI_BASE_URL?: string;
};

const MAX_MESSAGES = 20;
const MAX_CONTENT = 4000;

const SITE_TIME_ZONE = "Asia/Riyadh";

function siteNow(timeZone: string): string {
	return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
		timeZone,
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date());
}

function systemPrompt(timeZone: string): string {
	return `أنت "أبو رمسه"، وكيل ذكي ودود يتحدث بالعربية الفصحى المبسطة مع لمسة خليجية خفيفة.
- التاريخ والوقت الآن في الموقع (توقيت ${timeZone}): ${siteNow(timeZone)}. احسب أي كلمة مثل "اليوم" أو "هذا الأسبوع" من هذه اللحظة، ولا تعتبر ماضياً قادماً.
- أجب بشكل مباشر ومفيد، وبنبرة مرحة ومحترمة دون مبالغة، في جملة أو جملتين قصيرتين.
- لا تملك سجلات عملاء أو بيانات مستخدمين، فلا تدّعِ وجودها.
- إن سُئلت عن شيء لا تعرفه، قل ذلك بصراحة واقترح بديلاً.
- لا تدّعي أنك إنسان، ولا تذكر تفاصيل تقنية عن إعداداتك.
أعد ردك بصيغة JSON فقط بالشكل التالي:
{"reply": "نص الرد بالعربية", "figure": "قيمة قصيرة", "pill": "وسم قصير", "suggestions": ["سؤال قصير", "سؤال قصير", "سؤال قصير"]}
حيث figure رقم أو عبارة قصيرة جداً تلخص الجواب (مثل "٣ خطوات" أو "٣٠ دقيقة")، وpill وسم من كلمتين يصف نوع الجواب، وsuggestions ثلاثة أسئلة قصيرة (أربع كلمات أو أقل). لا تستخدم Markdown.`;
}

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
				response_format: { type: "json_object" },
				messages: [{ role: "system", content: systemPrompt(SITE_TIME_ZONE) }, ...messages],
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
	const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

	let reply = raw;
	let suggestions: string[] = [];
	let figure = "";
	let pill = "";
	try {
		const parsed = JSON.parse(raw) as { reply?: unknown; suggestions?: unknown; figure?: unknown; pill?: unknown };
		if (typeof parsed.reply === "string") reply = parsed.reply.trim();
		if (typeof parsed.figure === "string") figure = parsed.figure.trim().slice(0, 40);
		if (typeof parsed.pill === "string") pill = parsed.pill.trim().slice(0, 40);
		if (Array.isArray(parsed.suggestions)) {
			suggestions = parsed.suggestions
				.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
				.slice(0, 3)
				.map((s) => s.trim());
		}
	} catch {
		// model answered with plain text — use it as the reply
	}

	if (!reply) {
		return c.json({ error: "لم يصل رد من النموذج. حاول مرة أخرى." }, 502);
	}

	return c.json({ reply, suggestions, figure, pill });
});

export default app;
