import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MatchCard from "../components/MatchCard";
import type { Match } from "../mock/matches";

type MatchMode =
  | "balanced"
  | "lowest_cost"
  | "lowest_carbon"
  | "fastest_delivery";

type Requirement = {
  id: string;
  material_type: string;
  quantity_needed: number;
  min_grade: "A" | "B" | "C";
  max_budget: number | null;
  max_distance_km: number | null;
};

type ApiMatch = {
  listing_id: string;
  match_score: number;
  distance_km: number;
  carbon_saved_kg: number;
  pathway: "direct_reuse" | "recycling";
  reasons: string[];
  score_breakdown: {
    material: number;
    quantity: number;
    quality: number;
    distance: number;
    price: number | null;
    carbon: number;
  };
};

type Listing = {
  id: string;
  material_type: string;
  quantity: number;
  unit: string;
  grade: "A" | "B" | "C";
  price: number;
};

function Matches() {
  /* =========================================================
     GET REQUIREMENT ID FROM URL
  ========================================================= */

  const { requirementId } = useParams<{
    requirementId: string;
  }>();

  /* =========================================================
     STATE
  ========================================================= */

  const [requirement, setRequirement] =
    useState<Requirement | null>(null);

  const [matches, setMatches] = useState<Match[]>([]);

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);

  const [claimingId, setClaimingId] =
    useState<string | null>(null);

  const [mode, setMode] =
    useState<MatchMode>("balanced");

  /* =========================================================
     LOAD REQUIREMENT + MATCHES
  ========================================================= */

  useEffect(() => {
    async function loadMatches() {
      setLoading(true);
      setMessage("");
      setMatches([]);

      try {
        /* --------------------------------------------------
           1. CHECK REQUIREMENT ID
        -------------------------------------------------- */

        if (!requirementId) {
          setMessage(
            "No requirement selected. Please create a requirement first.",
          );

          return;
        }

        /* --------------------------------------------------
           2. GET CURRENT SESSION
        -------------------------------------------------- */

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          setMessage(
            "Please log in to view your matches.",
          );

          return;
        }

        /* --------------------------------------------------
           3. GET REQUIREMENT
        -------------------------------------------------- */

        const {
          data: requirementData,
          error: requirementError,
        } = await supabase
          .from("requirements")
          .select(
            `
              id,
              material_type,
              quantity_needed,
              min_grade,
              max_budget,
              max_distance_km
            `,
          )
          .eq("id", requirementId)
          .single();

        if (requirementError) {
          console.error(
            "Requirement error:",
            requirementError,
          );

          setMessage(
            `Could not load requirement: ${requirementError.message}`,
          );

          return;
        }

        if (!requirementData) {
          setMessage("Requirement not found.");
          return;
        }

        const currentRequirement =
          requirementData as Requirement;

        setRequirement(currentRequirement);

        /* --------------------------------------------------
           4. CALL MATCHING ENGINE
        -------------------------------------------------- */

        const {
          data,
          error,
        } = await supabase.functions.invoke(
          "match-requirement",
          {
            body: {
              requirement_id: requirementId,
              mode: mode,
            },

            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );

        if (error) {
          console.error(
            "Matching engine error:",
            error,
          );

          let errorDetails = error.message;

          try {
            if ("context" in error && error.context) {
              const response =
                error.context as Response;

              const body =
                await response.text();

              console.error(
                "Edge Function response:",
                body,
              );

              try {
                const parsed =
                  JSON.parse(body);

                errorDetails =
                  parsed.error || body;
              } catch {
                errorDetails =
                  body || error.message;
              }
            }
          } catch (debugError) {
            console.error(
              "Could not read Edge Function error:",
              debugError,
            );
          }

          setMessage(
            `Could not load matches: ${errorDetails}`,
          );

          return;
        }

        console.log(
          "Matching engine response:",
          data,
        );

        /* --------------------------------------------------
           5. GET API MATCHES
        -------------------------------------------------- */

        const apiMatches: ApiMatch[] =
          data?.matches ?? [];

        if (apiMatches.length === 0) {
          setMatches([]);
          return;
        }

        /* --------------------------------------------------
           6. GET ACTUAL LISTING DATA
        -------------------------------------------------- */

        const listingIds =
          apiMatches.map(
            (match) => match.listing_id,
          );

        const {
          data: listingsData,
          error: listingsError,
        } = await supabase
          .from("listings")
          .select(
            `
              id,
              material_type,
              quantity,
              unit,
              grade,
              price
            `,
          )
          .in("id", listingIds);

        if (listingsError) {
          console.error(
            "Listings error:",
            listingsError,
          );

          setMessage(
            `Could not load listing details: ${listingsError.message}`,
          );

          return;
        }

        const listings: Listing[] =
          (listingsData ?? []) as Listing[];

        /* --------------------------------------------------
           7. COMBINE MATCH + LISTING DATA
        -------------------------------------------------- */

        const frontendMatches: Match[] =
          apiMatches
            .map((match) => {
              const listing =
                listings.find(
                  (item) =>
                    item.id ===
                    match.listing_id,
                );

              if (!listing) {
                return null;
              }

              return {
                listing_id:
                  match.listing_id,

                match_score:
                  match.match_score,

                distance_km:
                  match.distance_km,

                carbon_saved_kg:
                  match.carbon_saved_kg,

                pathway:
                  match.pathway,

                reasons:
                  match.reasons,

                score_breakdown:
                  match.score_breakdown,

                materialType:
                  listing.material_type,

                quantity:
                  listing.quantity,

                unit:
                  listing.unit,

                grade:
                  listing.grade,

                price:
                  listing.price,
              };
            })
            .filter(
              (
                match,
              ): match is Match =>
                match !== null,
            );

        console.log(
          "Frontend matches:",
          frontendMatches,
        );

        setMatches(frontendMatches);
      } catch (error) {
        console.error(
          "Matches error:",
          error,
        );

        setMessage(
          "Something went wrong while loading matches.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadMatches();
  }, [mode, requirementId]);

  /* =========================================================
     CLAIM MATCH
  ========================================================= */

  async function handleClaim(match: Match) {
    setMessage("");
    setClaimingId(match.listing_id);

    try {
      /* --------------------------------------------------
         1. GET LOGGED-IN BUYER
      -------------------------------------------------- */

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage(
          "Please log in before claiming a match.",
        );

        return;
      }

      /* --------------------------------------------------
         2. CHECK REQUIREMENT
      -------------------------------------------------- */

      if (!requirement) {
        setMessage(
          "Requirement information is missing.",
        );

        return;
      }

      /* --------------------------------------------------
         3. GET SELLER FROM LISTING
      -------------------------------------------------- */

      const {
        data: listing,
        error: listingError,
      } = await supabase
        .from("listings")
        .select("seller_id")
        .eq("id", match.listing_id)
        .single();

      if (listingError) {
        console.error(
          "Listing error:",
          listingError,
        );

        setMessage(
          `Could not find the seller for this listing: ${listingError.message}`,
        );

        return;
      }

      if (!listing?.seller_id) {
        setMessage(
          "This listing does not have a valid seller.",
        );

        return;
      }

      /* --------------------------------------------------
         4. PREVENT SELF-CLAIM
      -------------------------------------------------- */

      if (listing.seller_id === user.id) {
        setMessage(
          "You cannot claim your own listing.",
        );

        return;
      }

      /* --------------------------------------------------
         5. CHECK EXISTING TRANSACTION
      -------------------------------------------------- */

      const {
        data: existingTransaction,
        error: existingError,
      } = await supabase
        .from("transactions")
        .select("id, status")
        .eq(
          "listing_id",
          match.listing_id,
        )
        .eq(
          "requirement_id",
          requirement.id,
        )
        .eq(
          "buyer_id",
          user.id,
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Existing transaction check error:",
          existingError,
        );

        setMessage(
          `Could not check existing transaction: ${existingError.message}`,
        );

        return;
      }

      if (existingTransaction) {
        setMessage(
          `You have already claimed this match. Current status: ${existingTransaction.status}.`,
        );

        return;
      }

      /* --------------------------------------------------
         6. CREATE TRANSACTION
      -------------------------------------------------- */

      const transactionData = {
        listing_id:
          match.listing_id,

        requirement_id:
          requirement.id,

        seller_id:
          listing.seller_id,

        buyer_id:
          user.id,

        match_score:
          match.match_score,

        status:
          "pending",

        estimated_distance_km:
          match.distance_km,

        estimated_transport_cost:
          null,

        estimated_transport_emissions_kg:
          null,

        estimated_co2_saved_kg:
          match.carbon_saved_kg,
      };

      console.log(
        "Creating transaction:",
        transactionData,
      );

      const {
        error: transactionError,
      } = await supabase
        .from("transactions")
        .insert(
          transactionData,
        );

      if (transactionError) {
        console.error(
          "Transaction creation error:",
          transactionError,
        );

        setMessage(
          `Could not create transaction request: ${transactionError.message}`,
        );

        return;
      }

      /* --------------------------------------------------
         7. SUCCESS
      -------------------------------------------------- */

      setMessage(
        "Match claimed successfully! Transaction request sent to the seller.",
      );
    } catch (error) {
      console.error(
        "Claim error:",
        error,
      );

      setMessage(
        "Something went wrong while claiming the match.",
      );
    } finally {
      setClaimingId(null);
    }
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="matches-page">

      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div className="page-header">
        <p className="eyebrow">
          INTELLIGENT MATCHING
        </p>

        <h1>Your Matches</h1>

        <p className="page-subtitle">
          Find the best materials for your
          requirements.
        </p>
      </div>

      {/* =================================================
          MESSAGE
      ================================================= */}

      {message && (
        <div className="form-message">
          {message}
        </div>
      )}

      {/* =================================================
          LOADING
      ================================================= */}

      {loading ? (
        <div className="matches-loading">
          <div className="loading-spinner" />

          <p>
            Finding the best matches...
          </p>
        </div>
      ) : requirement ? (
        <>
          {/* =============================================
              REQUIREMENT SUMMARY
          ============================================= */}

          <section className="requirement-summary">

            <div className="requirement-item">
              <span>
                Looking for
              </span>

              <strong>
                {requirement.quantity_needed} kg{" "}
                {requirement.material_type}
              </strong>
            </div>

            <div className="requirement-item">
              <span>
                Minimum Grade
              </span>

              <strong>
                Grade {requirement.min_grade}
              </strong>
            </div>

            <div className="requirement-item">
              <span>
                Maximum Distance
              </span>

              <strong>
                {requirement.max_distance_km !==
                null
                  ? `${requirement.max_distance_km} km`
                  : "No limit"}
              </strong>
            </div>

            {requirement.max_budget !==
              null && (
              <div className="requirement-item">
                <span>
                  Maximum Budget
                </span>

                <strong>
                  ₹{requirement.max_budget}
                </strong>
              </div>
            )}

          </section>

          {/* =============================================
              MATCHING PREFERENCE
          ============================================= */}

          <section className="matching-mode-section">

            <div className="matching-mode-header">
              <div>
                <p className="eyebrow">
                  MATCHING ENGINE
                </p>

                <h2>
                  Matching Preference
                </h2>

                <p>
                  Choose how you want the
                  matching engine to rank
                  materials.
                </p>
              </div>
            </div>

            <div className="matching-mode-options">

              <button
                type="button"
                className={
                  mode === "balanced"
                    ? "mode-option active"
                    : "mode-option"
                }
                onClick={() =>
                  setMode("balanced")
                }
              >
                <strong>
                  Balanced
                </strong>

                <span>
                  Best overall match
                </span>
              </button>

              <button
                type="button"
                className={
                  mode === "lowest_cost"
                    ? "mode-option active"
                    : "mode-option"
                }
                onClick={() =>
                  setMode(
                    "lowest_cost",
                  )
                }
              >
                <strong>
                  Lowest Cost
                </strong>

                <span>
                  Prioritize affordable
                  materials
                </span>
              </button>

              <button
                type="button"
                className={
                  mode ===
                  "lowest_carbon"
                    ? "mode-option active"
                    : "mode-option"
                }
                onClick={() =>
                  setMode(
                    "lowest_carbon",
                  )
                }
              >
                <strong>
                  Lowest Carbon
                </strong>

                <span>
                  Prioritize carbon
                  savings
                </span>
              </button>

              <button
                type="button"
                className={
                  mode ===
                  "fastest_delivery"
                    ? "mode-option active"
                    : "mode-option"
                }
                onClick={() =>
                  setMode(
                    "fastest_delivery",
                  )
                }
              >
                <strong>
                  Fastest Delivery
                </strong>

                <span>
                  Prioritize nearby
                  materials
                </span>
              </button>

            </div>
          </section>
        </>
      ) : null}

      {/* =================================================
          MATCH RESULTS
      ================================================= */}

      {!loading && requirement && (
        <section className="matches-results">

          <div className="matches-header">

            <div>
              <p className="eyebrow">
                RECOMMENDED MATERIALS
              </p>

              <h2>
                Best Matches
              </h2>

              <p>
                {matches.length} potential{" "}
                {matches.length === 1
                  ? "match"
                  : "matches"}{" "}
                found
              </p>
            </div>

          </div>

          {matches.length === 0 ? (
            <div className="empty-state">

              <h2>
                No matches found
              </h2>

              <p>
                No compatible materials
                were found for this
                requirement.
              </p>

            </div>
          ) : (
            <div className="matches-list">

              {matches.map(
                (match) => (
                  <MatchCard
                    key={
                      match.listing_id
                    }
                    match={match}
                    onClaim={
                      handleClaim
                    }
                    claiming={
                      claimingId ===
                      match.listing_id
                    }
                  />
                ),
              )}

            </div>
          )}

        </section>
      )}

    </div>
  );
}

export default Matches;
