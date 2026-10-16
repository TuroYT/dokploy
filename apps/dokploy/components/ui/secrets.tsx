import type { CompletionSource } from "@codemirror/autocomplete";
import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { CopyEnvDialog } from "@/components/shared/copy-env-dialog";
import { EnvEditor } from "@/components/shared/env-editor";
import { VaultImportDialog } from "@/components/shared/vault-import-dialog";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form";

interface Props {
	name: string;
	title: string;
	description: ReactNode;
	placeholder: string;
	completionSource?: CompletionSource;
	projectId?: string;
	environmentId?: string;
	serviceId?: string;
}

export const Secrets = (props: Props) => {
	const form = useFormContext<Record<string, string>>();

	return (
		<>
			<CardHeader className="flex flex-row w-full items-center justify-between px-0">
				<div>
					<CardTitle className="text-xl">{props.title}</CardTitle>
					<CardDescription>{props.description}</CardDescription>
				</div>

				<div className="flex items-center gap-2">
					<CopyEnvDialog
						projectId={props.serviceId && props.projectId}
						serviceId={props.serviceId}
						currentEnv={form.watch(props.name) ?? ""}
						onImport={(next) =>
							form.setValue(props.name, next, { shouldDirty: true })
						}
					/>
					<VaultImportDialog
						projectId={props.projectId}
						environmentId={props.environmentId}
						currentEnv={form.watch(props.name) ?? ""}
						onImport={(next) =>
							form.setValue(props.name, next, { shouldDirty: true })
						}
					/>
				</div>
			</CardHeader>
			<CardContent className="w-full space-y-4 p-0">
				<FormField
					control={form.control}
					name={props.name}
					render={({ field }) => (
						<FormItem className="w-full">
							<FormControl>
								<EnvEditor
									value={field.value}
									onChange={field.onChange}
									completionSource={props.completionSource}
									placeholder={props.placeholder}
									className="h-96 font-mono"
								/>
							</FormControl>

							<FormMessage />
						</FormItem>
					)}
				/>
			</CardContent>
		</>
	);
};
