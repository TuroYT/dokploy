import { ArrowUpCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";

interface Props {
	applicationId: string;
	projectId: string;
	environmentId: string;
}

export const PromoteApplication = ({
	applicationId,
	projectId,
	environmentId,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [targetId, setTargetId] = useState<string>();
	const { data: environments } = api.environment.byProjectId.useQuery(
		{ projectId },
		{ enabled: isOpen },
	);
	const promote = api.application.promote.useMutation();
	const deploy = api.application.deploy.useMutation();

	const targets = (environments ?? [])
		.filter((env) => env.environmentId !== environmentId)
		.flatMap((env) =>
			env.applications.map((app) => ({
				id: app.applicationId,
				label: `${env.name} / ${app.name}`,
			})),
		);

	const handlePromote = async () => {
		if (!targetId) return;
		try {
			const image = await promote.mutateAsync({
				applicationId,
				targetApplicationId: targetId,
			});
			await deploy.mutateAsync({
				applicationId: targetId,
				title: "Promotion",
				description: image,
			});
			toast.success("Promotion queued", { description: image });
			setIsOpen(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Promotion failed");
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" className="col-span-2 md:col-span-1">
					<ArrowUpCircle className="size-4 mr-1" />
					Promote
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Promote this build</DialogTitle>
					<DialogDescription>
						Deploys the exact image running here (pinned by digest) to another
						environment, without rebuilding it.
					</DialogDescription>
				</DialogHeader>
				<Select value={targetId} onValueChange={setTargetId}>
					<SelectTrigger>
						<SelectValue placeholder="Select the target application" />
					</SelectTrigger>
					<SelectContent>
						{targets.map((t) => (
							<SelectItem key={t.id} value={t.id}>
								{t.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<AlertBlock type="warning">
					The target switches to the "Docker" source with this image and its
					autodeploy from Git stops. Its environment variables are kept. You can
					switch the source back in General → Provider.
				</AlertBlock>
				<DialogFooter>
					<Button
						onClick={handlePromote}
						disabled={!targetId}
						isLoading={promote.isPending || deploy.isPending}
					>
						Promote and deploy
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
