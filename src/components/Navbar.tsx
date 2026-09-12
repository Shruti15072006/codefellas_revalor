import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { supabase } from "../lib/supabase";

function Navbar() {
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Try to get name from user metadata
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";

        setUserName(name);
      }
    };

    getUser();
  }, []);

  const avatarLetter = userName.charAt(0).toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar-logo">
        <span className="logo-mark">R</span>
        <span>REVALOR</span>
      </div>

      <div className="navbar-actions">
        <div className="profile-button">
          <span className="profile-avatar">{avatarLetter}</span>

          <span className="profile-name">{userName}</span>

          <User size={16} />
        </div>
      </div>
    </header>
  );
}

export default Navbar;
