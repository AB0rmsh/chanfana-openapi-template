const chat = document.getElementById("chat");
const welcome = document.getElementById("welcome");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const resetBtn = document.getElementById("reset");

/** @type {{role: "user"|"assistant", content: string}[]} */
let history = [];
let busy = false;

function autoGrow() {
	input.style.height = "auto";
	input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

function scrollToEnd() {
	chat.scrollTop = chat.scrollHeight;
}

function addMessage(role, text) {
	welcome?.remove();

	const row = document.createElement("div");
	row.className = `msg ${role}`;

	const avatar = document.createElement("div");
	avatar.className = "mini-avatar";
	avatar.textContent = role === "user" ? "أنت" : "أر";
	avatar.setAttribute("aria-hidden", "true");

	const bubble = document.createElement("div");
	bubble.className = "bubble";
	bubble.textContent = text;

	row.append(avatar, bubble);
	chat.appendChild(row);
	scrollToEnd();
	return row;
}

function showTyping() {
	const row = addMessage("assistant", "");
	row.dataset.typing = "true";
	const bubble = row.querySelector(".bubble");
	bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
	return row;
}

function setBusy(value) {
	busy = value;
	sendBtn.disabled = value;
	input.setAttribute("aria-busy", String(value));
}

async function send(text) {
	const message = text.trim();
	if (!message || busy) return;

	addMessage("user", message);
	history.push({ role: "user", content: message });
	input.value = "";
	autoGrow();
	setBusy(true);
	const typingRow = showTyping();

	try {
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ messages: history }),
		});
		const data = await response.json().catch(() => ({}));
		typingRow.remove();

		if (!response.ok || !data.reply) {
			history.pop();
			addMessage("error", data.error || "تعذر الحصول على رد. حاول مرة أخرى.");
		} else {
			history.push({ role: "assistant", content: data.reply });
			addMessage("assistant", data.reply);
		}
	} catch {
		typingRow.remove();
		history.pop();
		addMessage("error", "تعذر الاتصال بالخدمة. تحقق من اتصالك وحاول مرة أخرى.");
	} finally {
		setBusy(false);
		input.focus();
	}
}

form.addEventListener("submit", (event) => {
	event.preventDefault();
	send(input.value);
});

input.addEventListener("input", autoGrow);
input.addEventListener("keydown", (event) => {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		send(input.value);
	}
});

document.querySelectorAll(".chip").forEach((chip) => {
	chip.addEventListener("click", () => send(chip.dataset.prompt || ""));
});

resetBtn.addEventListener("click", () => {
	history = [];
	chat.innerHTML = "";
	const fresh = welcome?.cloneNode(true);
	if (fresh) {
		chat.appendChild(fresh);
		fresh.querySelectorAll(".chip").forEach((chip) => {
			chip.addEventListener("click", () => send(chip.dataset.prompt || ""));
		});
	}
	input.value = "";
	autoGrow();
	input.focus();
});

input.focus();
