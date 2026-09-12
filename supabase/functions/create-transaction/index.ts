import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Used only to verify the caller's identity from their token.
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Used for the actual reads/writes — bypasses RLS since a buyer
// needs to update a listing they don't own (flip it to "matched").
// Ownership/status checks below are done manually instead.
const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Only POST requests are allowed." },
      405,
    );
  }

  try {
    // ==================================================
    // AUTH
    // ==================================================

    const authorizationHeader = request.headers.get("Authorization");

    if (!authorizationHeader) {
      return jsonResponse(
        { success: false, error: "Missing Authorization header." },
        401,
      );
    }

    const token = authorizationHeader.replace("Bearer ", "").trim();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized." }, 401);
    }

    // ==================================================
    // INPUT
    // ==================================================

    const body = await request.json();

    const listingId = body?.listing_id;
    const requirementId = body?.requirement_id;

    // Optional — pass these straight from the match result the
    // frontend already has, so we don't recompute them here.
    const matchScore = body?.match_score ?? null;
    const distanceKm = body?.distance_km ?? null;
    const carbonSavedKg = body?.carbon_saved_kg ?? null;

    if (!listingId || !requirementId) {
      return jsonResponse(
        {
          success: false,
          error: "listing_id and requirement_id are both required.",
        },
        400,
      );
    }

    // ==================================================
    // FETCH + VALIDATE REQUIREMENT
    // ==================================================

    const { data: requirement, error: requirementError } =
      await adminSupabase
        .from("requirements")
        .select("*")
        .eq("id", requirementId)
        .maybeSingle();

    if (requirementError) {
      return jsonResponse(
        { success: false, error: requirementError.message },
        500,
      );
    }

    if (!requirement) {
      return jsonResponse(
        { success: false, error: "Requirement not found." },
        404,
      );
    }

    // Only the buyer who owns the requirement can turn a match
    // into a transaction.
    if (requirement.user_id !== user.id) {
      return jsonResponse(
        {
          success: false,
          error: "You do not have permission to act on this requirement.",
        },
        403,
      );
    }

    if (requirement.status !== "open") {
      return jsonResponse(
        {
          success: false,
          error: "This requirement is no longer open.",
        },
        400,
      );
    }

    // ==================================================
    // FETCH + VALIDATE LISTING
    // ==================================================

    const { data: listing, error: listingError } = await adminSupabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) {
      return jsonResponse(
        { success: false, error: listingError.message },
        500,
      );
    }

    if (!listing) {
      return jsonResponse(
        { success: false, error: "Listing not found." },
        404,
      );
    }

    if (listing.status !== "available") {
      return jsonResponse(
        {
          success: false,
          error: "This listing is no longer available.",
        },
        400,
      );
    }

    // ==================================================
    // CREATE TRANSACTION
    //
    // NOTE: per hackathon scope, a claimed listing is treated as
    // fully consumed — no partial-stock tracking.
    // ==================================================

    const { data: transaction, error: transactionError } =
      await adminSupabase
        .from("transactions")
        .insert({
          listing_id: listing.id,
          requirement_id: requirement.id,
          seller_id: listing.user_id,
          buyer_id: requirement.user_id,
          match_score: matchScore,
          status: "pending",
          estimated_distance_km: distanceKm,
          estimated_co2_saved_kg: carbonSavedKg,
        })
        .select()
        .single();

    if (transactionError) {
      return jsonResponse(
        { success: false, error: transactionError.message },
        500,
      );
    }

    // ==================================================
    // FLIP LISTING + REQUIREMENT TO "matched"
    // ==================================================

    const { error: listingUpdateError } = await adminSupabase
      .from("listings")
      .update({ status: "matched" })
      .eq("id", listing.id);

    if (listingUpdateError) {
      return jsonResponse(
        { success: false, error: listingUpdateError.message },
        500,
      );
    }

    const { error: requirementUpdateError } = await adminSupabase
      .from("requirements")
      .update({ status: "matched" })
      .eq("id", requirement.id);

    if (requirementUpdateError) {
      return jsonResponse(
        { success: false, error: requirementUpdateError.message },
        500,
      );
    }

    // ==================================================
    // RETURN RESULT
    // ==================================================

    return jsonResponse({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("create-transaction error:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error.",
      },
      500,
    );
  }
});