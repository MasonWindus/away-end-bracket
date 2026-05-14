import React from "react";
import { TEAM_FLAGS } from "../data/teams";

interface TeamFlagProps {
  code: string;
}

export default function TeamFlag({ code }: TeamFlagProps) {
  const isoCode = TEAM_FLAGS[code];
  if (!isoCode) return null;
  return (
    <span
      className={`fi fi-${isoCode}`}
      style={{ borderRadius: "2px", fontSize: "1em" }}
      aria-hidden="true"
    />
  );
}
