// Seed: admin + Configurações padrão + LP padrão da Ivangélica ("Ela tem o tino", do ivangelica-checkout.html).
// Idempotente: não altera o que já existe.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  DEFAULT_ACCESS_RULES,
  DEFAULT_CANCELLATION_TEXT,
  DEFAULT_FEE_TEXT,
  DEFAULT_HALF_PRICE_TEXT,
} from "../src/lib/legal-defaults";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const SAMPLE_SLUG = "ivangelica-belo-horizonte-2026-11-20";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 10) throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD (mín. 10 caracteres) no .env");

  // Em produção a senha do seed é temporária: troca obrigatória no primeiro login.
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: process.env.ADMIN_NAME ?? "Admin",
      role: "admin",
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: process.env.NODE_ENV === "production" || process.env.SEED_FORCE_PASSWORD_CHANGE === "1",
    },
  });

  // Evento de exemplo e configurações padrão (SEED_SAMPLE_EVENT=0 desliga).
  if (process.env.SEED_SAMPLE_EVENT === "0") return;

  await db.platformSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      halfPriceText: DEFAULT_HALF_PRICE_TEXT,
      cancellationText: DEFAULT_CANCELLATION_TEXT,
      feeText: DEFAULT_FEE_TEXT,
      homeEventSlug: SAMPLE_SLUG,
    },
  });

  const artist = await db.artist.upsert({
    where: { slug: "ivangelica" },
    update: {},
    create: {
      name: "Ivangélica",
      slug: "ivangelica",
      colors: { primary: "#a72c8f", secondary: "#2b0f34", accent: "#f4c542", background: "#fff3f8" },
      defaultShowName: "Ela tem o tino",
      defaultVslSubtitle:
        "Um show leve, cheio de identificação e muita interação com a plateia. Garanta seu ingresso antes que os lugares acabem.",
    },
  });

  if (await db.event.findUnique({ where: { slug: SAMPLE_SLUG } })) return;

  // LP padrão: sem lugar marcado (padrão da plataforma) e os lotes do HTML original.
  await db.event.create({
    data: {
      artistId: artist.id,
      showName: "Ela tem o tino",
      city: "Belo Horizonte",
      state: "MG",
      venueName: "Teatro Estação BH",
      venueAddress: "Av. do Contorno, 1000 – Centro, Belo Horizonte/MG",
      startsAt: new Date("2026-11-20T20:00:00-03:00"),
      doorsOpenAt: new Date("2026-11-20T19:00:00-03:00"),
      endsAt: new Date("2026-11-20T21:30:00-03:00"),
      slug: SAMPLE_SLUG,
      status: "published",
      publishedAt: new Date(),
      vslHeadline: "Ivangélica está chegando em Belo Horizonte",
      vslSubtitle: artist.defaultVslSubtitle,
      vslCtaLabel: "Quero garantir meu ingresso",
      description:
        'Ivangélica sobe ao palco com "Ela tem o tino", um show de humor leve, cheio de identificação e muita interação com a plateia. Histórias do dia a dia contadas do jeito que só ela sabe. Duração aproximada de 1h30.',
      accessRules: DEFAULT_ACCESS_RULES,
      ageRating: "16",
      ageRatingNote: "Menores de 16 anos só acompanhados dos pais ou de responsável legal.",
      seatingMode: "general",
      ticketLimit: 300,
      wizardStep: 6,
      lots: {
        create: [
          { name: "2º Lote Inteira", category: "inteira", priceCents: 12000, quantity: 180, position: 0 },
          {
            name: "2º Lote Meia-entrada",
            category: "meia",
            description: "Estudantes, pessoas com 60 anos ou mais, PcD e demais beneficiários, com documento na entrada.",
            priceCents: 6000,
            quantity: 80,
            position: 1,
          },
          {
            name: "Ingresso Solidário",
            category: "solidario",
            description: "Obrigatória a doação de 1 L de leite na entrada do evento.",
            priceCents: 7000,
            quantity: 40,
            position: 2,
          },
        ],
      },
    },
  });
}

main()
  .then(() => console.log("Seed concluído."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
