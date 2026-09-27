import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createOrder, CheckoutError, MAX_TICKETS_PER_ORDER } from "@/lib/orders";
import { isValidCpfCnpj, isValidMobile } from "@/lib/documents";
import { isInstallmentCount, type InstallmentCount } from "@/lib/money";

// Mensagem em português também quando o campo nem vem no corpo.
const req = (label: string) => ({ error: `Informe ${label}` });

const schema = z.object({
  slug: z.string().min(1),
  items: z
    .array(
      z.object({
        lotId: z.string().min(1),
        quantity: z.number().int().min(0).max(MAX_TICKETS_PER_ORDER, `Máximo de ${MAX_TICKETS_PER_ORDER} ingressos por compra`),
      }),
      req("os ingressos"),
    )
    .min(1, "Selecione ao menos um ingresso")
    .max(20),
  seatId: z.string().min(1).nullable(),
  buyerName: z
    .string(req("o nome completo"))
    .trim()
    .min(3)
    .max(120)
    .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  buyerEmail: z.email({ error: "E-mail inválido" }).max(160),
  buyerCpfCnpj: z.string(req("o CPF ou CNPJ")).refine(isValidCpfCnpj, "CPF/CNPJ inválido"),
  buyerPhone: z.string(req("o celular com DDD")).refine(isValidMobile, "Celular inválido: use DDD + número"),
  // Aceite obrigatório de Termos + Privacidade; opt-in de marketing opcional (LGPD: nunca pré-marcado).
  acceptTerms: z.literal(true, { error: "Aceite os Termos de uso e a Política de privacidade" }),
  marketingOptIn: z.boolean().optional().default(false),
  method: z.enum(["pix", "credit_card"]),
  installments: z.number().int().refine(isInstallmentCount, "Parcelamento inválido"),
  fbp: z.string().max(200).nullish(),
  fbc: z.string().max(200).nullish(),
  sourceUrl: z.string().max(1000).nullish(),
});

const STATUS: Record<CheckoutError["code"], number> = {
  not_found: 404,
  sold_out: 409,
  seat_taken: 409,
  invalid: 400,
  payment: 502,
};

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos", code: "invalid" }, { status: 400 });
  }
  const input = parsed.data;
  try {
    const result = await createOrder({
      ...input,
      installments: input.installments as InstallmentCount,
      clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
    }
    console.error("[checkout] erro ao criar pedido", err);
    return NextResponse.json({ error: "Erro inesperado. Tente novamente.", code: "invalid" }, { status: 500 });
  }
}
