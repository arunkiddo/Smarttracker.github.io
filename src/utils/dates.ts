import type { DateRange } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toIsoDate(input: unknown): string | undefined {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }

  if (typeof input === "number" && Number.isFinite(input)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + input * DAY_MS).toISOString().slice(0, 10);
  }

  if (typeof input !== "string") {
    return undefined;
  }

  const value = input.trim();
  if (!value) {
    return undefined;
  }

  const numeric = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const yearValue = Number(numeric[3]);
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;
    const date = new Date(Date.UTC(year, month, day));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

export function getDefaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function isWithinRange(date: string, range: DateRange) {
  return date >= range.start && date <= range.end;
}

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00.000Z`).getTime() -
      new Date(`${start}T00:00:00.000Z`).getTime()) /
      DAY_MS,
  );
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
