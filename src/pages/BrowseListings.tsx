import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import ListingCard from "../components/ListingCard";

type Listing = {
  id: string;
  material_type: string;
  quantity: number;
  unit: string;
  grade: "A" | "B" | "C";
  price: number;
  location_lat: number;
  location_lng: number;
  available_from: string | null;
  available_until: string | null;
  status: string;
};

function BrowseListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [materialFilter, setMaterialFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");

  useEffect(() => {
    fetchListings();
  }, []);

  async function fetchListings() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("status", "available")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Listings error:", error);
      setMessage("Could not load listings.");
      setLoading(false);
      return;
    }

    setListings(data || []);
    setLoading(false);
  }

  const filteredListings = listings.filter((listing) => {
    const materialMatches =
      materialFilter === "all" || listing.material_type === materialFilter;

    const gradeMatches = gradeFilter === "all" || listing.grade === gradeFilter;

    return materialMatches && gradeMatches;
  });

  return (
    <div className="browse-page">
      <div className="page-header">
        <p className="eyebrow">MATERIAL MARKETPLACE</p>

        <h1>Browse Listings</h1>

        <p className="page-subtitle">
          Find reusable materials available from other businesses.
        </p>
      </div>

      <div className="filters">
        <div className="form-group">
          <label>Material</label>

          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
          >
            <option value="all">All Materials</option>
            <option value="cardboard">Cardboard</option>
            <option value="plastic">Plastic</option>
            <option value="pallet">Wooden Pallets</option>
          </select>
        </div>

        <div className="form-group">
          <label>Grade</label>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
          >
            <option value="all">All Grades</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
          </select>
        </div>
      </div>

      {loading && <p>Loading listings...</p>}

      {message && <div className="form-message">{message}</div>}

      {!loading && !message && (
        <>
          <p className="results-count">
            {filteredListings.length} listing
            {filteredListings.length !== 1 ? "s" : ""} found
          </p>

          {filteredListings.length === 0 ? (
            <p>No listings match your filters.</p>
          ) : (
            <div className="listing-grid">
              {filteredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BrowseListings;
