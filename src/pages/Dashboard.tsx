import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Transaction = {
  id: string;
  buyer_id: string;
  seller_id: string | null;
  match_score: number | null;
  status: "pending" | "pickup_assigned" | "completed";
  estimated_co2_saved_kg: number | null;
  estimated_transport_emissions_kg: number | null;
  estimated_transport_cost: number | null;
  listing_id: string;
  requirement_id: string | null;
};

function Dashboard() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("Please log in to view your dashboard.");
        return;
      }
      // Get user's role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Profile error:", profileError);
        setMessage(`Could not load your profile: ${profileError.message}`);
        return;
      }

      // Logistics users should use the logistics dashboard
      if (profile.role === "logistics") {
        navigate("/logistics", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
    id,
    buyer_id,
    seller_id,
    match_score,
    status,
    estimated_co2_saved_kg,
    estimated_transport_emissions_kg,
    estimated_transport_cost,
    listing_id,
    requirement_id
  `,
        )
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Dashboard error:", error);
        setMessage(`Could not load dashboard: ${error.message}`);
        return;
      }

      setTransactions((data ?? []) as Transaction[]);
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while loading the dashboard.");
    } finally {
      setLoading(false);
    }
  }

  // ==================================================
  // CALCULATE METRICS
  // ==================================================

  const totalTransactions = transactions.length;

  const completedTransactions = transactions.filter(
    (transaction) => transaction.status === "completed",
  ).length;

  const pickupTransactions = transactions.filter(
    (transaction) => transaction.status === "pickup_assigned",
  ).length;

  const pendingTransactions = transactions.filter(
    (transaction) => transaction.status === "pending",
  ).length;

  const totalCo2Saved = transactions.reduce(
    (total, transaction) =>
      total + (Number(transaction.estimated_co2_saved_kg) || 0),
    0,
  );

  const totalTransportEmissions = transactions.reduce(
    (total, transaction) =>
      total + (Number(transaction.estimated_transport_emissions_kg) || 0),
    0,
  );

  const totalTransportCost = transactions.reduce(
    (total, transaction) =>
      total + (Number(transaction.estimated_transport_cost) || 0),
    0,
  );

  const averageMatchScore =
    totalTransactions > 0
      ? transactions.reduce(
          (total, transaction) =>
            total + (Number(transaction.match_score) || 0),
          0,
        ) / totalTransactions
      : 0;

  return (
    <div className="dashboard-page">
      {/* ================================================
          HEADER
      ================================================= */}

      <div className="page-header">
        <p className="eyebrow">CIRCULAR IMPACT</p>

        <h1>Impact Dashboard</h1>

        <p className="page-subtitle">
          Track your material reuse, transactions, and environmental impact.
        </p>
      </div>

      {message && <div className="form-message">{message}</div>}

      {loading ? (
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading impact data...</p>
        </div>
      ) : (
        <>
          {/* ================================================
              MAIN STATS
          ================================================= */}

          <section className="dashboard-stats">
            <div className="dashboard-stat-card">
              <span className="stat-label">Total Transactions</span>

              <strong className="stat-value">{totalTransactions}</strong>

              <small>Material matches claimed</small>
            </div>

            <div className="dashboard-stat-card impact-stat">
              <span className="stat-label">CO₂ Saved</span>

              <strong className="stat-value">
                {totalCo2Saved.toFixed(2)} kg
              </strong>

              <small>Estimated environmental benefit</small>
            </div>

            <div className="dashboard-stat-card">
              <span className="stat-label">Average Match</span>

              <strong className="stat-value">
                {averageMatchScore.toFixed(0)}%
              </strong>

              <small>Compatibility score</small>
            </div>

            <div className="dashboard-stat-card">
              <span className="stat-label">Completed</span>

              <strong className="stat-value">{completedTransactions}</strong>

              <small>Successful circular transactions</small>
            </div>
          </section>

          {/* ================================================
              TRANSACTION STATUS
          ================================================= */}

          <section className="dashboard-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">LIFECYCLE</p>

                <h2>Transaction Status</h2>

                <p>See where your material transactions currently stand.</p>
              </div>
            </div>

            <div className="dashboard-status-grid">
              <div className="dashboard-status-card pending-status">
                <span>Pending</span>

                <strong>{pendingTransactions}</strong>

                <small>Waiting for seller approval</small>
              </div>

              <div className="dashboard-status-card pickup-status">
                <span>Pickup Assigned</span>

                <strong>{pickupTransactions}</strong>

                <small>Ready for logistics</small>
              </div>

              <div className="dashboard-status-card completed-status">
                <span>Completed</span>

                <strong>{completedTransactions}</strong>

                <small>Successfully reused</small>
              </div>
            </div>
          </section>

          {/* ================================================
              ENVIRONMENTAL IMPACT
          ================================================= */}

          <section className="dashboard-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">ENVIRONMENTAL IMPACT</p>

                <h2>Circular Impact</h2>

                <p>
                  Understand the environmental and logistics impact of your
                  transactions.
                </p>
              </div>
            </div>

            <div className="dashboard-impact-grid">
              <div className="dashboard-impact-card">
                <div className="impact-card-top">
                  <span>CO₂ Avoided</span>
                  <span className="impact-symbol">CO₂</span>
                </div>

                <strong>{totalCo2Saved.toFixed(2)} kg</strong>

                <p>
                  Estimated carbon savings from keeping materials in
                  circulation.
                </p>
              </div>

              <div className="dashboard-impact-card">
                <div className="impact-card-top">
                  <span>Transport Emissions</span>
                  <span className="impact-symbol">CO₂</span>
                </div>

                <strong>{totalTransportEmissions.toFixed(2)} kg</strong>

                <p>
                  Estimated emissions associated with transporting matched
                  materials.
                </p>
              </div>

              <div className="dashboard-impact-card">
                <div className="impact-card-top">
                  <span>Transport Cost</span>
                  <span className="impact-symbol">₹</span>
                </div>

                <strong>₹{totalTransportCost.toFixed(2)}</strong>

                <p>Estimated logistics cost across your transactions.</p>
              </div>
            </div>
          </section>

          {/* ================================================
              CIRCULAR PATHWAY
          ================================================= */}

          <section className="dashboard-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">CIRCULAR PATHWAY</p>

                <h2>Keep Materials in Use</h2>

                <p>From surplus material to productive reuse.</p>
              </div>
            </div>

            <div className="pathway-card">
              <div className="pathway-step">
                <span className="pathway-number">01</span>

                <div>
                  <strong>Material Listed</strong>

                  <p>
                    Businesses make surplus and reusable materials available for
                    other businesses.
                  </p>
                </div>
              </div>

              <div className="pathway-line"></div>

              <div className="pathway-step">
                <span className="pathway-number">02</span>

                <div>
                  <strong>Intelligent Match</strong>

                  <p>
                    Materials are matched using compatibility, quantity,
                    quality, distance, cost, and carbon impact.
                  </p>
                </div>
              </div>

              <div className="pathway-line"></div>

              <div className="pathway-step">
                <span className="pathway-number">03</span>

                <div>
                  <strong>Pickup & Reuse</strong>

                  <p>
                    Accepted transactions move through logistics and return
                    materials to productive use.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================
              EMPTY STATE
          ================================================= */}

          {transactions.length === 0 && (
            <div className="empty-state dashboard-empty-state">
              <h2>No transactions yet</h2>

              <p>
                Claim a material match to start tracking your circular impact.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
