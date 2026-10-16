import type { CompletionSource } from "@codemirror/autocomplete";
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "lucide-react";
import { type ClipboardEvent, type CSSProperties, useState } from "react";
import { CodeEditor } from "@/components/shared/code-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import {
	duplicateKeys,
	type EnvLine,
	parseEnv,
	serializeEnv,
} from "@/lib/env-lines";

interface Props {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	completionSource?: CompletionSource;
	className?: string;
	wrapperClassName?: string;
}

export const EnvEditor = ({
	value,
	onChange,
	placeholder,
	completionSource,
	className,
	wrapperClassName,
}: Props) => {
	const [mode, setMode] = useState("table");
	const [masked, setMasked] = useState(true);
	const lines = parseEnv(value ?? "");
	const update = (next: EnvLine[]) => onChange(serializeEnv(next));
	const dupes = duplicateKeys(lines);
	const hiddenLines = lines.filter(
		(l) => l.kind === "raw" && l.text.trim() !== "",
	).length;

	const setVar = (
		index: number,
		patch: Partial<{ key: string; value: string }>,
	) =>
		update(
			lines.map((l, i) =>
				i === index && l.kind === "var" ? { ...l, ...patch } : l,
			),
		);

	const addVar = () => {
		const last = lines.at(-1);
		const base =
			last?.kind === "raw" && last.text === "" ? lines.slice(0, -1) : lines;
		update([...base, { kind: "var", key: "", value: "" }]);
	};

	// Pasting a .env block into a key field imports every variable at once.
	const onKeyPaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
		const text = e.clipboardData.getData("text").replace(/\r/g, "").trim();
		if (!text.includes("=")) return;
		e.preventDefault();
		const row = lines[index];
		const isEmpty = row?.kind === "var" && row.key === "" && row.value === "";
		update([
			...lines.slice(0, isEmpty ? index : index + 1),
			...parseEnv(text),
			...lines.slice(index + 1),
		]);
	};

	return (
		<Tabs value={mode} onValueChange={setMode} className="w-full">
			<div className="flex items-center justify-between">
				<TabsList>
					<TabsTrigger value="table">Table</TabsTrigger>
					<TabsTrigger value="raw">Raw (.env)</TabsTrigger>
				</TabsList>
				{mode === "raw" && (
					<Toggle
						aria-label="Toggle values visibility"
						pressed={masked}
						onPressedChange={setMasked}
					>
						{masked ? (
							<EyeIcon className="h-4 w-4 text-muted-foreground" />
						) : (
							<EyeOffIcon className="h-4 w-4 text-muted-foreground" />
						)}
					</Toggle>
				)}
			</div>

			{mode === "table" ? (
				<div className="flex flex-col gap-2">
					{lines.map((line, i) =>
						line.kind === "var" ? (
							<div key={i} className="flex items-start gap-2">
								<div className="w-2/5 shrink-0">
									<Input
										aria-label="Variable name"
										aria-invalid={dupes.has(line.key.trim())}
										placeholder="KEY"
										className="font-mono"
										value={line.key}
										// "=" would split the line and a leading "#" would turn it into a comment.
										onChange={(e) =>
											setVar(i, {
												key: e.target.value
													.replace(/=/g, "")
													.replace(/^\s*#/, ""),
											})
										}
										onPaste={(e) => onKeyPaste(i, e)}
										autoComplete="off"
									/>
								</div>
								<div className="min-w-0 flex-1">
									<Input
										aria-label={`Value of ${line.key || "variable"}`}
										placeholder="value"
										type="password"
										className="font-mono"
										value={line.value}
										onChange={(e) => setVar(i, { value: e.target.value })}
										autoComplete="off"
									/>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={`Remove ${line.key || "variable"}`}
									onClick={() => update(lines.filter((_, j) => j !== i))}
								>
									<TrashIcon className="h-4 w-4 text-muted-foreground" />
								</Button>
							</div>
						) : null,
					)}
					<div className="flex flex-wrap items-center justify-between gap-2">
						<Button type="button" variant="outline" size="sm" onClick={addVar}>
							<PlusIcon className="mr-1 h-4 w-4" />
							Add variable
						</Button>
						<span className="text-xs text-muted-foreground">
							Tip: paste a whole .env into a name field to import it.
							{hiddenLines > 0 &&
								` ${hiddenLines} comment line(s) kept, visible in Raw.`}
						</span>
					</div>
				</div>
			) : (
				<CodeEditor
					style={
						{ WebkitTextSecurity: masked ? "disc" : null } as CSSProperties
					}
					language="properties"
					completionSource={completionSource}
					disabled={masked}
					lineWrapping
					placeholder={placeholder}
					className={className}
					wrapperClassName={wrapperClassName}
					value={value}
					onChange={onChange}
				/>
			)}
			{dupes.size > 0 && (
				<p className="text-sm text-destructive">
					Defined more than once: {[...dupes].join(", ")}. Only one value will
					be used, remove the extra lines.
				</p>
			)}
		</Tabs>
	);
};
