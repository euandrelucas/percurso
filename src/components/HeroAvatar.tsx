"use client";
import { useCallback } from "react";
import { Avatar } from "./Avatar";
import { AVATAR_DEFAULT } from "@/lib/prompts/options";

const AVATAR = { ...AVATAR_DEFAULT, hair: "hair-long", hairColor: "#5a3a22", accent: "#0d9488" };

/** Avatar da landing: "fala" em rajadas, simulando uma conversa. */
export function HeroAvatar() {
  const getLevel = useCallback(() => {
    const t = performance.now() / 1000;
    const phrase = Math.sin(t * 0.7) > -0.2; // alterna entre falar e ouvir
    if (!phrase) return 0;
    return Math.max(0, (Math.sin(t * 9) * 0.5 + 0.5) * (0.35 + 0.35 * Math.sin(t * 2.1) ** 2));
  }, []);
  return <Avatar avatar={AVATAR} getLevel={getLevel} className="w-full h-full" />;
}
