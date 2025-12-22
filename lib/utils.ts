import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TOGETHER_LINK =
  "https://togetherai.link/?utm_source=make-comics&utm_medium=referral&utm_campaign=example-app";
