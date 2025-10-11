// Purpose: Simple header; shows link to Accounts.

import { Link } from "react-router-dom";
import { useTelegramAuth } from "../context/TelegramAuthContext";

export default function Header() {
  const { accounts } = useTelegramAuth();

  return (
    <header className="w-full h-12 flex items-center px-4 bg-white shadow">
      <h1 className="text-xl font-bold">UniMessenger</h1>
      <div className="ml-auto flex items-center gap-2">
        <Link to="/accounts" className="px-2 py-1 rounded hover:bg-gray-100">
          Accounts {accounts.length ? `(${accounts.length})` : ""}
        </Link>
      </div>
    </header>
  );
}
