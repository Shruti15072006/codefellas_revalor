import { useState } from "react";
import { supabase } from "../lib/supabase";

const cityCoordinates = {
  Ahmedabad: {
    lat: 23.0225,
    lng: 72.5714,
  },
  Vadodara: {
    lat: 22.3072,
    lng: 73.1811,
  },
  Surat: {
    lat: 21.1702,
    lng: 72.8311,
  },
  Rajkot: {
    lat: 22.3039,
    lng: 70.8022,
  },
};

function CreateListing() {
  const [materialType, setMaterialType] = useState("cardboard");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [grade, setGrade] = useState("A");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("Ahmedabad");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");

  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    // ---------------------------------------------
    // VALIDATION
    // ---------------------------------------------

    if (!quantity || Number(quantity) <= 0) {
      setMessage("Please enter a valid quantity.");
      return;
    }

    const coordinates =
      cityCoordinates[location as keyof typeof cityCoordinates];

    if (!coordinates) {
      setMessage("Please select a valid location.");
      return;
    }

    try {
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
        return;
      }

      if (!user) {
        setMessage("Please log in before creating a listing.");
        return;
      }

      // ---------------------------------------------
      // 2. MAP FRONTEND GRADE TO DATABASE VALUE
      // ---------------------------------------------

      const gradeMapping = {
        A: "high",
        B: "good",
        C: "low",
      };

      const qualityGrade = gradeMapping[grade as keyof typeof gradeMapping];

      // ---------------------------------------------
      // 3. CREATE LISTING
      // ---------------------------------------------

      const listingData = {
        user_id: user.id,
        material_type: materialType,
        quantity: Number(quantity),
        unit,
        quality_grade: qualityGrade,
        price_per_unit: Number(price) || 0,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        available_from: availableFrom || null,
        available_until: availableUntil || null,
      };

      console.log("Sending listing:", listingData);

      const { error } = await supabase.from("listings").insert(listingData);

      // ---------------------------------------------
      // 4. CHECK INSERT ERROR
      // ---------------------------------------------

      if (error) {
        console.error("Insert error:", error);
        setMessage(`Failed to publish listing: ${error.message}`);
        return;
      }

      // ---------------------------------------------
      // 5. SUCCESS
      // ---------------------------------------------

      setMessage("Listing published successfully!");

      // Clear form
      setQuantity("");
      setPrice("");
      setAvailableFrom("");
      setAvailableUntil("");
    } catch (error) {
      console.error("Create listing error:", error);
      setMessage("Something went wrong while publishing the listing.");
    }
  }

  return (
    <div className="create-page">
      <div className="page-header">
        <p className="eyebrow">MATERIAL MARKETPLACE</p>

        <h1>Create Listing</h1>

        <p className="page-subtitle">
          Add reusable material for other businesses to discover.
        </p>
      </div>

      <form className="listing-form" onSubmit={handleSubmit}>
        {/* MATERIAL */}

        <div className="form-group">
          <label>Material Type</label>

          <select
            value={materialType}
            onChange={(e) => setMaterialType(e.target.value)}
          >
            <option value="cardboard">Cardboard</option>
            <option value="plastic">Plastic</option>
            <option value="pallet">Wooden Pallets</option>
          </select>
        </div>

        {/* QUANTITY + UNIT */}

        <div className="form-row">
          <div className="form-group">
            <label>Quantity</label>

            <input
              type="number"
              min="1"
              placeholder="e.g. 500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Unit</label>

            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="kg">kg</option>
              <option value="units">units</option>
            </select>
          </div>
        </div>

        {/* GRADE */}

        <div className="form-group">
          <label>Material Grade</label>

          <div className="grade-options">
            {["A", "B", "C"].map((option) => (
              <button
                type="button"
                key={option}
                className={`grade-option ${grade === option ? "selected" : ""}`}
                onClick={() => setGrade(option)}
              >
                Grade {option}
              </button>
            ))}
          </div>
        </div>

        {/* PRICE */}

        <div className="form-group">
          <label>Price</label>

          <div className="input-with-prefix">
            <span>₹</span>

            <input
              type="number"
              min="0"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <small>Enter 0 if the material is being given away.</small>
        </div>

        {/* LOCATION */}

        <div className="form-group">
          <label>Location</label>

          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="Ahmedabad">Ahmedabad</option>
            <option value="Vadodara">Vadodara</option>
            <option value="Surat">Surat</option>
            <option value="Rajkot">Rajkot</option>
          </select>

          <small>
            Location is used to estimate distance between businesses.
          </small>
        </div>

        {/* DATES */}

        <div className="form-row">
          <div className="form-group">
            <label>Available From</label>

            <input
              type="date"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Available Until</label>

            <input
              type="date"
              value={availableUntil}
              onChange={(e) => setAvailableUntil(e.target.value)}
            />
          </div>
        </div>

        {/* MESSAGE */}

        {message && <div className="form-message">{message}</div>}

        {/* BUTTONS */}

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.history.back()}
          >
            Cancel
          </button>

          <button type="submit" className="primary-button">
            Publish Listing
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateListing;
