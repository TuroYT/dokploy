import {
	parseResourceUsage,
	uptimeTransition,
} from "@dokploy/server/utils/watchdog";
import { describe, expect, it } from "vitest";

describe("uptimeTransition", () => {
	it("waits for a second failure before marking down", () => {
		expect(uptimeTransition("up", 1)).toBeNull();
		expect(uptimeTransition("up", 2)).toEqual({ status: "down", notify: true });
		expect(uptimeTransition("down", 3)).toBeNull();
	});

	it("notifies recovery but not the very first successful check", () => {
		expect(uptimeTransition("down", 0)).toEqual({ status: "up", notify: true });
		expect(uptimeTransition(null, 0)).toEqual({ status: "up", notify: false });
		expect(uptimeTransition("up", 0)).toBeNull();
	});

	it("alerts when a newly monitored domain is already down", () => {
		expect(uptimeTransition(null, 2)).toEqual({ status: "down", notify: true });
	});
});

describe("parseResourceUsage", () => {
	it("turns load average into a CPU percentage", () => {
		expect(parseResourceUsage("4 3.6 42.5 91\n")).toEqual({
			CPU: 90,
			Memory: 42.5,
			Disk: 91,
		});
	});

	it("rejects incomplete output", () => {
		expect(parseResourceUsage("")).toBeNull();
		expect(parseResourceUsage("4 1.2")).toBeNull();
	});
});
