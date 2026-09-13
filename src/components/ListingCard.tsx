type Listing = {
  id: string;
  material_type: string;
  quantity: number;
  unit: string;
  quality_grade: "high" | "good" | "low";
  price_per_unit: number;
  latitude: number;
  longitude: number;
  available_from: string | null;
  available_until: string | null;
  status: string;
};

type ListingCardProps = {
  listing: Listing;
};

function ListingCard({ listing }: ListingCardProps) {
  const gradeLabel = {
    high: "A",
    good: "B",
    low: "C",
  };

  return (
    <div className="listing-card">
      <div className="listing-card-header">
        <div>
          <p className="listing-material">{listing.material_type}</p>

          <span className="status-badge">{listing.status}</span>
        </div>

        <div className="listing-grade">
          Grade {gradeLabel[listing.quality_grade]}
        </div>
      </div>

      <div className="listing-details">
        <div>
          <span>Quantity</span>

          <strong>
            {listing.quantity} {listing.unit}
          </strong>
        </div>

        <div>
          <span>Price / Unit</span>

          <strong>
            {listing.price_per_unit === 0
              ? "Free"
              : `₹${listing.price_per_unit}`}
          </strong>
        </div>
      </div>

      <div className="listing-location">
        Location: {listing.latitude.toFixed(2)}, {listing.longitude.toFixed(2)}
      </div>
    </div>
  );
}

export default ListingCard;
