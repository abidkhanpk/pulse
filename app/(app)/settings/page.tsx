import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function SettingsPage() {
  const actor = await requireUser();
  const links = [
    { href: "/settings/organization", title: "Organization", desc: "Organization name", perm: "org.manage" as const },
    { href: "/settings/roles", title: "Roles", desc: "Roles and granular permissions", perm: "roles.manage" as const },
  ].filter((l) => hasPermission(actor, l.perm));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="transition-shadow hover:shadow">
              <CardHeader>
                <CardTitle>{l.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">{l.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {links.length === 0 && <p className="text-sm text-slate-500">No settings available for your role.</p>}
      </div>
    </div>
  );
}
