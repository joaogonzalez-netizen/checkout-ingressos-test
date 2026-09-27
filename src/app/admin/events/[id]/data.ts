import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const getEvent = cache(async (id: string) => {
  const event = await db.event.findUnique({
    where: { id },
    include: { artist: true, lots: { orderBy: { position: "asc" } }, seats: true, media: true },
  });
  if (!event) notFound();
  return event;
});
