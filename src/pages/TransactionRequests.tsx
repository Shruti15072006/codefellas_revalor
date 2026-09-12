import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Transaction = {
  id: string;
  listing_id: string;
  requirement_id: string | null;
  buyer_id: string;
  match_score: number | null;
  status: "pending" | "pickup_assigned" | "completed";
  estimated_distance_km: number | null;
  estimated_transport_cost: number | null;
  estimated_transport_emissions_kg: number | null;
  estimated_co2_saved_kg: number | null;
  created_at: string;
};

function TransactionRequests() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("Please log in to view transaction requests.");
        return;
      }

      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id,
          listing_id,
          requirement_id,
          buyer_id,
          match_score,
          status,
          estimated_distance_km,
          estimated_transport_cost,
          estimated_transport_emissions_kg,
          estimated_co2_saved_kg,
          created_at
        `,
        )
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Transaction requests error:", error);
        setMessage(`Could not load requests: ${error.message}`);
        return;
      }

      setTransactions(data ?? []);
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while loading requests.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(transaction: Transaction) {
    setProcessingId(transaction.id);
    setMessage("");

    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          status: "pickup_assigned",
        })
        .eq("id", transaction.id)
        .eq("status", "pending");

      if (error) {
        console.error("Accept transaction error:", error);

        setMessage(`Could not accept transaction: ${error.message}`);

        return;
      }

      setMessage("Transaction accepted successfully. Pickup is now assigned.");

      await loadRequests();
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while accepting the request.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="transaction-requests-page">
      <div className="page-header">
        <p className="eyebrow">SELLER WORKFLOW</p>

        <h1>Transaction Requests</h1>

        <p className="page-subtitle">
          Review buyers interested in your listed materials.
        </p>
      </div>

      {message && <div className="form-message">{message}</div>}

      {loading ? (
        <p>Loading transaction requests...</p>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <h2>No transaction requests</h2>

          <p>
            When a buyer claims one of your listings, their request will appear
            here.
          </p>
        </div>
      ) : (
        <div className="transaction-requests-list">
          {transactions.map((transaction) => (
            <div className="transaction-request-card" key={transaction.id}>
              <div className="transaction-request-header">
                <div>
                  <p className="listing-material">Transaction Request</p>

                  <h2>Material Listing</h2>

                  <p className="transaction-id">{transaction.listing_id}</p>
                </div>

                <div className="request-score">
                  <span>Match Score</span>

                  <strong>{transaction.match_score ?? 0}</strong>
                </div>
              </div>

              <div className="transaction-request-details">
                <div>
                  <span>Buyer</span>

                  <strong>{transaction.buyer_id.slice(0, 8)}...</strong>
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
                  <span>CO₂ Saved</span>

                  <strong>
                    {transaction.estimated_co2_saved_kg !== null
                      ? `${transaction.estimated_co2_saved_kg} kg`
                      : "N/A"}
                  </strong>
                </div>

                <div>
                  <span>Status</span>

                  <strong className={`status-${transaction.status}`}>
                    {transaction.status === "pickup_assigned"
                      ? "Pickup Assigned"
                      : transaction.status}
                  </strong>
                </div>
              </div>

              {transaction.status === "pending" && (
                <button
                  type="button"
                  className="primary-button"
                  disabled={processingId === transaction.id}
                  onClick={() => handleAccept(transaction)}
                >
                  {processingId === transaction.id
                    ? "Accepting..."
                    : "Accept Request"}
                </button>
              )}

              {transaction.status === "pickup_assigned" && (
                <div className="accepted-message">
                  <strong>Request accepted</strong>

                  <p>
                    Pickup has been assigned. The transaction is ready for the
                    logistics stage.
                  </p>
                </div>
              )}

              {transaction.status === "completed" && (
                <div className="accepted-message">
                  <strong>Transaction completed</strong>

                  <p>This material transaction has been completed.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TransactionRequests;
