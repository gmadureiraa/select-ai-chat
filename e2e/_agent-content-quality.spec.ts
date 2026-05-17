/**
 * Smoke test pro pipeline de sanitização do createContent/editContent.
 *
 * Testa as funções puras de `api/_lib/parse-llm-response.ts` que cobrem todos
 * os bugs reportados por Gabriel (2026-05-16) — "post LinkedIn saiu todo bugado":
 *
 *   1. JSON/markdown wrapper vazando no output
 *   2. UTF-8 mojibake (Ã£/Ã©/Ã§)
 *   3. Meta-prefixos AI-ism ("Aqui está o post:", "Segue o conteúdo:")
 *   4. Hashtags em plataforma que proíbe (LinkedIn padrão = 0)
 *   5. Title extraction com markdown lixo (# Header, **Hook:**)
 *
 * NÃO testa a chamada real do Gemini (precisa de API key + cliente real). Pra
 * integration test full, ver `dev-test-flows.ts` que faz e2e contra Neon DB.
 *
 * Esses testes são FAST (sem DB, sem API) — rodam em qualquer ambiente.
 */
import { test, expect } from "@playwright/test";
import {
	stripOuterCodeFence,
	tryParseJsonResponse,
	normalizeWhitespaceAndQuotes,
	stripMetaPrefix,
	stripHashtags,
	limitHashtags,
	detectMojibake,
	extractTitleFromContent,
	sanitizeLLMText,
} from "../api/_lib/parse-llm-response";

test.describe("parse-llm-response — sanitize pipeline", () => {
	test.describe("stripOuterCodeFence", () => {
		test("remove ```json ... ``` envolvendo tudo", () => {
			const input = '```json\n{"post":"olá"}\n```';
			expect(stripOuterCodeFence(input)).toBe('{"post":"olá"}');
		});

		test("remove ```markdown ... ``` envolvendo tudo", () => {
			const input = "```markdown\n# Título\nconteúdo\n```";
			expect(stripOuterCodeFence(input)).toBe("# Título\nconteúdo");
		});

		test("remove ``` sem tag envolvendo tudo", () => {
			const input = "```\ntexto\n```";
			expect(stripOuterCodeFence(input)).toBe("texto");
		});

		test("strip parcial: só ``` no início", () => {
			const input = "```json\n{ data: 1 }";
			expect(stripOuterCodeFence(input)).toBe("{ data: 1 }");
		});

		test("strip parcial: só ``` no fim", () => {
			const input = "texto final\n```";
			expect(stripOuterCodeFence(input)).toBe("texto final");
		});

		test("NÃO toca em ``` no meio do texto (code block interno)", () => {
			const input = "Aqui um snippet:\n\n```js\nconst x=1;\n```\n\ne mais texto.";
			// Conteúdo COM fence interno — não deve strippar nada porque não envolve tudo
			expect(stripOuterCodeFence(input)).toBe(input);
		});

		test("input vazio devolve vazio", () => {
			expect(stripOuterCodeFence("")).toBe("");
		});
	});

	test.describe("tryParseJsonResponse", () => {
		test("parse JSON puro", () => {
			expect(tryParseJsonResponse('{"a":1}')).toEqual({ a: 1 });
		});

		test("parse JSON com markdown wrapper", () => {
			expect(tryParseJsonResponse('```json\n{"a":1}\n```')).toEqual({ a: 1 });
		});

		test("devolve null pra texto livre", () => {
			expect(tryParseJsonResponse("este não é JSON")).toBeNull();
		});

		test("extrai primeira chave JSON válida em texto sujo", () => {
			const dirty = 'Aqui está o JSON: {"a":1, "b":"ok"} fim.';
			expect(tryParseJsonResponse(dirty)).toEqual({ a: 1, b: "ok" });
		});
	});

	test.describe("normalizeWhitespaceAndQuotes", () => {
		test("remove zero-width chars (BOM, ZWSP)", () => {
			const input = "olá​﻿mundo";
			expect(normalizeWhitespaceAndQuotes(input)).toBe("olámundo");
		});

		test("normaliza smart quotes pra ASCII", () => {
			const input = "‘olá’ e “mundo”";
			expect(normalizeWhitespaceAndQuotes(input)).toBe("'olá' e \"mundo\"");
		});

		test("colapsa 3+ newlines em 2", () => {
			const input = "linha1\n\n\n\n\nlinha2";
			expect(normalizeWhitespaceAndQuotes(input)).toBe("linha1\n\nlinha2");
		});

		test("preserva 1-2 newlines (parágrafos)", () => {
			const input = "linha1\n\nlinha2\nlinha3";
			expect(normalizeWhitespaceAndQuotes(input)).toBe("linha1\n\nlinha2\nlinha3");
		});

		test("trim trailing spaces por linha", () => {
			const input = "linha1   \nlinha2\t\nlinha3 ";
			expect(normalizeWhitespaceAndQuotes(input)).toBe("linha1\nlinha2\nlinha3");
		});
	});

	test.describe("stripMetaPrefix", () => {
		test("remove 'Aqui está o post:' como primeira linha", () => {
			const input = "Aqui está o post:\n\nMeu conteúdo real começa aqui.";
			expect(stripMetaPrefix(input)).toBe("Meu conteúdo real começa aqui.");
		});

		test("remove 'Segue o conteúdo:'", () => {
			const input = "Segue o conteúdo: \n\nReal text.";
			expect(stripMetaPrefix(input)).toBe("Real text.");
		});

		test("remove 'Criei para você um post:'", () => {
			const input = "Criei para você um post: aqui vai\n\nReal.";
			expect(stripMetaPrefix(input)).toBe("Real.");
		});

		test("NÃO remove conteúdo legítimo que começa com 'Aqui'", () => {
			const input = "Aqui no Brasil, founders erram MUITO em scaling.\n\nLinha 2.";
			expect(stripMetaPrefix(input)).toBe(input);
		});

		test("input sem meta-prefixo passa intacto", () => {
			const input = "Texto direto sem prefixo.";
			expect(stripMetaPrefix(input)).toBe(input);
		});
	});

	test.describe("stripHashtags", () => {
		test("remove hashtags isoladas (colapsando whitespace)", () => {
			// Função colapsa whitespace pós-strip
			expect(stripHashtags("texto #marketing #ia conteúdo")).toBe(
				"texto conteúdo",
			);
		});

		test("mantém menções (@user)", () => {
			expect(stripHashtags("oi @gabriel #marketing")).toBe("oi @gabriel");
		});

		test("hashtags com acento PT-BR", () => {
			expect(stripHashtags("texto #automação #inovação fim")).toBe("texto fim");
		});
	});

	test.describe("limitHashtags", () => {
		test("mantém as primeiras N, remove o resto", () => {
			const input = "post #a #b #c #d #e";
			expect(limitHashtags(input, 3)).toBe("post #a #b #c");
		});

		test("0 = remove todas", () => {
			expect(limitHashtags("texto #x #y", 0)).toBe("texto");
		});

		test("count maior que hashtags = não remove nada", () => {
			expect(limitHashtags("texto #x", 10)).toBe("texto #x");
		});
	});

	test.describe("detectMojibake", () => {
		test("detecta Ã£ (ã virou)", () => {
			expect(detectMojibake("informaÃ§Ã£o")).toBe(true);
		});

		test("não dispara em texto PT-BR válido", () => {
			expect(detectMojibake("informação plena com ç e ã")).toBe(false);
		});

		test("não dispara em string vazia", () => {
			expect(detectMojibake("")).toBe(false);
		});
	});

	test.describe("extractTitleFromContent", () => {
		test("strippa # markdown header", () => {
			expect(extractTitleFromContent("# Meu Título\n\nCorpo")).toBe("Meu Título");
		});

		test("strippa **Hook:** label", () => {
			const input = "**Hook:** Demorei 3 anos pra entender isso\n\nCorpo do post";
			// Pula a linha com label e pega a próxima
			expect(extractTitleFromContent(input)).toBe("Corpo do post");
		});

		test("strippa **Gancho:** label", () => {
			const input = "**Gancho:** Primeira ideia\n\nDesenvolvimento aqui";
			expect(extractTitleFromContent(input)).toBe("Desenvolvimento aqui");
		});

		test("trunca em 60 chars", () => {
			const long = "X".repeat(100);
			expect(extractTitleFromContent(long, 60)).toBe("X".repeat(60));
		});

		test("collapsa whitespace", () => {
			expect(extractTitleFromContent("Texto   com    espaços")).toBe(
				"Texto com espaços",
			);
		});

		test("ignora code fence wrapping completo (devolve conteúdo interno)", () => {
			// Caso REAL do Gemini: envolve o output inteiro em ```markdown.
			// stripOuterCodeFence remove o wrap, sobra o conteúdo dentro.
			const input = "```markdown\nTítulo real do post\n\nCorpo.\n```";
			expect(extractTitleFromContent(input)).toBe("Título real do post");
		});
	});

	test.describe("sanitizeLLMText (pipeline completo)", () => {
		test("LinkedIn — strippa fence + meta + todas hashtags", () => {
			const raw =
				"```markdown\nAqui está o post LinkedIn:\n\nDemorei 3 anos #marketing #linkedin.\n```";
			const result = sanitizeLLMText(raw, { stripAllHashtags: true });
			expect(result.text).toBe("Demorei 3 anos .");
			expect(result.warnings).toContain("stripped_outer_code_fence");
			expect(result.warnings).toContain("stripped_meta_prefix");
			expect(result.warnings).toContain("stripped_all_hashtags");
		});

		test("Instagram — limita a 3 hashtags", () => {
			const raw = "Post bonito #a #b #c #d #e #f";
			const result = sanitizeLLMText(raw, { maxHashtags: 3 });
			expect(result.text).toBe("Post bonito #a #b #c");
			expect(result.warnings).toContain("limited_hashtags_to_3");
		});

		test("Detecta mojibake e emite warning", () => {
			const raw = "InformaÃ§Ã£o sobre o evento";
			const result = sanitizeLLMText(raw);
			expect(result.warnings).toContain("mojibake_detected");
			// Mas NÃO altera o texto (decisão consciente)
			expect(result.text).toBe("InformaÃ§Ã£o sobre o evento");
		});

		test("Input vazio devolve warning + texto vazio", () => {
			const result = sanitizeLLMText("");
			expect(result.text).toBe("");
			expect(result.warnings).toContain("empty_or_invalid_input");
		});

		test("Input válido sem problemas → warnings vazio", () => {
			const raw = "Post limpo, sem fences, sem meta, sem hashtags.";
			const result = sanitizeLLMText(raw);
			expect(result.text).toBe(raw);
			expect(result.warnings).toHaveLength(0);
		});

		test("Bug reportado: post LinkedIn com triple-fence + label + hashtag", () => {
			// Cenário real reportado: Gemini envolveu em ```json, vazou "Aqui está:" e
			// meteu hashtag em LinkedIn.
			const raw =
				'```json\n```\nAqui está o post:\n\n**Hook:** Demorei 3 anos pra entender isso.\n\nO mercado de marketing IA mudou. Quem não acompanha fica pra trás.\n\n#marketing #ai\n```';
			const result = sanitizeLLMText(raw, { stripAllHashtags: true });
			// Verifica que ao menos: NÃO sobra ```json/```, NÃO sobra "Aqui está:",
			// NÃO sobra hashtag.
			expect(result.text).not.toContain("```");
			expect(result.text).not.toContain("Aqui está o post");
			expect(result.text).not.toContain("#marketing");
			expect(result.text).not.toContain("#ai");
		});
	});
});

test.describe("createContent integration shape (smoke)", () => {
	test("POST /api/kai-simple-chat sem auth → 401 (sanity check)", async ({
		request,
	}) => {
		// Não testamos a tool em si (precisa de auth + DB + Gemini key real),
		// só confirma que o handler está montado e gateado por auth.
		const response = await request.post("/api/kai-simple-chat", {
			data: { message: "hi", useTools: true },
			headers: { "content-type": "application/json" },
		});
		// 401 (sem auth) ou 400 (input inválido) são aceitáveis — só não pode 500
		const status = response.status();
		expect([400, 401]).toContain(status);
	});
});
