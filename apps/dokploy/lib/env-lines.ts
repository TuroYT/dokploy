export type EnvLine =
	| { kind: "var"; key: string; value: string }
	| { kind: "raw"; text: string };

// Lines are kept verbatim so serializeEnv(parseEnv(s)) === s: comments and blank lines survive table edits.
// shortcut: quoted multi-line values show up as several rows, switch to Raw mode to edit them.
export const parseEnv = (text: string): EnvLine[] =>
	text === ""
		? []
		: text.split("\n").map((line) => {
				const eq = line.indexOf("=");
				if (eq === -1 || line.trimStart().startsWith("#")) {
					return { kind: "raw", text: line };
				}
				return {
					kind: "var",
					key: line.slice(0, eq),
					value: line.slice(eq + 1),
				};
			});

export const serializeEnv = (lines: EnvLine[]): string =>
	lines
		.map((l) => (l.kind === "var" ? `${l.key}=${l.value}` : l.text))
		.join("\n");

export const envVarMap = (text: string) =>
	new Map(
		parseEnv(text).flatMap((l) =>
			l.kind === "var" ? [[l.key.trim(), l.value] as const] : [],
		),
	);

export const duplicateKeys = (lines: EnvLine[]) => {
	const seen = new Set<string>();
	const dupes = new Set<string>();
	for (const l of lines) {
		if (l.kind !== "var" || l.key.trim() === "") continue;
		const key = l.key.trim();
		if (seen.has(key)) dupes.add(key);
		seen.add(key);
	}
	return dupes;
};

export const upsertEnvVars = (
	text: string,
	vars: { key: string; value: string }[],
) => {
	const lines = parseEnv(text);
	for (const { key, value } of vars) {
		const index = lines.findLastIndex(
			(l) => l.kind === "var" && l.key.trim() === key,
		);
		if (index >= 0) {
			lines[index] = { kind: "var", key, value };
			continue;
		}
		const last = lines.at(-1);
		if (last?.kind === "raw" && last.text === "") {
			lines.splice(lines.length - 1, 0, { kind: "var", key, value });
		} else {
			lines.push({ kind: "var", key, value });
		}
	}
	return serializeEnv(lines);
};
