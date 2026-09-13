import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Transaction = {
  id: string;
  listing_id: string;
  requirement_id: string | null;
  match_score: number | null;

  status: "pending" | "pickup_assigned" | "completed";

  estimated_distance_km: number | null;
  estimated_transport_cost: number | null;
  estimated_transport_emissions_kg: number | null;
  estimated_co2_saved_kg: number | null;

  listings: {
    material_type: string;
    quantity: number;
    unit: string;
    quality_grade: "high" | "good" | "low";
    price_per_unit: number;
  } | null;
};

function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadTransactions() {
      setLoading(true);
      setMessage("");

      // ---------------------------------------------
      // 1. GET LOGGED-IN USER
      // ---------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("User error:", userError);
        setMessage("Could not get user information.");
        setLoading(false);
        return;
      }

      if (!user) {
        setMessage("Please log in to view your transactions.");
        setLoading(false);
        return;
      }

      // ---------------------------------------------
      // 2. GET TRANSACTIONS + LISTING INFORMATION
      // ---------------------------------------------

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
          listings (
            material_type,
            quantity,
            unit,
            quality_grade,
            price_per_unit
          )
        `,
        )
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      // ---------------------------------------------
      // 3. CHECK ERROR
      // ---------------------------------------------

      if (error) {
        console.error("Transaction error:", error);
        setMessage(`Could not load transactions: ${error.message}`);
        setLoading(false);
        return;
      }

      // ---------------------------------------------
      // 4. FORMAT DATA
      // ---------------------------------------------

      const formattedTransactions: Transaction[] = (data ?? []).map((item) => ({
        id: item.id,
        listing_id: item.listing_id,
        requirement_id: item.requirement_id,
        match_score: item.match_score,

        status: item.status as "pending" | "pickup_assigned" | "completed",

        estimated_distance_km: item.estimated_distance_km,
        estimated_transport_cost: item.estimated_transport_cost,
        estimated_transport_emissions_kg: item.estimated_transport_emissions_kg,
        estimated_co2_saved_kg: item.estimated_co2_saved_kg,

        listings: Array.isArray(item.listings)
          ? (item.listings[0] ?? null)
          : (item.listings ?? null),
      }));

      setTransactions(formattedTransactions);
      setLoading(false);
    }

    loadTransactions();
  }, []);

  // ---------------------------------------------
  // UI
  // ---------------------------------------------

  return (
    <div className="transactions-page">
      <div className="page-header">
        <p className="eyebrow">MATERIAL MARKETPLACE</p>

        <h1>Transactions</h1>

        <p className="page-subtitle">
          Track your claimed material matches and their progress.
        </p>
      </div>

      {message && <div className="form-message">{message}</div>}

      {loading ? (
        <p>Loading transactions...</p>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <h2>No transactions yet</h2>

          <p>When you claim a match, your transaction will appear here.</p>
        </div>
      ) : (
        <div className="transactions-list">
          {transactions.map((transaction) => (
            <div className="transaction-card" key={transaction.id}>
              {/* ---------------------------------------------
                  TRANSACTION HEADER
              --------------------------------------------- */}

              <div className="transaction-header">
                <div>
                  <p className="listing-material">
                    {transaction.listings?.material_type ?? "Material"}
                  </p>

                  <p className="match-quantity">
                    {transaction.listings?.quantity ?? "—"}{" "}
                    {transaction.listings?.unit ?? "kg"}
                  </p>
                </div>

                <strong>{transaction.match_score ?? 0}% Match</strong>
              </div>

              {/* ---------------------------------------------
                  TRANSACTION DETAILS
              --------------------------------------------- */}

              <div className="transaction-details">
                {/* QUALITY GRADE */}

                <div>
                  <span>Grade</span>

                  <strong>
                    {transaction.listings?.quality_grade
                      ? transaction.listings.quality_grade === "high"
                        ? "Grade A"
                        : transaction.listings.quality_grade === "good"
                          ? "Grade B"
                          : "Grade C"
                      : "N/A"}
                  </strong>
                </div>

                {/* DISTANCE */}

                <div>
                  <span>Distance</span>

                  <strong>
                    {transaction.estimated_distance_km !== null
                      ? `${transaction.estimated_distance_km} km`
                      : "N/A"}
                  </strong>
                </div>

                {/* CO2 SAVED */}

                <div>
                  <span>CO₂ Saved</span>

                  <strong>
                    {transaction.estimated_co2_saved_kg !== null
                      ? `${transaction.estimated_co2_saved_kg} kg`
                      : "N/A"}
                  </strong>
                </div>

                {/* PRICE */}

                <div>
                  <span>Price</span>

                  <strong>
                    {transaction.listings?.price_per_unit === 0
                      ? "Free"
                      : transaction.listings?.price_per_unit != null
                        ? `₹${transaction.listings.price_per_unit}/kg`
                        : "N/A"}
                  </strong>
                </div>

                {/* TRANSPORT COST */}

                <div>
                  <span>Transport Cost</span>

                  <strong>
                    {transaction.estimated_transport_cost !== null
                      ? `₹${transaction.estimated_transport_cost}`
                      : "N/A"}
                  </strong>
                </div>

                {/* STATUS */}

                <div>
                  <span>Status</span>

                  <strong className={`status-${transaction.status}`}>
                    {transaction.status === "pickup_assigned"
                      ? "Pickup Assigned"
                      : transaction.status === "completed"
                        ? "Completed"
                        : "Pending"}
                  </strong>
                </div>
              </div>

              {/* ---------------------------------------------
                  TRANSACTION ID
              --------------------------------------------- */}

              <div className="transaction-id">
                Transaction ID: {transaction.id}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Transactions;
