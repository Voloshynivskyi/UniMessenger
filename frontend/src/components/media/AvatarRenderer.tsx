// frontend/src/components/media/AvatarRenderer.tsx
import { useEffect, useState } from "react";

export default function AvatarRenderer({
  accountId,
  photoId,
  size = 36,
}: {
  accountId: string;
  photoId: string | null;
  size?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoId) return;

    const finalUrl = `/api/telegram/avatar/${accountId}/${photoId}`;
    setUrl(finalUrl);
  }, [photoId, accountId]);

  return (
    <img
      src={url || "/default-avatar.png"}
      alt="avatar"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
      }}
    />
  );
}
