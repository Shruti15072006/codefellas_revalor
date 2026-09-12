export type Match = {
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

  // Temporary display data for frontend
  materialType: string;
  quantity: number;
  unit: string;
  grade: "A" | "B" | "C";
  price: number;
};

export const mockMatches: Match[] = [
  {
    listing_id: "0ffcbab6-75d6-48ee-a7ac-a9ca04f05902",

    match_score: 94,
    distance_km: 24.3,
    carbon_saved_kg: 1850.4,

    pathway: "direct_reuse",

    reasons: [
      "Material compatible",
      "Quantity sufficient",
      "Grade A meets minimum Grade B",
      "Free material",
      "24.3 km estimated straight-line distance",
    ],

    score_breakdown: {
      material: 1,
      quantity: 1,
      quality: 1,
      distance: 0.804,
      price: 1,
      carbon: 1,
    },

    materialType: "Cardboard",
    quantity: 500,
    unit: "kg",
    grade: "A",
    price: 0,
  },

  {
    listing_id: "f5b091a8-b96b-46c6-9f58-03c9e419aa6f",

    match_score: 81,
    distance_km: 42.1,
    carbon_saved_kg: 1120.2,

    pathway: "direct_reuse",

    reasons: [
      "Material compatible",
      "Quantity sufficient",
      "Grade A meets minimum Grade B",
      "Within budget",
      "42.1 km estimated straight-line distance",
    ],

    score_breakdown: {
      material: 1,
      quantity: 1,
      quality: 1,
      distance: 0.6,
      price: 0.7,
      carbon: 0.8,
    },

    materialType: "Cardboard",
    quantity: 500,
    unit: "kg",
    grade: "A",
    price: 8,
  },

  {
    listing_id: "42bd80f2-f574-4cc6-86df-4666cc95a382",

    match_score: 55,
    distance_km: 31.5,
    carbon_saved_kg: 400,

    pathway: "recycling",

    reasons: [
      "Different material type",
      "Not compatible with cardboard requirement",
      "Plastic material",
    ],

    score_breakdown: {
      material: 0,
      quantity: 0.6,
      quality: 1,
      distance: 0.7,
      price: 0.8,
      carbon: 0.5,
    },

    materialType: "Plastic",
    quantity: 300,
    unit: "kg",
    grade: "B",
    price: 5,
  },
];
