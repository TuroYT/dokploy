import { pickRepoDigest } from "@dokploy/server/utils/cluster/promote";
import { describe, expect, it } from "vitest";

describe("pickRepoDigest", () => {
	it("pins the tag to its pushed digest, keeping the registry host", () => {
		expect(
			pickRepoDigest("ghcr.io/acme/api-x1y2:latest", [
				"ghcr.io/acme/other@sha256:bad",
				"ghcr.io/acme/api-x1y2@sha256:abc",
			]),
		).toBe("ghcr.io/acme/api-x1y2@sha256:abc");
	});

	it("matches Docker Hub digests that drop the docker.io prefix", () => {
		expect(
			pickRepoDigest("docker.io/acme/api:latest", ["acme/api@sha256:def"]),
		).toBe("docker.io/acme/api@sha256:def");
	});

	it("returns null when the image was never pushed", () => {
		expect(pickRepoDigest("acme/api:latest", [])).toBeNull();
	});
});
