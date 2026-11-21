(function () {
	var root = document.querySelector("[data-cbw2]");
	if (!root) return;

	var win = root.querySelector("[data-cbw2-window]");
	var launcher = root.querySelector("[data-cbw2-launcher]");
	var form = root.querySelector("[data-cbw2-form]");
	var input = root.querySelector("[data-cbw2-input]");
	var sendBtn = root.querySelector("[data-cbw2-send]");
	var log = root.querySelector("[data-cbw2-log]");
	var chipsBox = root.querySelector("[data-cbw2-chips]");
	var avatar = root.querySelector(".cbw2-avatar");
	var avatarSvg = avatar.querySelector("svg");

	var history = [];
	var busy = false;
	var lastChips = [];

	/* chips that name a real page/action open it instead of being sent as a message */
	var ACTIONS = {
		"المحادثة الكاملة": function () {
			setOpen(false, true);
			var mainInput = document.getElementById("input");
			if (mainInput) mainInput.focus({ preventScroll: false });
		},
	};

	var START_CHIPS = ["وش تقدر تسوي؟", "أعطني فكرة مشروع", "علّمني كلمة جديدة"];

	/* ---------- open / close with a pixel dissolve ---------- */
	var PX = 19;
	var pxRun = 0;
	win.classList.add("cbw2-pxd");

	function dissolve(opening) {
		var W = win.offsetWidth;
		var H = win.offsetHeight;
		var cols = Math.ceil(W / PX);
		var rows = Math.ceil(H / PX);
		var cells = [];
		for (var r = 0; r < rows; r++) {
			for (var c = 0; c < cols; c++) {
				cells.push({ c: c, r: r, d: Math.hypot(cols - 1 - c, rows - 1 - r) + Math.random() * 2.2 });
			}
		}
		cells.sort(function (a, b) {
			return a.d - b.d;
		});
		var run = ++pxRun;
		var t0 = performance.now();
		var DUR = opening ? 700 : 580;
		win.classList.add("cbw2-pxd-run");

		function frame(now) {
			if (run !== pxRun) return;
			var p = Math.max(0, Math.min(1, (now - t0) / DUR));
			var e = opening ? 1 - Math.pow(1 - p, 3) : 1 - p * p * p;
			var shown = Math.round(cells.length * e);
			var d = "";
			for (var i = 0; i < shown; i++) {
				var k = cells[i];
				d += "M" + k.c * PX + " " + k.r * PX + "h" + PX + "v" + PX + "h-" + PX + "z";
			}
			win.style.clipPath = 'path("' + (d || "M0 0") + '")';
			if (p < 1) {
				requestAnimationFrame(frame);
				return;
			}
			win.style.clipPath = "";
			win.classList.remove("cbw2-pxd-run");
			if (!opening) win.style.clipPath = 'path("M0 0")';
		}
		requestAnimationFrame(frame);
	}

	function setOpen(open, animate) {
		root.classList.toggle("cbw2-is-open", open);
		launcher.setAttribute("aria-expanded", String(open));
		launcher.setAttribute("aria-label", open ? "أغلق المحادثة" : "افتح المحادثة");
		if (animate) dissolve(open);
		else win.style.clipPath = open ? "" : 'path("M0 0")';
		if (open) setTimeout(function () { input.focus({ preventScroll: true }); }, 200);
	}

	setOpen(false, false);

	launcher.addEventListener("click", function () {
		setOpen(!root.classList.contains("cbw2-is-open"), true);
	});
	root.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && root.classList.contains("cbw2-is-open")) {
			setOpen(false, true);
			launcher.focus();
		}
	});

	/* ---------- avatar pixel shuffle ---------- */
	var BOT = [[1, 0], [2, 0], [3, 0], [1, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [1, 4], [3, 4]];
	var pxGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
	pxGroup.setAttribute("class", "cbw2-px");
	var blocks = BOT.map(function (c) {
		var r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		r.setAttribute("x", c[0] * 12);
		r.setAttribute("y", c[1] * 12);
		r.setAttribute("width", 12);
		r.setAttribute("height", 12);
		r.setAttribute("rx", 2);
		pxGroup.appendChild(r);
		return r;
	});
	avatarSvg.appendChild(pxGroup);

	function shuffleAvatar() {
		if (!root.classList.contains("cbw2-is-open")) return;
		var cells = [];
		for (var i = 0; i < 25; i++) cells.push([i % 5, Math.floor(i / 5)]);
		for (var j = cells.length - 1; j > 0; j--) {
			var k = Math.floor(Math.random() * (j + 1));
			var t = cells[j];
			cells[j] = cells[k];
			cells[k] = t;
		}
		avatar.classList.add("cbw2-shuffling");
		var STEP = 45;
		blocks.forEach(function (b, n) {
			var dx = (cells[n][0] - BOT[n][0]) * 12;
			var dy = (cells[n][1] - BOT[n][1]) * 12;
			setTimeout(function () { b.style.transform = "translate(" + dx + "px," + dy + "px)"; }, n * STEP);
			setTimeout(function () { b.style.transform = ""; }, blocks.length * STEP + 700 + n * STEP);
		});
		setTimeout(function () { avatar.classList.remove("cbw2-shuffling"); }, blocks.length * STEP * 2 + 700 + 260);
	}
	setTimeout(function () {
		shuffleAvatar();
		setInterval(shuffleAvatar, 5000);
	}, 2200);

	/* launcher close X builds from grid cells */
	var XCELLS = [[2, 2, 0], [1, 1, 1], [3, 1, 1], [1, 3, 1], [3, 3, 1], [0, 0, 2], [4, 0, 2], [0, 4, 2], [4, 4, 2]];
	root.querySelectorAll(".cbw2-x-icon").forEach(function (svg) {
		var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
		g.setAttribute("class", "cbw2-xpx");
		XCELLS.forEach(function (c) {
			var r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			r.setAttribute("x", c[0] * 12);
			r.setAttribute("y", c[1] * 12);
			r.setAttribute("width", 12);
			r.setAttribute("height", 12);
			r.setAttribute("rx", 2);
			r.setAttribute("class", "cbw2-ring" + c[2]);
			g.appendChild(r);
		});
		svg.insertBefore(g, svg.firstChild);
	});

	/* ---------- cursor-reactive dot grid ---------- */
	(function () {
		var CELL = 14;
		var REACH = 18;
		var HOLD = 500;
		var FADE = 400;
		var css = getComputedStyle(root);
		function v(name, fallback) {
			return css.getPropertyValue(name).trim() || fallback;
		}
		var GREY = v("--cbw2-dot", "#232c38");
		var ACCENTS = [v("--cbw2-dot-a", "#f6b545"), v("--cbw2-dot-b", "#3ddc97"), v("--cbw2-dot-c", "#7aa7ff")];
		var cv = document.createElement("canvas");
		cv.className = "cbw2-dots";
		cv.setAttribute("aria-hidden", "true");
		win.insertBefore(cv, win.firstChild);
		var ctx = cv.getContext("2d");
		if (!ctx) {
			cv.remove();
			return;
		}
		win.classList.add("cbw2-has-dots");
		var W = 0;
		var H = 0;
		var cols = 0;
		var rows = 0;
		var dpr = 1;
		var raf = 0;
		var lit = {};
		var pointer = null;

		function resize() {
			W = win.clientWidth;
			H = win.clientHeight;
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			cv.width = Math.round(W * dpr);
			cv.height = Math.round(H * dpr);
			cols = Math.ceil(W / CELL);
			rows = Math.ceil(H / CELL);
			draw(performance.now());
		}
		function local(e) {
			var r = win.getBoundingClientRect();
			var sx = r.width / W || 1;
			var sy = r.height / H || 1;
			return { x: (e.clientX - r.left) / sx - win.clientLeft, y: (e.clientY - r.top) / sy - win.clientTop };
		}
		function dot(x, y, rad, color, alpha) {
			ctx.globalAlpha = alpha;
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(x, y, rad, 0, 6.2832);
			ctx.fill();
		}
		function draw(now) {
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, W, H);
			var any = false;
			for (var j = 0; j < rows; j++) {
				for (var i = 0; i < cols; i++) {
					var x = i * CELL + 7;
					var y = j * CELL + 7;
					var d = lit[i + "," + j];
					dot(x, y, 1.1, GREY, 1);
					if (!d) continue;
					var left = d.until - now;
					if (left <= -FADE) {
						delete lit[i + "," + j];
						continue;
					}
					var a = left >= 0 ? 1 : 1 + left / FADE;
					var near = pointer && (x - pointer.x) * (x - pointer.x) + (y - pointer.y) * (y - pointer.y) <= REACH * REACH;
					d.s += ((near ? 1 : 0) - d.s) * 0.25;
					dot(x, y, 1.1 + 0.8 * d.s, d.color, a);
					any = true;
				}
			}
			ctx.globalAlpha = 1;
			return any;
		}
		function tick(now) {
			raf = 0;
			if (draw(now)) raf = requestAnimationFrame(tick);
		}

		win.addEventListener("pointermove", function (e) {
			if (e.pointerType === "touch") return;
			var p = local(e);
			var now = performance.now();
			pointer = p;
			var i0 = Math.max(0, Math.floor((p.x - REACH) / CELL));
			var i1 = Math.min(cols - 1, Math.ceil((p.x + REACH) / CELL));
			var j0 = Math.max(0, Math.floor((p.y - REACH) / CELL));
			var j1 = Math.min(rows - 1, Math.ceil((p.y + REACH) / CELL));
			for (var j = j0; j <= j1; j++) {
				for (var i = i0; i <= i1; i++) {
					var dx = i * CELL + 7 - p.x;
					var dy = j * CELL + 7 - p.y;
					if (dx * dx + dy * dy > REACH * REACH) continue;
					var k = i + "," + j;
					if (lit[k]) lit[k].until = now + HOLD;
					else lit[k] = { color: ACCENTS[Math.floor(Math.random() * ACCENTS.length)], until: now + HOLD, s: 0 };
				}
			}
			if (!raf) raf = requestAnimationFrame(tick);
		});
		win.addEventListener("pointerleave", function () {
			pointer = null;
			if (!raf) raf = requestAnimationFrame(tick);
		});
		if (window.ResizeObserver) new ResizeObserver(resize).observe(win);
		resize();
	})();

	/* ---------- messages ---------- */
	var stick = true;
	var userScroll = 0;
	["wheel", "touchmove", "keydown"].forEach(function (t) {
		log.addEventListener(t, function () { userScroll = Date.now(); }, { passive: true });
	});
	log.addEventListener("scroll", function () {
		if (Date.now() - userScroll > 400) return;
		stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
	});
	if (window.ResizeObserver) {
		new ResizeObserver(function () {
			if (stick) log.scrollTop = log.scrollHeight;
		}).observe(log);
	}
	function scrollDown() {
		log.scrollTop = log.scrollHeight;
		stick = true;
	}

	function addMessage(text, who) {
		var p = document.createElement("p");
		p.className = "cbw2-msg cbw2-msg--" + who + " cbw2-msg--new";
		p.textContent = text;
		log.appendChild(p);
		scrollDown();
		return p;
	}

	function showTyping() {
		var p = document.createElement("p");
		p.className = "cbw2-msg cbw2-msg--bot cbw2-msg--new cbw2-typing";
		p.setAttribute("aria-label", "أبو رمسه يكتب");
		p.innerHTML = "<span></span><span></span><span></span>";
		log.appendChild(p);
		scrollDown();
		return p;
	}

	/* ---------- chips ---------- */
	function makeChip(label, isAction) {
		var chip = document.createElement("button");
		chip.className = "cbw2-chip";
		chip.type = "button";
		chip.setAttribute("data-cbw2-chip", "");
		chip.textContent = label;
		chip.addEventListener("click", function () {
			if (isAction) ACTIONS[label]();
			else send(label);
		});
		return chip;
	}

	function setChips(labels) {
		chipsBox.textContent = "";
		labels.forEach(function (label) {
			chipsBox.appendChild(makeChip(label, !!ACTIONS[label]));
		});
	}

	function showChips(suggestions) {
		var list = ["المحادثة الكاملة"].concat((suggestions || []).slice(0, 2));
		lastChips = suggestions || [];
		setChips(list);
		chipsBox.classList.add("cbw2-chips-fresh");
		root.classList.remove("cbw2-started");
		scrollDown();
	}

	setChips(["المحادثة الكاملة"].concat(START_CHIPS.slice(0, 2)));

	/* ---------- send through the real bot ---------- */
	function send(text) {
		text = (text || "").trim();
		if (!text || busy) return;

		addMessage(text, "me");
		history.push({ role: "user", content: text });
		root.classList.add("cbw2-started");
		busy = true;
		var typing = showTyping();

		fetch("/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ messages: history }),
		})
			.then(function (res) {
				return res.json().then(function (data) {
					return { ok: res.ok, data: data || {} };
				});
			})
			.then(function (result) {
				typing.remove();
				if (!result.ok || !result.data.reply) {
					history.pop();
					addMessage(result.data.error || "تعذر الحصول على رد. حاول مرة أخرى.", "bot");
					showChips(lastChips);
					return;
				}
				history.push({ role: "assistant", content: result.data.reply });
				addMessage(result.data.reply, "bot");
				showChips(result.data.suggestions);
			})
			.catch(function () {
				typing.remove();
				history.pop();
				addMessage("تعذر الاتصال بالخدمة. تحقق من اتصالك وحاول مرة أخرى.", "bot");
				showChips(lastChips);
			})
			.then(function () {
				busy = false;
			});
	}

	/* ---------- input ---------- */
	function syncSend() {
		sendBtn.disabled = !input.value.trim();
	}
	input.addEventListener("input", syncSend);
	syncSend();

	function submitMessage() {
		if (input.value.trim()) {
			sendBtn.classList.remove("cbw2-whoosh");
			void sendBtn.offsetWidth;
			sendBtn.classList.add("cbw2-whoosh");
		}
		send(input.value);
		input.value = "";
		syncSend();
	}

	sendBtn.addEventListener("click", submitMessage);
	input.addEventListener("keydown", function (e) {
		if (e.key === "Enter" && !e.isComposing) {
			e.preventDefault();
			submitMessage();
		}
	});
	form.addEventListener("submit", function (e) {
		e.preventDefault();
		submitMessage();
	});
})();
