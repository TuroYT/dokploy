import { RocketIcon } from "lucide-react";
import { toast } from "sonner";
import type { ServiceType } from "@/components/dashboard/application/advanced/show-resources";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { api } from "@/utils/api";

interface Props {
	id: string;
	type: ServiceType | "compose";
	onDeployed: () => void;
}

export const EnvRedeployAlert = ({ id, type, onDeployed }: Props) => {
	// type never changes for a mounted service, so the hook order stays stable.
	const mutationMap = {
		application: () => api.application.deploy.useMutation(),
		compose: () => api.compose.deploy.useMutation(),
		libsql: () => api.libsql.deploy.useMutation(),
		mariadb: () => api.mariadb.deploy.useMutation(),
		mongo: () => api.mongo.deploy.useMutation(),
		mysql: () => api.mysql.deploy.useMutation(),
		postgres: () => api.postgres.deploy.useMutation(),
		redis: () => api.redis.deploy.useMutation(),
	};
	const { mutateAsync, isPending } = mutationMap[type]() as {
		mutateAsync: (input: Record<string, string>) => Promise<unknown>;
		isPending: boolean;
	};

	const deploy = () =>
		mutateAsync({ [`${type}Id`]: id })
			.then(() => {
				toast.success("Deployment queued");
				onDeployed();
			})
			.catch((error) =>
				toast.error(error instanceof Error ? error.message : "Deploy failed"),
			);

	return (
		<AlertBlock type="warning">
			<span className="flex flex-wrap items-center justify-between gap-2">
				Variables saved. The running service keeps the old values until you
				deploy.
				<Button type="button" size="sm" isLoading={isPending} onClick={deploy}>
					<RocketIcon className="mr-1 h-4 w-4" />
					Deploy now
				</Button>
			</span>
		</AlertBlock>
	);
};
