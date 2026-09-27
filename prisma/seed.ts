// Seed de desenvolvimento: admin + Ivangélica + "Ela tem o tino" (dados do ivangelica-checkout.html).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 10) throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD (mín. 10 caracteres) no .env");

  await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Admin", role: "admin", passwordHash: await bcrypt.hash(password, 12) },
  });

  const artist = await db.artist.upsert({
    where: { slug: "ivangelica" },
    update: {},
    create: {
      name: "Ivangélica",
      slug: "ivangelica",
      colors: { primary: "#a72c8f", secondary: "#2b0f34", accent: "#f4c542", background: "#fff3f8" },
      backLinkUrl: "https://example.com/agenda",
      defaultShowName: "Ela tem o tino",
      defaultVslSubtitle:
        "Um show leve, cheio de identificação e muita interação com a plateia. Garanta seu ingresso antes que as poltronas acabem.",
      defaultOgImageUrl: "https://placehold.co/1200x630/2b0f34/fff3f8.png?text=Ela+tem+o+tino",
    },
  });

  const slug = "ivangelica-belo-horizonte-2026-11-20";
  if (await db.event.findUnique({ where: { slug } })) return;

  const event = await db.event.create({
    data: {
      artistId: artist.id,
      showName: "Ela tem o tino",
      city: "Belo Horizonte",
      state: "MG",
      venueName: "Teatro Estação BH",
      venueAddress: "Av. do Contorno, 1000 – Centro, Belo Horizonte/MG",
      startsAt: new Date("2026-11-20T20:00:00-03:00"),
      doorsOpenAt: new Date("2026-11-20T19:00:00-03:00"),
      slug,
      status: "published",
      publishedAt: new Date(),
      vslHeadline: "Ivangélica está chegando em Belo Horizonte",
      vslSubtitle: artist.defaultVslSubtitle,
      vslCtaLabel: "Quero garantir meu ingresso",
      seatingMode: "seated",
      seatRows: 8,
      seatsPerRow: 10,
      wizardStep: 6,
      lots: {
        create: [
          { name: "2º Lote Inteira", category: "inteira", priceCents: 12000, quantity: 50, position: 0 },
          { name: "2º Lote Meia-entrada", category: "meia", priceCents: 6000, quantity: 20, position: 1 },
          { name: "Ingresso Solidário", category: "solidario", priceCents: 7000, quantity: 10, position: 2 },
        ],
      },
    },
  });

  const blocked = new Set(["A1", "A10", "H5", "H6"]);
  const seats = [];
  for (const row of "ABCDEFGH") {
    for (let n = 1; n <= 10; n++) {
      seats.push({ eventId: event.id, row, number: n, status: blocked.has(`${row}${n}`) ? ("blocked" as const) : ("available" as const) });
    }
  }
  await db.seat.createMany({ data: seats });
}

main()
  .then(() => console.log("Seed concluído."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
