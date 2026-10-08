import * as React from "react";
import { getAppName, getDefaultAccentColor } from "@/lib/app-settings";
import { AccentRoot } from "@/components/theme-accent";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const appName = await getAppName();
  return { title: `${appName} — Sign in` };
}

export default async function LoginPage() {
  const [appName, accent] = await Promise.all([getAppName(), getDefaultAccentColor()]);
  return (
    <>
      <AccentRoot accent={accent} />
      <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-800" />}>
        <LoginForm appName={appName} />
      </React.Suspense>
    </>
  );
}
