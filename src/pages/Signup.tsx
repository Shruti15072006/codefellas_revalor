import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

function Signup() {
  const [businessName, setBusinessName] = useState("");
  const [role, setRole] = useState("manufacturer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    if (!businessName || !email || !password) {
      setMessage("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create Supabase Auth account
      const {
        data: { user },
        error: signupError,
      } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signupError) {
        setMessage(signupError.message);
        return;
      }

      if (!user) {
        setMessage("Could not create account.");
        return;
      }

      // 2. Make sure the user has an active session
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        console.error("Login after signup error:", loginError);
        setMessage(
          `Account created, but automatic login failed: ${loginError.message}`,
        );
        return;
      }

      // 3. Create profile for this user
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        business_name: businessName,
        role,
      });

      if (profileError) {
        console.error("Profile error:", profileError);
        setMessage(
          `Account created, but profile creation failed: ${profileError.message}`,
        );
        return;
      }

      setMessage("Account created successfully!");

      // Clear form
      setBusinessName("");
      setEmail("");
      setPassword("");
      setRole("manufacturer");
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while creating your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signup-page">
      <div className="page-header">
        <p className="eyebrow">Revalor</p>

        <h1>Create Account</h1>

        <p className="page-subtitle">
          Join the circular materials marketplace.
        </p>
      </div>

      <form className="signup-form" onSubmit={handleSignup}>
        <div className="form-group">
          <label>Business Name</label>

          <input
            type="text"
            placeholder="Your business name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Business Role</label>

          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="manufacturer">Manufacturer</option>
            <option value="retailer">Retailer</option>
            <option value="recycler">Recycler</option>
            <option value="logistics">Logistics</option>
          </select>
        </div>

        <div className="form-group">
          <label>Email</label>

          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Password</label>

          <input
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {message && <div className="form-message">{message}</div>}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

export default Signup;
