import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type MatchingMode =
  | "balanced"
  | "lowest_cost"
  | "lowest_carbon"
  | "fastest_delivery";

type Requirement = {
  id: string;
  user_id: string;
  material_type: string;
  quantity: number;
  quality_grade?: string | null;
  max_budget?: number | null;
  needed_by?: string | null;
  max_distance_km?: number | null;
};

type Listing = {
  id: string;
  user_id?: string | null;
  material_type: string;
  quantity: number;
  quality_grade?: string | null;
  price_per_unit?: number | null;
  available_from?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
  carbon_saved_kg?: number | null;
  estimated_delivery_days?: number | null;
  status?: string | null;
};

type Candidate = {
  listing: Listing;
  distance_km: number | null;
  estimated_delivery_days: number | null;
  price_score: number | null;
  quantity_score: number;
  quality_score: number;
  distance_score: number | null;
  carbon_score: number | null;
  delivery_score: number | null;
  material_score: number;
  raw_price: number | null;
  raw_carbon_saved: number | null;
  raw_delivery_days: number | null;
  pathway: string;
  reasons: string[];
};

const VALID_MODES: MatchingMode[] = [
  "balanced",
  "lowest_cost",
  "lowest_carbon",
  "fastest_delivery",
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeMinMax(
  value: number | null,
  min: number,
  max: number,
  higherIsBetter = true,
): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  if (min === max) {
    return 1;
  }

  const normalized = (value - min) / (max - min);

  return higherIsBetter
    ? clamp(normalized)
    : clamp(1 - normalized);
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isQualityCompatible(
  requiredQuality: string | null | undefined,
  availableQuality: string | null | undefined,
): boolean {
  if (!requiredQuality || !availableQuality) {
    return true;
  }

  const required = normalizeText(requiredQuality);
  const available = normalizeText(availableQuality);

  if (required === available) {
    return true;
  }

  const qualityRank: Record<string, number> = {
    low: 1,
    basic: 1,
    standard: 2,
    medium: 2,
    good: 3,
    high: 4,
    premium: 5,
    excellent: 5,
  };

  const requiredRank = qualityRank[required];
  const availableRank = qualityRank[available];

  if (requiredRank === undefined || availableRank === undefined) {
    return false;
  }

  return availableRank >= requiredRank;
}

function calculateDistanceKm(
  requirement: Requirement,
  listing: Listing,
): number | null {
  const requirementLatitude = (requirement as any).latitude;
  const requirementLongitude = (requirement as any).longitude;

  const listingLatitude =
    listing.latitude ?? listing.location_lat ?? null;

  const listingLongitude =
    listing.longitude ?? listing.location_lng ?? null;

  if (
    requirementLatitude === null ||
    requirementLatitude === undefined ||
    requirementLongitude === null ||
    requirementLongitude === undefined ||
    listingLatitude === null ||
    listingLongitude === null ||
    listingLatitude === undefined ||
    listingLongitude === undefined
  ) {
    return null;
  }

  const earthRadiusKm = 6371;

  const latitudeDifference =
    ((listingLatitude - requirementLatitude) * Math.PI) / 180;

  const longitudeDifference =
    ((listingLongitude - requirementLongitude) * Math.PI) / 180;

  const latitude1 = (requirementLatitude * Math.PI) / 180;
  const latitude2 = (listingLatitude * Math.PI) / 180;

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function calculateQuantityScore(
  requiredQuantity: number,
  availableQuantity: number,
): number {
  if (requiredQuantity <= 0 || availableQuantity <= 0) {
    return 0;
  }

  if (availableQuantity < requiredQuantity) {
    return clamp(availableQuantity / requiredQuantity);
  }

  const excessRatio =
    (availableQuantity - requiredQuantity) / requiredQuantity;

  return clamp(1 - excessRatio * 0.25);
}

function calculateQualityScore(
  requiredQuality: string | null | undefined,
  availableQuality: string | null | undefined,
): number {
  if (!requiredQuality || !availableQuality) {
    return 0.5;
  }

  if (normalizeText(requiredQuality) === normalizeText(availableQuality)) {
    return 1;
  }

  return isQualityCompatible(requiredQuality, availableQuality) ? 0.8 : 0;
}

function calculatePriceScore(
  pricePerUnit: number | null | undefined,
  maxBudget: number | null | undefined,
): number | null {
  if (
    pricePerUnit === null ||
    pricePerUnit === undefined ||
    maxBudget === null ||
    maxBudget === undefined ||
    pricePerUnit < 0 ||
    maxBudget <= 0
  ) {
    return null;
  }

  if (pricePerUnit > maxBudget) {
    return 0;
  }

  if (pricePerUnit === 0) {
    return 1;
  }

  return clamp(1 - pricePerUnit / maxBudget);
}

function calculateDeliveryDays(
  listing: Listing,
  distanceKm: number | null,
): number | null {
  if (
    listing.estimated_delivery_days !== null &&
    listing.estimated_delivery_days !== undefined &&
    Number.isFinite(listing.estimated_delivery_days)
  ) {
    return Math.max(0, Math.ceil(listing.estimated_delivery_days));
  }

  let waitingDays = 0;

  if (listing.available_from) {
    const availableDate = new Date(listing.available_from);

    if (!Number.isNaN(availableDate.getTime())) {
      const now = new Date();
      const differenceMs = availableDate.getTime() - now.getTime();

      waitingDays = Math.max(
        0,
        Math.ceil(differenceMs / (1000 * 60 * 60 * 24)),
      );
    }
  }

  if (distanceKm === null) {
    return listing.available_from ? waitingDays : null;
  }

  const transportDays = Math.max(1, Math.ceil(distanceKm / 150));

  return waitingDays + transportDays;
}

function calculateDeliveryScore(
  deliveryDays: number | null,
  neededBy: string | null | undefined,
): number | null {
  if (deliveryDays === null) {
    return null;
  }

  if (!neededBy) {
    return clamp(1 - deliveryDays / 30);
  }

  const deadline = new Date(neededBy);

  if (Number.isNaN(deadline.getTime())) {
    return clamp(1 - deliveryDays / 30);
  }

  const now = new Date();
  const daysUntilDeadline = Math.max(
    0,
    Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  if (daysUntilDeadline === 0) {
    return deliveryDays === 0 ? 1 : 0;
  }

  return clamp(1 - deliveryDays / daysUntilDeadline);
}

function calculateWeightedScore(
  values: Array<{ value: number | null; weight: number }>,
): number {
  let weightedTotal = 0;
  let availableWeight = 0;

  for (const item of values) {
    if (item.value === null || !Number.isFinite(item.value)) {
      continue;
    }

    weightedTotal += clamp(item.value) * item.weight;
    availableWeight += item.weight;
  }

  if (availableWeight === 0) {
    return 0;
  }

  return clamp(weightedTotal / availableWeight);
}

function getPathway(mode: MatchingMode): string {
  switch (mode) {
    case "lowest_cost":
      return "Cost-optimized matching";
    case "lowest_carbon":
      return "Carbon-optimized matching";
    case "fastest_delivery":
      return "Delivery-optimized matching";
    case "balanced":
    default:
      return "Balanced matching";
  }
}

function calculateModeScore(
  candidate: Candidate,
  mode: MatchingMode,
): {
  score: number;
  breakdown: Record<string, number | null>;
} {
  const {
    price_score,
    quantity_score,
    quality_score,
    distance_score,
    carbon_score,
    delivery_score,
    material_score,
  } = candidate;

  if (mode === "lowest_cost") {
    const score = calculateWeightedScore([
      { value: price_score, weight: 0.7 },
      { value: distance_score, weight: 0.1 },
      { value: quantity_score, weight: 0.1 },
      { value: quality_score, weight: 0.1 },
    ]);

    return {
      score,
      breakdown: {
        material: material_score,
        price: price_score,
        distance: distance_score,
        quantity: quantity_score,
        quality: quality_score,
      },
    };
  }

  if (mode === "lowest_carbon") {
    const score = calculateWeightedScore([
      { value: carbon_score, weight: 0.7 },
      { value: distance_score, weight: 0.15 },
      { value: quality_score, weight: 0.1 },
      { value: quantity_score, weight: 0.05 },
    ]);

    return {
      score,
      breakdown: {
        material: material_score,
        carbon: carbon_score,
        distance: distance_score,
        quality: quality_score,
        quantity: quantity_score,
      },
    };
  }

  if (mode === "fastest_delivery") {
    const score = calculateWeightedScore([
      { value: delivery_score, weight: 0.7 },
      { value: distance_score, weight: 0.15 },
      { value: quantity_score, weight: 0.1 },
      { value: quality_score, weight: 0.05 },
    ]);

    return {
      score,
      breakdown: {
        material: material_score,
        delivery: delivery_score,
        distance: distance_score,
        quantity: quantity_score,
        quality: quality_score,
      },
    };
  }

  const score = calculateWeightedScore([
    { value: material_score, weight: 0.3 },
    { value: quantity_score, weight: 0.15 },
    { value: quality_score, weight: 0.15 },
    { value: distance_score, weight: 0.15 },
    { value: price_score, weight: 0.1 },
    { value: carbon_score, weight: 0.1 },
    { value: delivery_score, weight: 0.05 },
  ]);

  return {
    score,
    breakdown: {
      material: material_score,
      quantity: quantity_score,
      quality: quality_score,
      distance: distance_score,
      price: price_score,
      carbon: carbon_score,
      delivery: delivery_score,
    },
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Only POST requests are allowed.",
      },
      405,
    );
  }

  try {
    const authorizationHeader = request.headers.get("Authorization");

    if (!authorizationHeader) {
      return jsonResponse(
        {
          success: false,
          error: "Missing Authorization header.",
        },
        401,
      );
    }

    const token = authorizationHeader.replace("Bearer ", "").trim();

    if (!token) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid authorization token.",
        },
        401,
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized user.",
        },
        401,
      );
    }

    const body = await request.json();

    const requirementId = body?.requirement_id;
    const requestedMode = body?.mode ?? "balanced";

    if (!requirementId) {
      return jsonResponse(
        {
          success: false,
          error: "requirement_id is required.",
        },
        400,
      );
    }

    if (!VALID_MODES.includes(requestedMode)) {
      return jsonResponse(
        {
          success: false,
          error: `Invalid mode. Allowed modes: ${VALID_MODES.join(", ")}`,
        },
        400,
      );
    }

    const mode = requestedMode as MatchingMode;

    const { data: requirement, error: requirementError } =
      await adminSupabase
        .from("requirements")
        .select("*")
        .eq("id", requirementId)
        .maybeSingle();

    if (requirementError) {
      return jsonResponse(
        {
          success: false,
          error: requirementError.message,
        },
        500,
      );
    }

    if (!requirement) {
      return jsonResponse(
        {
          success: false,
          error: "Requirement not found.",
        },
        404,
      );
    }

    if (requirement.user_id !== user.id) {
      return jsonResponse(
        {
          success: false,
          error: "You do not have permission to access this requirement.",
        },
        403,
      );
    }

    const typedRequirement = requirement as Requirement;

    // NOTE: restored the "status = available" filter here so that
    // listings already matched/completed don't keep showing up as
    // candidates for other buyers.
    const { data: listings, error: listingsError } = await adminSupabase
      .from("listings")
      .select("*")
      .eq("status", "available")
      .gt("quantity", 0);

    if (listingsError) {
      return jsonResponse(
        {
          success: false,
          error: listingsError.message,
        },
        500,
      );
    }

    const compatibleCandidates: Candidate[] = [];

    for (const rawListing of listings ?? []) {
      const listing = rawListing as Listing;

      const materialMatches =
        normalizeText(listing.material_type) ===
        normalizeText(typedRequirement.material_type);

      if (!materialMatches) {
        continue;
      }

      if (
        !Number.isFinite(typedRequirement.quantity) ||
        typedRequirement.quantity <= 0 ||
        !Number.isFinite(listing.quantity) ||
        listing.quantity <= 0
      ) {
        continue;
      }

      if (
        typedRequirement.max_budget !== null &&
        typedRequirement.max_budget !== undefined &&
        listing.price_per_unit !== null &&
        listing.price_per_unit !== undefined &&
        listing.price_per_unit > typedRequirement.max_budget
      ) {
        continue;
      }

      if (
        !isQualityCompatible(
          typedRequirement.quality_grade,
          listing.quality_grade,
        )
      ) {
        continue;
      }

      const distanceKm = calculateDistanceKm(typedRequirement, listing);

      const maximumDistance =
        typedRequirement.max_distance_km ?? 100;

      if (
        distanceKm !== null &&
        Number.isFinite(maximumDistance) &&
        distanceKm > maximumDistance
      ) {
        continue;
      }

      if (listing.available_from && typedRequirement.needed_by) {
        const availableDate = new Date(listing.available_from);
        const neededByDate = new Date(typedRequirement.needed_by);

        if (
          !Number.isNaN(availableDate.getTime()) &&
          !Number.isNaN(neededByDate.getTime()) &&
          availableDate > neededByDate
        ) {
          continue;
        }
      }

      const quantityScore = calculateQuantityScore(
        typedRequirement.quantity,
        listing.quantity,
      );

      const qualityScore = calculateQualityScore(
        typedRequirement.quality_grade,
        listing.quality_grade,
      );

      const priceScore = calculatePriceScore(
        listing.price_per_unit,
        typedRequirement.max_budget,
      );

      const deliveryDays = calculateDeliveryDays(listing, distanceKm);

      const deliveryScore = calculateDeliveryScore(
        deliveryDays,
        typedRequirement.needed_by,
      );

      const distanceScore =
        distanceKm === null
          ? null
          : clamp(1 - distanceKm / Math.max(maximumDistance, 1));

      const rawCarbonSaved =
        listing.carbon_saved_kg !== null &&
        listing.carbon_saved_kg !== undefined &&
        Number.isFinite(listing.carbon_saved_kg)
          ? Math.max(0, listing.carbon_saved_kg)
          : null;

      const reasons: string[] = [
        "Material type matches the requirement.",
      ];

      if (listing.quantity >= typedRequirement.quantity) {
        reasons.push("Listing quantity can satisfy the requested quantity.");
      } else {
        reasons.push("Listing provides only a partial quantity.");
      }

      if (qualityScore >= 1) {
        reasons.push("Quality grade exactly matches.");
      } else if (qualityScore > 0) {
        reasons.push("Quality grade is compatible.");
      }

      if (priceScore !== null) {
        reasons.push("Listing price is within the required budget.");
      }

      if (distanceKm !== null) {
        reasons.push(
          `Estimated distance is ${distanceKm.toFixed(2)} km.`,
        );
      }

      if (deliveryDays !== null) {
        reasons.push(
          `Estimated delivery time is ${deliveryDays} day(s).`,
        );
      }

      compatibleCandidates.push({
        listing,
        distance_km: distanceKm,
        estimated_delivery_days: deliveryDays,
        price_score: priceScore,
        quantity_score: quantityScore,
        quality_score: qualityScore,
        distance_score: distanceScore,
        carbon_score: null,
        delivery_score: deliveryScore,
        material_score: 1,
        raw_price:
          listing.price_per_unit !== null &&
          listing.price_per_unit !== undefined
            ? listing.price_per_unit
            : null,
        raw_carbon_saved: rawCarbonSaved,
        raw_delivery_days: deliveryDays,
        pathway: getPathway(mode),
        reasons,
      });
    }

    const prices = compatibleCandidates
      .map((candidate) => candidate.raw_price)
      .filter((value): value is number => value !== null);

    const carbons = compatibleCandidates
      .map((candidate) => candidate.raw_carbon_saved)
      .filter((value): value is number => value !== null);

    const deliveryDays = compatibleCandidates
      .map((candidate) => candidate.raw_delivery_days)
      .filter((value): value is number => value !== null);

    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const minCarbon = carbons.length > 0 ? Math.min(...carbons) : 0;
    const maxCarbon = carbons.length > 0 ? Math.max(...carbons) : 0;

    const minDelivery =
      deliveryDays.length > 0 ? Math.min(...deliveryDays) : 0;
    const maxDelivery =
      deliveryDays.length > 0 ? Math.max(...deliveryDays) : 0;

    for (const candidate of compatibleCandidates) {
      candidate.price_score =
        candidate.raw_price === null
          ? null
          : normalizeMinMax(
              candidate.raw_price,
              minPrice,
              maxPrice,
              false,
            );

      candidate.carbon_score =
        candidate.raw_carbon_saved === null
          ? null
          : normalizeMinMax(
              candidate.raw_carbon_saved,
              minCarbon,
              maxCarbon,
              true,
            );

      candidate.delivery_score =
        candidate.raw_delivery_days === null
          ? null
          : normalizeMinMax(
              candidate.raw_delivery_days,
              minDelivery,
              maxDelivery,
              false,
            );
    }

    const matches = compatibleCandidates
      .map((candidate) => {
        const modeResult = calculateModeScore(candidate, mode);

        return {
          listing_id: candidate.listing.id,
          match_score: Number((modeResult.score * 100).toFixed(2)),
          distance_km:
            candidate.distance_km === null
              ? null
              : Number(candidate.distance_km.toFixed(2)),
          carbon_saved_kg: candidate.raw_carbon_saved,
          pathway: candidate.pathway,
          reasons: candidate.reasons,
          score_breakdown: modeResult.breakdown,
          estimated_delivery_days: candidate.estimated_delivery_days,
          price_per_unit: candidate.raw_price,
        };
      })
      .sort((a, b) => b.match_score - a.match_score);

    return jsonResponse({
      success: true,
      requirement_id: requirementId,
      mode,
      total_matches: matches.length,
      matches,
    });
  } catch (error) {
    console.error("Matching engine error:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500,
    );
  }
});