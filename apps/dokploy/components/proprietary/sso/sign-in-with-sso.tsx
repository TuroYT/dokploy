"use client";

import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, LogIn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { api } from "@/utils/api";

const ssoEmailSchema = z.object({
	email: z
		.string()
		.min(1, "Enter your work email")
		.email("Enter a valid email address")
		.transform((v) => v.trim()),
});

type SSOEmailForm = z.infer<typeof ssoEmailSchema>;

interface SignInWithSSOProps {
	/** Content shown when SSO is collapsed (e.g. email/password form) */
	children?: React.ReactNode;
	/** When true, SSO is the only option — no fallback to email/password */
	enforce?: boolean;
}

export function SignInWithSSO({
	children,
	enforce = false,
}: SignInWithSSOProps) {
	const [expanded, setExpanded] = useState(false);
	const [pendingProvider, setPendingProvider] = useState<string | null>(null);
	const { data: providers } = api.sso.loginProviders.useQuery();

	const form = useForm<SSOEmailForm>({
		resolver: zodResolver(ssoEmailSchema),
		defaultValues: { email: "" },
	});

	const signIn = async (target: { email: string } | { providerId: string }) => {
		try {
			const { data, error } = await authClient.signIn.sso({
				...target,
				callbackURL: "/dashboard/home",
				errorCallbackURL: "/",
			});
			if (error) {
				toast.error(error.message ?? "Failed to sign in with SSO");
				return;
			}
			if (data?.url) {
				window.location.href = data.url;
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to sign in with SSO",
			);
		}
	};

	const onSubmit = (values: SSOEmailForm) => signIn(values);

	const signInWithProvider = async (providerId: string) => {
		setPendingProvider(providerId);
		await signIn({ providerId });
		setPendingProvider(null);
	};

	if (providers && providers.length > 0) {
		return (
			<div className="mb-4 space-y-2">
				{providers.map(({ providerId }) => (
					<Button
						key={providerId}
						type="button"
						variant="outline"
						className="w-full"
						disabled={pendingProvider !== null}
						onClick={() => signInWithProvider(providerId)}
					>
						{pendingProvider === providerId ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : (
							<LogIn className="mr-2 size-4" />
						)}
						{providers.length === 1
							? "Sign in with SSO"
							: `Sign in with ${providerId}`}
					</Button>
				))}
				{!enforce && children}
			</div>
		);
	}

	if (!expanded) {
		return (
			<div className="mb-4 space-y-2">
				<Button
					type="button"
					variant="outline"
					className="w-full"
					onClick={() => setExpanded(true)}
				>
					<LogIn className="mr-2 size-4" />
					Sign in with SSO
				</Button>
				{!enforce && children}
			</div>
		);
	}

	return (
		<div className="mb-4 space-y-2">
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormControl>
									<div className="flex gap-2">
										<Input
											type="email"
											placeholder="you@company.com"
											className="flex-1"
											autoComplete="email"
											disabled={form.formState.isSubmitting}
											{...field}
										/>
										<Button
											type="submit"
											variant="outline"
											disabled={form.formState.isSubmitting}
										>
											{form.formState.isSubmitting ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												"Continue"
											)}
										</Button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					{!enforce && (
						<button
							type="button"
							onClick={() => setExpanded(false)}
							className="text-xs text-muted-foreground hover:underline"
						>
							Use email and password instead
						</button>
					)}
				</form>
			</Form>
		</div>
	);
}
