import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ======================================================
// CORS
// ======================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ======================================================
// TYPES
// ======================================================

type Grade = "A" | "B" | "C";

type Requirement = {
  id: string;
  buyer_id: string;
  material_type: string;
  quantity_needed: number;
  min_grade: Grade;
  max_budget: number | null;

  // NEW:
  max_distance_km: number | null;

  location_lat: number;
  location_lng: number;
  needed_by: string | null;
  status: "open" | "matched" | "closed";
};

type Listing = {
  id: string;
  seller_id: string;
  material_type: string;
  quantity: number;
  unit: string;
  grade: Grade;

  // Per-unit price, e.g. ₹8/kg
  price: number | null;

  location_lat: number;
  location_lng: number;
  available_from: string | null;
  available_until: string | null;
  status: "available" | "matched" | "completed";
};

type MatchResult = {
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

// ======================================================
// HAVERSINE DISTANCE
// ======================================================

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusKm = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return earthRadiusKm * c;
}

// ======================================================
// GRADE RANKING
// A = 3
// B = 2
// C = 1
// ======================================================

function gradeRank(grade: Grade): number {
  switch (grade) {
    case "A":
      return 3;

    case "B":
      return 2;

    case "C":
      return 1;

    default:
      return 0;
  }
}

// ======================================================
// GRADE COMPATIBILITY
//
// Requirement A:
//   Listing A -> yes
//   Listing B -> no
//   Listing C -> no
//
// Requirement B:
//   Listing A -> yes
//   Listing B -> yes
//   Listing C -> no
//
// Requirement C:
//   Listing A -> yes
//   Listing B -> yes
//   Listing C -> yes
// ======================================================

function gradeCompatible(
  listingGrade: Grade,
  minimumGrade: Grade,
): boolean {
  return (
    gradeRank(listingGrade) >=
    gradeRank(minimumGrade)
  );
}

// ======================================================
// CIRCULAR PATHWAY
//
// A/B -> Direct Reuse
// C   -> Recycling
// ======================================================

function getPathway(
  grade: Grade,
): "direct_reuse" | "recycling" {
  if (grade === "C") {
    return "recycling";
  }

  return "direct_reuse";
}

// ======================================================
// CARBON ESTIMATE
//
// ReValor design:
// Transport CO2e = Mass(t)
//                 × Distance(km)
//                 × Vehicle Emission Factor
//
// This is an INDICATIVE MVP estimate.
// It is NOT certified carbon accounting.
// ======================================================

function calculateCarbonSaved(
  quantityKg: number,
  distanceKm: number,
  grade: Grade,
): number {
  // Simplified MVP assumption.
  const vehicleEmissionFactor =
    0.1; // kg CO2e / tonne-km

  const massTonnes =
    quantityKg / 1000;

  const transportEmissions =
    massTonnes *
    distanceKm *
    vehicleEmissionFactor;

  // Simplified avoided-material impact.
  let avoidedImpactPerKg = 0;

  if (grade === "A") {
    avoidedImpactPerKg = 1.5;
  } else if (grade === "B") {
    avoidedImpactPerKg = 1.2;
  } else {
    avoidedImpactPerKg = 0.5;
  }

  const avoidedMaterialImpact =
    quantityKg *
    avoidedImpactPerKg;

  const carbonSaved =
    avoidedMaterialImpact -
    transportEmissions;

  return Math.max(
    0,
    carbonSaved,
  );
}

// ======================================================
// DATE COMPATIBILITY
// ======================================================

function dateCompatible(
  requirement: Requirement,
  listing: Listing,
): boolean {
  // No deadline = no date restriction
  if (!requirement.needed_by) {
    return true;
  }

  const neededBy =
    new Date(requirement.needed_by);

  // If listing becomes available after
  // buyer's deadline -> reject
  if (listing.available_from) {
    const availableFrom =
      new Date(listing.available_from);

    if (availableFrom > neededBy) {
      return false;
    }
  }

  return true;
}

// ======================================================
// QUANTITY SCORE
//
// Formula:
//
// 1 - |offered - needed| / needed
//
// Clamped between 0 and 1.
//
// Example:
// Needed = 400 kg
// Offered = 300 kg
//
// 1 - |300 - 400| / 400
// = 1 - 100 / 400
// = 0.75
// ======================================================

function calculateQuantityScore(
  needed: number,
  offered: number,
): number {
  if (needed <= 0) {
    return 0;
  }

  const difference =
    Math.abs(
      offered - needed,
    );

  const score =
    1 -
    difference / needed;

  return Math.max(
    0,
    Math.min(1, score),
  );
}

// ======================================================
// MAIN MATCH SCORE
//
// Factors:
// 1. Material
// 2. Quantity
// 3. Quality
// 4. Distance
// 5. Price
// 6. Carbon
//
// All normalised 0–1.
// ======================================================

function calculateMatchScore(
  requirement: Requirement,
  listing: Listing,
  distanceKm: number,
) {
  // --------------------------------------------------
  // MATERIAL
  // --------------------------------------------------

  const materialScore =
    requirement.material_type
      .trim()
      .toLowerCase() ===
    listing.material_type
      .trim()
      .toLowerCase()
      ? 1
      : 0;

  // --------------------------------------------------
  // QUANTITY
  // --------------------------------------------------

  const quantityScore =
    calculateQuantityScore(
      requirement.quantity_needed,
      listing.quantity,
    );

  // --------------------------------------------------
  // QUALITY
  // --------------------------------------------------

  const qualityScore =
    gradeCompatible(
      listing.grade,
      requirement.min_grade,
    )
      ? 1
      : 0;

  // --------------------------------------------------
  // DISTANCE
  //
  // Shorter distance = higher score.
  // max_distance_km is used as the normalisation
  // reference when available.
  // --------------------------------------------------

  let distanceScore = 0;

  if (
    requirement.max_distance_km !== null &&
    requirement.max_distance_km > 0
  ) {
    distanceScore = Math.max(
      0,
      Math.min(
        1,
        1 -
          distanceKm /
            requirement.max_distance_km,
      ),
    );
  } else {
    distanceScore =
      1 /
      (1 + distanceKm / 100);
  }

  // --------------------------------------------------
  // PRICE
  //
  // price and max_budget are PER-UNIT.
  //
  // Example:
  // Listing = ₹8/kg
  // Budget  = ₹15/kg
  // --------------------------------------------------

  let priceScore:
    | number
    | null = null;

  if (
    listing.price !== null &&
    requirement.max_budget !== null &&
    requirement.max_budget > 0
  ) {
    priceScore = Math.max(
      0,
      Math.min(
        1,
        1 -
          listing.price /
            requirement.max_budget,
      ),
    );
  }

  // --------------------------------------------------
  // CARBON
  // --------------------------------------------------

  const quantityForCarbon =
    Math.min(
      listing.quantity,
      requirement.quantity_needed,
    );

  const carbonSaved =
    calculateCarbonSaved(
      quantityForCarbon,
      distanceKm,
      listing.grade,
    );

  // Normalised carbon score.
  const carbonScore =
    Math.min(
      1,
      carbonSaved / 1000,
    );

  // --------------------------------------------------
  // WEIGHTS
  // --------------------------------------------------

  const weights = {
    material: 0.30,
    quantity: 0.15,
    quality: 0.15,
    distance: 0.15,
    price: 0.10,
    carbon: 0.15,
  };

  // --------------------------------------------------
  // Missing price:
  //
  // Price is NOT treated as ₹0.
  // Its weight is removed and the remaining
  // weights are renormalised.
  // --------------------------------------------------

  let totalWeight =
    weights.material +
    weights.quantity +
    weights.quality +
    weights.distance +
    weights.carbon;

  let weightedScore =
    materialScore *
      weights.material +
    quantityScore *
      weights.quantity +
    qualityScore *
      weights.quality +
    distanceScore *
      weights.distance +
    carbonScore *
      weights.carbon;

  if (priceScore !== null) {
    totalWeight +=
      weights.price;

    weightedScore +=
      priceScore *
      weights.price;
  }

  const score01 =
    weightedScore /
    totalWeight;

  const matchScore =
    Math.round(
      score01 * 100,
    );

  return {
    matchScore,
    carbonSaved,

    breakdown: {
      material: Number(
        materialScore.toFixed(3),
      ),

      quantity: Number(
        quantityScore.toFixed(3),
      ),

      quality: Number(
        qualityScore.toFixed(3),
      ),

      distance: Number(
        distanceScore.toFixed(3),
      ),

      price:
        priceScore === null
          ? null
          : Number(
              priceScore.toFixed(3),
            ),

      carbon: Number(
        carbonScore.toFixed(3),
      ),
    },
  };
}

// ======================================================
// WHY THIS MATCH?
// ======================================================

function generateReasons(
  requirement: Requirement,
  listing: Listing,
  distanceKm: number,
): string[] {
  const reasons: string[] = [];

  // Material
  reasons.push(
    "Material compatible",
  );

  // Quantity
  if (
    listing.quantity >=
    requirement.quantity_needed
  ) {
    reasons.push(
      "Quantity sufficient",
    );
  } else {
    reasons.push(
      `Partial quantity match: ${listing.quantity} ${listing.unit} offered for ${requirement.quantity_needed} ${listing.unit} needed`,
    );
  }

  // Grade
  if (
    gradeCompatible(
      listing.grade,
      requirement.min_grade,
    )
  ) {
    reasons.push(
      `Grade ${listing.grade} meets minimum Grade ${requirement.min_grade}`,
    );
  }

  // Price
  if (
    requirement.max_budget !== null &&
    listing.price !== null &&
    listing.price <=
      requirement.max_budget
  ) {
    reasons.push(
      `Within budget: ₹${listing.price}/${listing.unit}`,
    );
  } else if (
    listing.price === null
  ) {
    reasons.push(
      "Price unavailable — score confidence reduced",
    );
  }

  // Distance
  reasons.push(
    `${distanceKm.toFixed(1)} km estimated straight-line distance`,
  );

  // Pathway
  if (listing.grade === "C") {
    reasons.push(
      "Grade C → recycling/material recovery pathway",
    );
  } else {
    reasons.push(
      "Grade A/B → direct reuse pathway",
    );
  }

  return reasons;
}

// ======================================================
// EDGE FUNCTION
// ======================================================

Deno.serve(async (req) => {
  // ====================================================
  // CORS PREFLIGHT
  // ====================================================

  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      },
    );
  }

  // ====================================================
  // ONLY POST ALLOWED
  // ====================================================

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error:
          "Method not allowed",
      }),
      {
        status: 405,

        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  }

  try {
    // ==================================================
    // SUPABASE ENVIRONMENT VARIABLES
    // ==================================================

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const supabaseAnonKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY",
      );

    if (
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      throw new Error(
        "Supabase environment variables are missing",
      );
    }

    // ==================================================
    // AUTHORIZATION
    // ==================================================

    const authorization =
      req.headers.get(
        "Authorization",
      );

    if (!authorization) {
      return new Response(
        JSON.stringify({
          error:
            "Missing Authorization header",
        }),
        {
          status: 401,

          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ==================================================
    // CREATE SUPABASE CLIENT
    // ==================================================

    const supabase =
      createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },
        },
      );

    // ==================================================
    // GET CURRENT USER
    // ==================================================

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Unauthorized",
        }),
        {
          status: 401,

          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ==================================================
    // READ REQUEST BODY
    // ==================================================

    const body =
      await req.json();

    const requirementId =
      body.requirement_id;

    if (!requirementId) {
      return new Response(
        JSON.stringify({
          error:
            "requirement_id is required",
        }),
        {
          status: 400,

          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ==================================================
    // GET REQUIREMENT
    // ==================================================

    const {
      data: requirement,
      error:
        requirementError,
    } =
      await supabase
        .from("requirements")
        .select("*")
        .eq(
          "id",
          requirementId,
        )
        .single();

    if (
      requirementError ||
      !requirement
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Requirement not found",
        }),
        {
          status: 404,

          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ==================================================
    // SECURITY
    //
    // Only the buyer who owns the requirement
    // can request matching for it.
    // ==================================================

    if (
      requirement.buyer_id !==
      user.id
    ) {
      return new Response(
        JSON.stringify({
          error:
            "You are not allowed to match this requirement",
        }),
        {
          status: 403,

          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ==================================================
    // REQUIREMENT MUST BE OPEN
    // ==================================================

    if (
      requirement.status !==
      "open"
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Only open requirements can be matched",
        }),
        {
          status: 400,

          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ==================================================
    // GET AVAILABLE LISTINGS
    // ==================================================

    const {
      data: listings,
      error:
        listingsError,
    } =
      await supabase
        .from("listings")
        .select("*")
        .eq(
          "status",
          "available",
        );

    if (listingsError) {
      throw listingsError;
    }

    // ==================================================
    // HARD FILTER
    // ==================================================

    const compatibleListings =
      (listings as Listing[])
        .filter(
          (listing) => {
            // ------------------------------------------
            // 1. MATERIAL
            // ------------------------------------------

            const materialMatches =
              listing.material_type
                .trim()
                .toLowerCase() ===
              requirement.material_type
                .trim()
                .toLowerCase();

            if (
              !materialMatches
            ) {
              return false;
            }

            // ------------------------------------------
            // 2. QUANTITY MUST BE VALID
            //
            // Partial matches are allowed.
            // We only reject zero/negative quantities.
            // ------------------------------------------

            if (
              listing.quantity <=
                0 ||
              requirement.quantity_needed <=
                0
            ) {
              return false;
            }

            // ------------------------------------------
            // 3. GRADE
            // ------------------------------------------

            if (
              !gradeCompatible(
                listing.grade,
                requirement.min_grade,
              )
            ) {
              return false;
            }

            // ------------------------------------------
            // 4. PRICE / BUDGET
            //
            // Both are per-unit.
            // ------------------------------------------

            if (
              requirement.max_budget !==
                null &&
              listing.price !==
                null &&
              listing.price >
                requirement.max_budget
            ) {
              return false;
            }

            // ------------------------------------------
            // 5. DISTANCE
            // ------------------------------------------

            const distanceKm =
              haversineDistance(
                requirement.location_lat,
                requirement.location_lng,
                listing.location_lat,
                listing.location_lng,
              );

            if (
              requirement.max_distance_km !==
                null &&
              requirement.max_distance_km >
                0 &&
              distanceKm >
                requirement.max_distance_km
            ) {
              return false;
            }

            // ------------------------------------------
            // 6. DATE
            // ------------------------------------------

            if (
              !dateCompatible(
                requirement,
                listing,
              )
            ) {
              return false;
            }

            // ------------------------------------------
            // PASSED ALL FILTERS
            // ------------------------------------------

            return true;
          },
        );

    // ==================================================
    // SCORE EVERY COMPATIBLE LISTING
    // ==================================================

    const matches: MatchResult[] =
      compatibleListings.map(
        (listing) => {
          // Distance
          const distanceKm =
            haversineDistance(
              requirement.location_lat,
              requirement.location_lng,
              listing.location_lat,
              listing.location_lng,
            );

          // Score
          const score =
            calculateMatchScore(
              requirement,
              listing,
              distanceKm,
            );

          // Pathway
          const pathway =
            getPathway(
              listing.grade,
            );

          // Reasons
          const reasons =
            generateReasons(
              requirement,
              listing,
              distanceKm,
            );

          return {
            listing_id:
              listing.id,

            match_score:
              score.matchScore,

            distance_km:
              Number(
                distanceKm.toFixed(2),
              ),

            carbon_saved_kg:
              Number(
                score.carbonSaved.toFixed(
                  2,
                ),
              ),

            pathway,

            reasons,

            score_breakdown: {
              material:
                score.breakdown
                  .material,

              quantity:
                score.breakdown
                  .quantity,

              quality:
                score.breakdown
                  .quality,

              distance:
                score.breakdown
                  .distance,

              price:
                score.breakdown
                  .price,

              carbon:
                score.breakdown
                  .carbon,
            },
          };
        },
      );

    // ==================================================
    // RANK
    //
    // Highest score first
    // ==================================================

    matches.sort(
      (a, b) =>
        b.match_score -
        a.match_score,
    );

    // ==================================================
    // RETURN RESULT
    // ==================================================

    return new Response(
      JSON.stringify({
        success: true,

        requirement_id:
          requirement.id,

        total_matches:
          matches.length,

        matches,
      }),
      {
        status: 200,

        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  } catch (error) {
    // ==================================================
    // ERROR HANDLING
    // ==================================================

    console.error(error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      }),
      {
        status: 500,

        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  }
});