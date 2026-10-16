import { findRegistryByIdWithCredentials } from "@dokploy/server/services/registry";
import { TRPCError } from "@trpc/server";
import { quote } from "shell-quote";
import type { findApplicationById } from "../../services/application";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { getRegistryTag } from "./upload";

// Docker drops "docker.io/" from RepoDigests, so match on the image path and keep the registry host from the tag.
export const pickRepoDigest = (registryTag: string, repoDigests: string[]) => {
	const repository = registryTag.replace(/:[^/:]+$/, "");
	const path = repository.split("/").slice(-2).join("/");
	const digest = repoDigests
		.find((d) => d.split("@")[0]?.endsWith(path))
		?.split("@")[1];
	return digest ? `${repository}@${digest}` : null;
};

// The tag moves with every build, the digest pins the exact image the source runs.
export const resolvePromotionImage = async (
	source: Awaited<ReturnType<typeof findApplicationById>>,
) => {
	if (!source.registry) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Configure a registry on the source application (Advanced → Cluster) and deploy it once, so its image can be shared.",
		});
	}
	const registry = await findRegistryByIdWithCredentials(
		source.registry.registryId,
	);
	const imageName =
		source.sourceType === "docker"
			? source.dockerImage || ""
			: `${source.appName}:latest`;
	const registryTag = getRegistryTag(registry, imageName);
	const command = `docker image inspect ${quote([registryTag])} --format '{{json .RepoDigests}}'`;
	const serverId = source.buildServerId || source.serverId;
	const { stdout } = serverId
		? await execAsyncRemote(serverId, command)
		: await execAsync(command);

	const image = pickRepoDigest(registryTag, JSON.parse(stdout.trim() || "[]"));
	if (!image) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `No pushed image found for ${registryTag}. Deploy the source application first.`,
		});
	}
	return { image, registry };
};
