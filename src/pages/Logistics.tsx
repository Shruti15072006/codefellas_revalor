import { useEffect, useState } from "react";
import { Handshake } from "lucide-react";
import { supabase } from "../lib/supabase";

type LogisticsTransaction = {
  id: string;
  listing_id: string;
  requirement_id: string | null;
  match_score: number | null;
  status: "pending" | "pickup_assigned" | "completed";
  estimated_distance_km: number | null;
  estimated_transport_cost: number | null;
  estimated_transport_emissions_kg: number | null;
  estimated_co2_saved_kg: number | null;
  created_at: string;

  listings: {
    material_type: string;
    quantity: number;
    unit: string;
    grade: "A" | "B" | "C";
    price: number;
  } | null;
};

function Logistics() {
  const [transactions, setTransactions] = useState<LogisticsTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadPickups();
  }, []);

  async function loadPickups() {
    setLoading(true);
    setMessage("");

    try {
      // Get logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("Please log in to view logistics pickups.");
        return;
      }

      // Load transactions that have reached the logistics stage.
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id,
          listing_id,
          requirement_id,
          match_score,
          status,
          estimated_distance_km,
          estimated_transport_cost,
          estimated_transport_emissions_kg,
          estimated_co2_saved_kg,
          created_at,

          listings (
            material_type,
            quantity,
            unit,
            grade,
            price
          )
        `,
        )
        .eq("status", "pickup_assigned")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Logistics error:", error);
        setMessage(`Could not load pickups: ${error.message}`);
        return;
      }

      const formattedTransactions: LogisticsTransaction[] = (data ?? []).map(
        (item) => ({
          id: item.id,
          listing_id: item.listing_id,
          requirement_id: item.requirement_id,
          match_score: item.match_score,
          status: item.status as "pending" | "pickup_assigned" | "completed",
          estimated_distance_km: item.estimated_distance_km,
          estimated_transport_cost: item.estimated_transport_cost,
          estimated_transport_emissions_kg:
            item.estimated_transport_emissions_kg,
          estimated_co2_saved_kg: item.estimated_co2_saved_kg,
          created_at: item.created_at,

          listings: Array.isArray(item.listings)
            ? (item.listings[0] ?? null)
            : (item.listings ?? null),
        }),
      );

      setTransactions(formattedTransactions);
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while loading logistics pickups.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompletePickup(transaction: LogisticsTransaction) {
    setProcessingId(transaction.id);
    setMessage("");

    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", transaction.id)
        .eq("status", "pickup_assigned");

      if (error) {
        console.error("Complete pickup error:", error);

        setMessage(`Could not complete pickup: ${error.message}`);
        return;
      }

      setMessage(
        "Pickup completed successfully. Transaction is now completed.",
      );

      await loadPickups();
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while completing the pickup.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="logistics-page">
      <div className="page-header">
        <p className="eyebrow">LOGISTICS WORKFLOW</p>

        <h1>Pickup Assignments</h1>

        <p className="page-subtitle">
          Manage material pickups and complete active transactions.
        </p>
      </div>

      {message && <div className="form-message">{message}</div>}

      {loading ? (
        <p>Loading pickup assignments...</p>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <h2>No active pickups</h2>

          <p>
            Accepted transaction requests will appear here when a pickup is
            assigned.
          </p>
        </div>
      ) : (
        <div className="logistics-list">
          {transactions.map((transaction) => (
            <div className="logistics-card" key={transaction.id}>
              <div className="logistics-card-header">
                <div>
                  <p className="listing-material">
                    {transaction.listings?.material_type ?? "Material"}
                  </p>

                  <p className="match-quantity">
                    {transaction.listings?.quantity ?? "—"}{" "}
                    {transaction.listings?.unit ?? "kg"}
                  </p>
                </div>

                <div className="request-score">
                  <span>Match Score</span>

                  <strong>{transaction.match_score ?? 0}</strong>
                </div>
              </div>

              <div className="transaction-details">
                <div>
                  <span>Grade</span>

                  <strong>
                    {transaction.listings?.grade
                      ? `Grade ${transaction.listings.grade}`
                      : "N/A"}
                  </strong>
                </div>

                <div>
                  <span>Distance</span>

                  <strong>
                    {transaction.estimated_distance_km !== null
                      ? `${transaction.estimated_distance_km} km`
                      : "N/A"}
                  </strong>
                </div>

                <div>
                  <span>Transport Cost</span>

                  <strong>
                    {transaction.estimated_transport_cost !== null
                      ? `₹${transaction.estimated_transport_cost}`
                      : "N/A"}
                  </strong>
                </div>

                <div>
                  <span>Transport CO₂</span>

                  <strong>
                    {transaction.estimated_transport_emissions_kg !== null
                      ? `${transaction.estimated_transport_emissions_kg} kg`
                      : "N/A"}
                  </strong>
                </div>

                <div>
                  <span>CO₂ Saved</span>

                  <strong>
                    {transaction.estimated_co2_saved_kg !== null
                      ? `${transaction.estimated_co2_saved_kg} kg`
                      : "N/A"}
                  </strong>
                </div>

                <div>
                  <span>Status</span>

                  <strong className="status-pickup_assigned">
                    Pickup Assigned
                  </strong>
                </div>
              </div>

              <div className="logistics-card-footer">
                <small>Transaction ID: {transaction.id}</small>

                <button
                  type="button"
                  className="primary-button"
                  disabled={processingId === transaction.id}
                  onClick={() => handleCompletePickup(transaction)}
                >
                  {processingId === transaction.id
                    ? "Completing..."
                    : "Complete Pickup"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Logistics;
