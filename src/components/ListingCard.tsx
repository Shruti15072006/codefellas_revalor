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

type ListingCardProps = {
  listing: Listing;
};

function ListingCard({ listing }: ListingCardProps) {
  return (
    <div className="listing-card">
      <div className="listing-card-header">
        <div>
          <p className="listing-material">{listing.material_type}</p>

          <span className="status-badge">{listing.status}</span>
        </div>

        <div className="listing-grade">Grade {listing.grade}</div>
      </div>

      <div className="listing-details">
        <div>
          <span>Quantity</span>
          <strong>
            {listing.quantity} {listing.unit}
          </strong>
        </div>

        <div>
          <span>Price</span>
          <strong>{listing.price === 0 ? "Free" : `₹${listing.price}`}</strong>
        </div>
      </div>

      <div className="listing-location">
        Location coordinates: {listing.location_lat.toFixed(2)},{" "}
        {listing.location_lng.toFixed(2)}
      </div>
    </div>
  );
}

export default ListingCard;
