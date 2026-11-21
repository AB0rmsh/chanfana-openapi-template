(function () {
	// idle phrases that take turns under the tree
	var PHRASES = ["اسألني عن أي شي", "وش يهمك اليوم؟", "أشرح لك أي فكرة"];
	var PHRASE_MS = 4200;

	// tree look
	var TREE_NEAR = [255, 205, 128];
	var TREE_FAR = [150, 126, 96];

	// per state: turn = globe spin (rad/s), sway = how far each root swings (rad),
	// pace = how fast the roots swing, fade = trail fade per frame (0..1, lower = longer trails)
	var MOTION = {
		idle: { turn: 0.28, sway: 0.24, pace: 1, fade: 0.26 },
		thinking: { turn: 1.1, sway: 0.42, pace: 2.6, fade: 0.2 },
		answer: { turn: 1.1, sway: 0.42, pace: 2.6, fade: 0.2 },
	};

	var STAR = [255, 224, 178];
	var STAR_DENSITY = 1 / 1700;

	// ---- the tree: generated once, in 3D: a sphere of roots around the centre ----
	function rand(seed) {
		return function () {
			seed = (seed * 16807) % 2147483647;
			return (seed - 1) / 2147483646;
		};
	}
	function buildTree(seedNum) {
		var R = rand(seedNum);
		var segs = [];
		var curTr = 0;
		function norm(v) {
			var l = Math.hypot(v[0], v[1], v[2]) || 1;
			return [v[0] / l, v[1] / l, v[2] / l];
		}
		function cross(a, b) {
			return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
		}
		function bend(dir, axis, ang) {
			var w = cross(axis, dir);
			var c = Math.cos(ang);
			var sn = Math.sin(ang);
			return norm([dir[0] * c + w[0] * sn, dir[1] * c + w[1] * sn, dir[2] * c + w[2] * sn]);
		}
		function grow(p, dir, len, depth, parent, root) {
			var end = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len];
			var idx = segs.length;
			segs.push({ a: p, b: end, d: depth, kids: [], parent: parent, tr: curTr });
			if (parent >= 0) segs[parent].kids.push(idx);
			if (depth >= 6) return;
			var r = [R() - 0.5, R() - 0.5, R() - 0.5];
			var axis = norm(cross(dir, r));
			var ang = 0.26 + R() * 0.16;
			[ang, -ang].forEach(function (a) {
				var nd = bend(dir, axis, a);
				var dot = nd[0] * root[0] + nd[1] * root[1] + nd[2] * root[2];
				if (dot < 0.58) nd = norm([nd[0] + root[0] * 0.8, nd[1] + root[1] * 0.8, nd[2] + root[2] * 0.8]);
				grow(end, nd, len * (0.78 + R() * 0.06), depth + 1, idx, root);
			});
		}
		var TRUNKS = 26;
		var golden = Math.PI * (3 - Math.sqrt(5));
		for (var t = 0; t < TRUNKS; t++) {
			var y = 1 - ((t + 0.5) * 2) / TRUNKS;
			var rr = Math.sqrt(1 - y * y);
			var th = t * golden;
			var d0 = norm([Math.cos(th) * rr + (R() - 0.5) * 0.15, y, Math.sin(th) * rr + (R() - 0.5) * 0.15]);
			curTr = t;
			grow([0, 0, 0], d0, 0.24, 0, -1, d0);
		}
		return segs;
	}
	var TREE = buildTree(7);
	var SWING = [];
	(function () {
		var R = rand(31);
		for (var t = 0; t < 26; t++) {
			var ax = [R() - 0.5, R() - 0.5, R() - 0.5];
			var l = Math.hypot(ax[0], ax[1], ax[2]) || 1;
			SWING.push({ ax: [ax[0] / l, ax[1] / l, ax[2] / l], w: 0.6 + R() * 0.9, ph: R() * 6.283 });
		}
	})();

	var uid = 0;

	document.querySelectorAll("[data-aa1]:not([data-aa1-init])").forEach(function (root) {
		root.setAttribute("data-aa1-init", "");

		var phraseEl = root.querySelector("[data-aa1-phrase]");
		var chips = root.querySelectorAll("[data-aa1-chip]");
		var input = root.querySelector("[data-aa1-input]");
		var label = root.querySelector("[data-aa1-label-for]");
		var figEl = root.querySelector(".aa1-fig");
		var el = {
			num: root.querySelector("[data-aa1-num]"),
			pill: root.querySelector("[data-aa1-pill]"),
			text: root.querySelector("[data-aa1-text]"),
		};

		var inputId = "aa1-input-" + ++uid;
		input.id = inputId;
		label.setAttribute("for", inputId);

		var canvas = root.querySelector("[data-aa1-canvas]");
		var ctx = canvas.getContext("2d");
		var phraseIndex = 0;
		var phraseTimer = null;
		var messages = [];
		var busy = false;

		function state() {
			return root.getAttribute("data-aa1-state");
		}
		function setState(s) {
			root.setAttribute("data-aa1-state", s);
		}

		// ---- canvas size follows the CSS box (never a fixed pixel size) ----
		var W = 0;
		var H = 0;
		var dpr = 1;
		function resize() {
			var r = canvas.getBoundingClientRect();
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			W = Math.max(1, Math.round(r.width));
			H = Math.max(1, Math.round(r.height));
			canvas.width = W * dpr;
			canvas.height = H * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		resize();
		if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);

		// ---- star field: fills the whole panel; fades out towards the sphere ----
		var stage = root.querySelector(".aa1-stage");
		var stars = root.querySelector("[data-aa1-stars]");
		var sctx = stars.getContext("2d");
		var SW = 0;
		var SH = 0;
		var starList = [];
		function resizeStars() {
			var r = stage.getBoundingClientRect();
			SW = Math.max(1, Math.round(r.width));
			SH = Math.max(1, Math.round(r.height));
			stars.width = SW * dpr;
			stars.height = SH * dpr;
			sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			var n = Math.round(SW * SH * STAR_DENSITY);
			var R = rand(11);
			starList = [];
			for (var i = 0; i < n; i++) {
				starList.push({ x: R() * SW, y: R() * SH, r: 0.55 + Math.pow(R(), 3) * 1.4, sp: 0.6 + R() * 2.2, ph: R() * 6.283, b: 0.5 + R() * 0.5 });
			}
		}
		resizeStars();
		if (window.ResizeObserver) new ResizeObserver(resizeStars).observe(stage);
		function smooth(a, b, x) {
			var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
			return t * t * (3 - 2 * t);
		}
		function drawStars(now) {
			sctx.clearRect(0, 0, SW, SH);
			var c = canvas.getBoundingClientRect();
			var st = stage.getBoundingClientRect();
			var cx = c.left - st.left + c.width / 2;
			var cy = c.top - st.top + c.height / 2;
			var reach = Math.max(SW, SH) * 0.62;
			starList.forEach(function (s) {
				var d = Math.hypot(s.x - cx, s.y - cy) / reach;
				var far = smooth(0.2, 0.8, d);
				if (far < 0.02) return;
				var tw = 0.5 + 0.5 * Math.sin(now * 0.001 * s.sp + s.ph);
				var a = s.b * far * (0.2 + 0.8 * tw * tw);
				sctx.fillStyle = "rgba(" + STAR.join(",") + "," + a.toFixed(3) + ")";
				sctx.beginPath();
				sctx.arc(s.x, s.y, s.r, 0, 6.283);
				sctx.fill();
			});
		}

		// ---- one frame: rotate, project, depth-sort, draw ----
		var angle = 0.6;
		var last = 0;
		var clock = 0;
		var cur = { turn: 0.28, sway: 0.24, pace: 1, fade: 0.26 };
		function swing(p, m, r) {
			var x = p[0] * m[0] + p[1] * m[1] + p[2] * m[2];
			var y = p[0] * m[3] + p[1] * m[4] + p[2] * m[5];
			var z = p[0] * m[6] + p[1] * m[7] + p[2] * m[8];
			var rr = x * x + y * y + z * z;
			var amp = 0.05 * rr * r;
			return [
				x + Math.sin(clock * 1.3 + y * 6) * amp,
				y + Math.sin(clock * 1.1 + z * 6) * amp,
				z + Math.sin(clock * 1.5 + x * 6) * amp,
			];
		}
		function rotMatrix(a, ang) {
			var c = Math.cos(ang);
			var s = Math.sin(ang);
			var t = 1 - c;
			var x = a[0];
			var y = a[1];
			var z = a[2];
			return [
				t * x * x + c,
				t * x * y - s * z,
				t * x * z + s * y,
				t * x * y + s * z,
				t * y * y + c,
				t * y * z - s * x,
				t * x * z - s * y,
				t * y * z + s * x,
				t * z * z + c,
			];
		}
		function project(p, cosA, sinA, wob) {
			var x = p[0] * cosA + p[2] * sinA;
			var z = -p[0] * sinA + p[2] * cosA;
			var y = p[1];
			var tilt = 0.38 + wob;
			var y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
			var z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
			var x2 = x;
			var k = 3.2 / (3.2 + z2);
			var scale = Math.min(W, H) / 2.4;
			return [W / 2 + x2 * k * scale, H / 2 + y2 * k * scale, z2, k];
		}
		function frame(now) {
			drawStars(now);
			var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
			last = now;
			var target = MOTION[state()] || MOTION.idle;
			for (var key in target) cur[key] += (target[key] - cur[key]) * Math.min(1, dt * 3);
			angle += cur.turn * dt;
			clock += cur.pace * dt;
			var mats = SWING.map(function (sw) {
				return rotMatrix(sw.ax, Math.sin(clock * sw.w + sw.ph) * cur.sway);
			});
			var ripple = cur.sway / 0.24;
			var wob = Math.sin(now / 3200) * 0.22;
			var cosA = Math.cos(angle);
			var sinA = Math.sin(angle);

			ctx.globalCompositeOperation = "destination-out";
			ctx.fillStyle = "rgba(0, 0, 0, " + cur.fade + ")";
			ctx.fillRect(0, 0, W, H);
			ctx.globalCompositeOperation = "source-over";

			var lines = [];
			var lw = Math.max(0.6, Math.min(W, H * 1.6) / 420);
			TREE.forEach(function (s) {
				var m = mats[s.tr];
				var a = project(swing(s.a, m, ripple), cosA, sinA, wob);
				var b = project(swing(s.b, m, ripple), cosA, sinA, wob);
				lines.push({ a: a, b: b, z: (a[2] + b[2]) / 2, d: s.d });
			});
			lines.sort(function (p, q) {
				return q.z - p.z;
			});
			ctx.lineCap = "round";
			lines.forEach(function (l) {
				var t = Math.max(0, Math.min(1, (1 - l.z) / 2));
				var c = TREE_FAR.map(function (f, i) {
					return Math.round(f + (TREE_NEAR[i] - f) * t);
				});
				ctx.strokeStyle = "rgb(" + c.join(",") + ")";
				ctx.lineWidth = lw * Math.max(0.5, 3.4 - l.d * 0.42) * l.a[3];
				ctx.beginPath();
				ctx.moveTo(l.a[0], l.a[1]);
				ctx.lineTo(l.b[0], l.b[1]);
				ctx.stroke();
			});
		}

		frame(performance.now());
		(function loop(now) {
			if (!document.hidden) frame(now);
			else last = 0;
			requestAnimationFrame(loop);
		})(performance.now());

		function swapPhrase() {
			phraseTimer = setTimeout(function () {
				if (state() === "idle") {
					phraseEl.classList.add("is-out");
					setTimeout(function () {
						phraseIndex = (phraseIndex + 1) % PHRASES.length;
						phraseEl.textContent = PHRASES[phraseIndex];
						phraseEl.classList.remove("is-out");
					}, 900);
				}
				swapPhrase();
			}, PHRASE_MS);
		}

		// all text goes in via textContent — typed questions are never parsed as HTML
		function fill(answer) {
			var hasFigure = !!answer.figure;
			figEl.hidden = !hasFigure;
			el.num.textContent = answer.figure || "";
			el.pill.textContent = answer.pill || "";
			el.pill.hidden = !answer.pill;
			el.text.textContent = answer.text;
		}

		function press(idx) {
			chips.forEach(function (c, i) {
				c.setAttribute("aria-pressed", i === idx ? "true" : "false");
			});
		}

		function ask(question, chipIdx) {
			question = (question || "").trim();
			if (!question || busy) return;
			busy = true;
			clearTimeout(phraseTimer);
			press(chipIdx);
			setState("thinking");
			messages.push({ role: "user", content: question });

			fetch("/api/chat", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ messages: messages }),
			})
				.then(function (res) {
					return res.json().then(function (data) {
						return { ok: res.ok, data: data || {} };
					});
				})
				.then(function (result) {
					if (!result.ok || !result.data.reply) {
						messages.pop();
						fill({ figure: "", pill: "", text: result.data.error || "تعذر الحصول على رد. حاول مرة أخرى." });
					} else {
						messages.push({ role: "assistant", content: result.data.reply });
						fill({ figure: result.data.figure || "", pill: result.data.pill || "", text: result.data.reply });
					}
					setState("answer");
				})
				.catch(function () {
					messages.pop();
					fill({ figure: "", pill: "", text: "تعذر الاتصال بالخدمة. تحقق من اتصالك وحاول مرة أخرى." });
					setState("answer");
				})
				.then(function () {
					busy = false;
				});
		}

		function reset() {
			clearTimeout(phraseTimer);
			press(-1);
			setState("idle");
			swapPhrase();
		}

		// ---- tag row: swipe on touch, drag with a mouse, fades on the hidden side(s) ----
		var row = root.querySelector(".aa1-chips");
		var MAX_WHEN_TIGHT = 2;
		function fitChips() {
			chips.forEach(function (c) {
				c.hidden = false;
			});
			if (row.scrollWidth > row.clientWidth + 1) {
				chips.forEach(function (c, i) {
					c.hidden = i >= MAX_WHEN_TIGHT;
				});
			}
		}
		function syncRow() {
			var max = row.scrollWidth - row.clientWidth;
			row.classList.toggle("is-scrollable", max > 1);
			row.style.setProperty("--aa1-fl", row.scrollLeft > 1 ? "24px" : "0px");
			row.style.setProperty("--aa1-fr", row.scrollLeft < max - 1 ? "24px" : "0px");
		}
		row.addEventListener("scroll", syncRow, { passive: true });
		function refit() {
			fitChips();
			syncRow();
		}
		if (window.ResizeObserver) new ResizeObserver(refit).observe(row);
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
		refit();
		var drag = null;
		var dragged = false;
		row.addEventListener("pointerdown", function (e) {
			if (e.pointerType !== "mouse" || e.button !== 0 || row.scrollWidth <= row.clientWidth) return;
			drag = { x: e.clientX, left: row.scrollLeft };
			dragged = false;
		});
		row.addEventListener("pointermove", function (e) {
			if (!drag) return;
			var dx = e.clientX - drag.x;
			if (!dragged && Math.abs(dx) > 4) {
				dragged = true;
				row.classList.add("is-dragging");
				row.setPointerCapture(e.pointerId);
			}
			if (dragged) row.scrollLeft = drag.left - dx;
		});
		function endDrag() {
			drag = null;
			row.classList.remove("is-dragging");
		}
		row.addEventListener("pointerup", endDrag);
		row.addEventListener("pointercancel", endDrag);
		row.addEventListener(
			"click",
			function (e) {
				if (dragged) {
					e.stopPropagation();
					e.preventDefault();
					dragged = false;
				}
			},
			true,
		);

		chips.forEach(function (chip) {
			chip.addEventListener("click", function () {
				ask(chip.textContent, +chip.getAttribute("data-aa1-chip"));
			});
		});

		var sendBtn = root.querySelector("[data-aa1-send]");
		function syncSend() {
			sendBtn.disabled = !input.value.trim() || busy;
		}
		function send() {
			var q = input.value.trim().slice(0, 200);
			if (!q || busy) return;
			input.value = "";
			syncSend();
			ask(q, -1);
		}
		input.addEventListener("input", syncSend);
		input.addEventListener("keydown", function (e) {
			if (e.key === "Enter" && !e.isComposing) {
				e.preventDefault();
				send();
			}
		});
		sendBtn.addEventListener("click", send);
		syncSend();

		root.querySelector("[data-aa1-reset]").addEventListener("click", reset);

		swapPhrase();
	});
})();
