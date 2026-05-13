import React from "react";

export function SoccerBallIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14.5" fill="#F5F0DF" stroke="#0D2318" strokeWidth="1.25"/>
      {/* Center pentagon */}
      <path d="M16 10 L19.8 12.8 L18.4 17 L13.6 17 L12.2 12.8 Z" fill="#0D2318"/>
      {/* Top patch */}
      <path d="M16 1.8 L19 5.5 L16 10 L13 5.5 Z" fill="#0D2318"/>
      {/* Upper-right patch */}
      <path d="M26.8 8 L29.5 12.5 L26.5 15.5 L22 14 L22.5 9.5 Z" fill="#0D2318"/>
      {/* Lower-right patch */}
      <path d="M28 19.5 L25.5 24 L21.5 25 L19 22 L21.5 18 Z" fill="#0D2318"/>
      {/* Bottom patch */}
      <path d="M19.5 27 L16 30.5 L12.5 27 L13.5 23.5 L18.5 23.5 Z" fill="#0D2318"/>
      {/* Lower-left patch */}
      <path d="M4 19.5 L6.5 24 L10.5 25 L13 22 L10.5 18 Z" fill="#0D2318"/>
      {/* Upper-left patch */}
      <path d="M5.2 8 L2.5 12.5 L5.5 15.5 L10 14 L9.5 9.5 Z" fill="#0D2318"/>
    </svg>
  );
}
