import { CopyIcon, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { envVarMap, upsertEnvVars } from "@/lib/env-lines";
import { api } from "@/utils/api";

interface Props {
	projectId?: string;
	serviceId?: string;
	currentEnv: string;
	onImport: (nextEnv: string) => void;
}

export const CopyEnvDialog = ({
	projectId,
	serviceId,
	currentEnv,
	onImport,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [source, setSource] = useState<string>();
	const [sourceEnv, setSourceEnv] = useState<string>();
	const [isFetching, setIsFetching] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const utils = api.useUtils();

	const { data: environments } = api.environment.byProjectId.useQuery(
		{ projectId: projectId! },
		{ enabled: isOpen && !!projectId },
	);

	// Databases are left out: their env is generated from credentials, rarely worth copying.
	const services = (environments ?? []).flatMap((env) => [
		...env.applications.map((a) => ({
			value: `application:${a.applicationId}`,
			label: `${env.name} / ${a.name}`,
		})),
		...env.compose.map((c) => ({
			value: `compose:${c.composeId}`,
			label: `${env.name} / ${c.name}`,
		})),
	]);

	const rows = useMemo(() => {
		if (sourceEnv === undefined) return [];
		const current = envVarMap(currentEnv);
		return [...envVarMap(sourceEnv)]
			.filter(([key, value]) => key !== "" && current.get(key) !== value)
			.map(([key, value]) => ({
				key,
				value,
				status: current.has(key) ? ("changed" as const) : ("new" as const),
			}));
	}, [sourceEnv, currentEnv]);

	const pickSource = async (value: string) => {
		setSource(value);
		setSourceEnv(undefined);
		setIsFetching(true);
		const [type, id] = value.split(":") as ["application" | "compose", string];
		try {
			const service =
				type === "application"
					? await utils.application.one.fetch({ applicationId: id })
					: await utils.compose.one.fetch({ composeId: id });
			const env = service.env ?? "";
			setSourceEnv(env);
			const current = envVarMap(currentEnv);
			// Only brand-new keys are preselected so nothing gets overwritten by surprise.
			setSelected(
				new Set([...envVarMap(env).keys()].filter((k) => k && !current.has(k))),
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not read variables",
			);
		} finally {
			setIsFetching(false);
		}
	};

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setSource(undefined);
			setSourceEnv(undefined);
			setSelected(new Set());
		}
	};

	const handleImport = () => {
		onImport(
			upsertEnvVars(
				currentEnv,
				rows.filter((r) => selected.has(r.key)),
			),
		);
		handleOpenChange(false);
	};

	if (!projectId) return null;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" size="sm">
					<CopyIcon className="mr-2 size-4" />
					Copy from service
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Copy variables from another service</DialogTitle>
					<DialogDescription>
						Pick a service of this project, then choose which variables to bring
						over. Nothing is saved until you click Save.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label>Source</Label>
						<Select value={source} onValueChange={pickSource}>
							<SelectTrigger>
								<SelectValue placeholder="Select a service" />
							</SelectTrigger>
							<SelectContent>
								{services
									.filter((s) => !s.value.endsWith(`:${serviceId}`))
									.map((s) => (
										<SelectItem key={s.value} value={s.value}>
											{s.label}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>

					{isFetching ? (
						<div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
							<Loader2 className="size-4 animate-spin" />
							Loading variables...
						</div>
					) : sourceEnv === undefined ? null : rows.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground text-sm">
							Nothing to copy, both services already have the same values.
						</div>
					) : (
						<ScrollArea className="h-80 rounded-md border">
							<div className="flex flex-col divide-y">
								{rows.map((row) => (
									<Label
										key={row.key}
										className="flex items-center gap-3 p-3 font-normal"
									>
										<Checkbox
											checked={selected.has(row.key)}
											onCheckedChange={(checked) =>
												setSelected((prev) => {
													const next = new Set(prev);
													if (checked === true) next.add(row.key);
													else next.delete(row.key);
													return next;
												})
											}
										/>
										<span className="flex-1 truncate font-mono text-sm">
											{row.key}
										</span>
										{row.status === "new" ? (
											<Badge variant="secondary">new</Badge>
										) : (
											<Badge variant="destructive">overwrites current</Badge>
										)}
									</Label>
								))}
							</div>
						</ScrollArea>
					)}
				</div>

				<DialogFooter>
					<Button
						type="button"
						onClick={handleImport}
						disabled={selected.size === 0}
					>
						Copy {selected.size > 0 ? selected.size : ""} variable
						{selected.size === 1 ? "" : "s"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
