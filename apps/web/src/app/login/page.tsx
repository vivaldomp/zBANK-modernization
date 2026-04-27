import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LandmarkIcon } from "lucide-react";

const API = process.env.INTERNAL_API_URL ?? "http://localhost:3001";

async function loginAction(formData: FormData) {
  "use server";
  const accountNumber = String(formData.get("accountNumber") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accountNumber, pin }),
    cache: "no-store",
  });
  if (!r.ok) {
    redirect(`/login?error=1`);
  }
  const set = r.headers.get("set-cookie") ?? "";
  const match = set.match(/zbank_session=([^;]+)/);
  if (match) {
    const c = await cookies();
    c.set("zbank_session", match[1]!, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30,
    });
  }
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; account?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[--color-muted]">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="size-12 rounded-full bg-[--color-primary] text-[--color-primary-foreground] flex items-center justify-center mb-2">
            <LandmarkIcon className="size-6" />
          </div>
          <CardTitle className="text-2xl">zBank</CardTitle>
          <CardDescription>Caixa eletrônico modernizado</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="accountNumber">Número da conta</Label>
              <Input
                id="accountNumber"
                name="accountNumber"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                required
                defaultValue={sp.account ?? ""}
                placeholder="0000123450"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                required
                placeholder="••••••••••"
              />
            </div>
            {sp.error && (
              <p className="text-sm text-[--color-destructive]">
                Conta ou PIN inválidos.
              </p>
            )}
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
          <div className="mt-6 rounded-md border border-[--color-border] bg-[--color-muted] p-3 text-xs text-[--color-muted-foreground]">
            <p className="font-medium mb-1">Contas demo:</p>
            <p>0000123450 / 0000001111</p>
            <p>1234567890 / 0000001234</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
