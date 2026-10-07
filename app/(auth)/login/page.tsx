import * as React from "react";
import { getAppName } from "@/lib/app-settings";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const appName = await getAppName();
  return { title: `${appName} — Sign in` };
}

export default async function LoginPage() {
  const appName = await getAppName();
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-800" />}>
      <LoginForm appName={appName} />
    </React.Suspense>
  );
}
