import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { apiGet, apiPost, type ApiTx, type Me } from "@/lib/api";
import { formatAccountNumber, formatBRL, parseBRLToCents } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  LandmarkIcon,
  LogOutIcon,
  WalletIcon,
} from "lucide-react";

const DEMO_ACCOUNTS = [
  { accountNumber: "0000123450", label: "Conta Demo 1" },
  { accountNumber: "1234567890", label: "Conta Demo 2" },
];

async function depositAction(formData: FormData) {
  "use server";
  const raw = String(formData.get("amount") ?? "");
  const cents = parseBRLToCents(raw);
  if (!cents) {
    redirect("/?error=invalid");
  }
  const { status } = await apiPost<unknown>("/accounts/me/deposit", {
    amountCents: cents!.toString(),
  });
  if (status !== 200) {
    redirect(`/?error=deposit-${status}`);
  }
  revalidatePath("/");
  redirect("/?ok=deposit");
}

async function withdrawAction(formData: FormData) {
  "use server";
  const raw = String(formData.get("amount") ?? "");
  const cents = parseBRLToCents(raw);
  if (!cents) {
    redirect("/?error=invalid");
  }
  const { status, data } = await apiPost<{ error?: string }>(
    "/accounts/me/withdraw",
    { amountCents: cents!.toString() },
  );
  if (status === 409 || data?.error === "INSUFFICIENT_FUNDS") {
    redirect("/?error=insufficient");
  }
  if (status !== 200) {
    redirect(`/?error=withdraw-${status}`);
  }
  revalidatePath("/");
  redirect("/?ok=withdraw");
}

async function logoutAction() {
  "use server";
  await apiPost<unknown>("/auth/logout", {});
  const c = await cookies();
  c.delete("zbank_session");
  redirect("/login");
}

async function switchAccountAction(formData: FormData) {
  "use server";
  const accountNumber = String(formData.get("accountNumber") ?? "");
  await apiPost<unknown>("/auth/logout", {});
  const c = await cookies();
  c.delete("zbank_session");
  redirect(`/login?account=${encodeURIComponent(accountNumber)}`);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const meResp = await apiGet<Me>("/accounts/me");
  if (meResp.status === 401 || !meResp.data) {
    redirect("/login");
  }
  const me = meResp.data!;
  const txsResp = await apiGet<{ transactions: ApiTx[] }>(
    "/accounts/me/transactions?limit=20",
  );
  const txs = txsResp.data?.transactions ?? [];

  const banner = sp.error
    ? errorMessage(sp.error)
    : sp.ok
      ? successMessage(sp.ok)
      : null;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-72 flex-col border-r border-[--color-border] bg-[--color-card] p-4 gap-4">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="size-9 rounded-md bg-[--color-primary] text-[--color-primary-foreground] flex items-center justify-center">
            <LandmarkIcon className="size-5" />
          </div>
          <div>
            <p className="font-semibold leading-tight">zBank</p>
            <p className="text-xs text-[--color-muted-foreground]">Caixa eletrônico</p>
          </div>
        </div>

        <div>
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-[--color-muted-foreground]">
            Conta atual
          </p>
          <div className="mt-2 rounded-md border border-[--color-border] p-3">
            <p className="text-sm font-medium">{me.ownerName}</p>
            <p className="font-mono text-xs text-[--color-muted-foreground]">
              {formatAccountNumber(me.accountNumber)}
            </p>
          </div>
        </div>

        <div className="flex-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-[--color-muted-foreground]">
            Trocar conta
          </p>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.accountNumber}>
                <form action={switchAccountAction}>
                  <input type="hidden" name="accountNumber" value={a.accountNumber} />
                  <button
                    type="submit"
                    disabled={a.accountNumber === me.accountNumber}
                    className="w-full text-left rounded-md px-2 py-2 text-sm hover:bg-[--color-muted] disabled:opacity-40 disabled:bg-[--color-muted]"
                  >
                    <span className="block font-medium">{a.label}</span>
                    <span className="block font-mono text-xs text-[--color-muted-foreground]">
                      {formatAccountNumber(a.accountNumber)}
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>

        <form action={logoutAction}>
          <Button variant="outline" type="submit" className="w-full">
            <LogOutIcon className="size-4" />
            Sair
          </Button>
        </form>
      </aside>

      <main className="flex-1 p-6 lg:p-10 space-y-6 bg-[--color-muted]">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Olá, {me.ownerName}</h1>
            <p className="text-sm text-[--color-muted-foreground]">
              Conta {formatAccountNumber(me.accountNumber)}
            </p>
          </div>
        </header>

        {banner}

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <WalletIcon className="size-4" /> Saldo atual
              </CardDescription>
              <CardTitle className="text-3xl">{formatBRL(me.balanceCents)}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownCircleIcon className="size-4 text-[--color-success]" />
                Depósito
              </CardTitle>
              <CardDescription>Adicione fundos à sua conta</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={depositAction} className="grid gap-3">
                <Label htmlFor="dep-amount">Valor</Label>
                <Input
                  id="dep-amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  required
                />
                <Button type="submit">Depositar</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpCircleIcon className="size-4 text-[--color-destructive]" />
                Saque
              </CardTitle>
              <CardDescription>Retire fundos da sua conta</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={withdrawAction} className="grid gap-3">
                <Label htmlFor="wd-amount">Valor</Label>
                <Input
                  id="wd-amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  required
                />
                <Button type="submit" variant="outline">
                  Sacar
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de transações</CardTitle>
            <CardDescription>Últimas {txs.length} operações</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {txs.length === 0 ? (
              <p className="p-6 text-sm text-[--color-muted-foreground]">
                Nenhuma transação ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo após</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(t.createdAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            t.type === "DEPOSIT"
                              ? "text-[--color-success] font-medium"
                              : "text-[--color-destructive] font-medium"
                          }
                        >
                          {t.type === "DEPOSIT" ? "Depósito" : "Saque"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {t.type === "DEPOSIT" ? "+" : "−"}
                        {formatBRL(t.amountCents)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBRL(t.balanceAfterCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function errorMessage(code: string) {
  const map: Record<string, string> = {
    invalid: "Valor inválido.",
    insufficient: "Saldo insuficiente para este saque.",
  };
  const text = map[code] ?? "Operação falhou.";
  return (
    <div className="rounded-md border border-[--color-destructive] bg-[--color-destructive]/10 px-4 py-2 text-sm text-[--color-destructive]">
      {text}
    </div>
  );
}

function successMessage(code: string) {
  const map: Record<string, string> = {
    deposit: "Depósito realizado com sucesso.",
    withdraw: "Saque realizado com sucesso.",
  };
  const text = map[code] ?? "Operação concluída.";
  return (
    <div className="rounded-md border border-[--color-success] bg-[--color-success]/10 px-4 py-2 text-sm text-[--color-success]">
      {text}
    </div>
  );
}
