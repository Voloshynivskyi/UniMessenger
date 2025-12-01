// frontend/src/pages/inbox/utils/urlify.tsx

import React from "react";

export function urlify(text: string): (string | React.ReactElement)[] {
  if (!text) return [""];

  // matches:
  // - full URLs (http:// https://)
  // - domain names (example.com / esportfire.com)
  const urlRegex =
    /(https?:\/\/[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/\S*)?)/g;

  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      const href = part.startsWith("http") ? part : `https://${part}`;

      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#2f80ed", textDecoration: "none" }}
        >
          {part}
        </a>
      );
    }

    return part;
  });
}
