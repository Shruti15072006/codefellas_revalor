import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    if (!email || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);
        setMessage(error.message);
        return;
      }

      setMessage("Login successful!");

      // Go to dashboard after successful login
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while logging in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="page-header">
        <p className="eyebrow">RECRATE</p>

        <h1>Welcome Back</h1>

        <p className="page-subtitle">
          Log in to manage your materials and requirements.
        </p>
      </div>

      <form className="login-form" onSubmit={handleLogin}>
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
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {message && <div className="form-message">{message}</div>}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}

export default Login;
