import { describe, expect, it } from "vitest";
import {
	duplicateKeys,
	envVarMap,
	parseEnv,
	serializeEnv,
	upsertEnvVars,
} from "@/lib/env-lines";

describe("env-lines", () => {
	it("round-trips any input exactly", () => {
		for (const s of [
			"",
			"A=1",
			"# comment\n\nA=1\nB==x= \nNOEQ\n  # indented=comment\nC=",
			"URL=${{project.DB}}\n",
		]) {
			expect(serializeEnv(parseEnv(s))).toBe(s);
		}
	});

	it("splits on the first equal sign only", () => {
		expect(parseEnv("TOKEN=a=b")).toEqual([
			{ kind: "var", key: "TOKEN", value: "a=b" },
		]);
	});

	it("keeps comments and lines without = as raw", () => {
		expect(parseEnv("# X=1\nFOO")).toEqual([
			{ kind: "raw", text: "# X=1" },
			{ kind: "raw", text: "FOO" },
		]);
	});

	it("detects duplicated keys, ignoring surrounding spaces", () => {
		expect([...duplicateKeys(parseEnv("A=1\nB=2\n A =3\n=\n=x"))]).toEqual([
			"A",
		]);
	});

	it("maps keys to their last value", () => {
		expect(envVarMap("A=1\n# A=0\nA=2").get("A")).toBe("2");
	});

	it("upserts in place and appends before the trailing newline", () => {
		expect(
			upsertEnvVars("# db\nA=1\nB=2\n", [
				{ key: "A", value: "9" },
				{ key: "C", value: "3" },
			]),
		).toBe("# db\nA=9\nB=2\nC=3\n");
		expect(upsertEnvVars("", [{ key: "A", value: "1" }])).toBe("A=1");
	});
});
