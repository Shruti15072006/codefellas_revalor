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

function CreateRequirement() {
  const [materialType, setMaterialType] = useState("cardboard");
  const [quantityNeeded, setQuantityNeeded] = useState("");
  const [minGrade, setMinGrade] = useState("B");
  const [maxBudget, setMaxBudget] = useState("");
  const [maxDistance, setMaxDistance] = useState("50");
  const [location, setLocation] = useState("Ahmedabad");
  const [neededBy, setNeededBy] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    if (!quantityNeeded || Number(quantityNeeded) <= 0) {
      setMessage("Please enter a valid quantity.");
      return;
    }

    if (!maxDistance || Number(maxDistance) <= 0) {
      setMessage("Please enter a valid maximum distance.");
      return;
    }

    const coordinates =
      cityCoordinates[location as keyof typeof cityCoordinates];

    setLoading(true);

    try {
      // Get logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(userError);
        setMessage("Could not get user information.");
        return;
      }

      if (!user) {
        setMessage("Please log in before creating a requirement.");
        return;
      }

      // Data matching Vedanshi's requirements table
      const requirementData = {
        buyer_id: user.id,
        material_type: materialType,
        quantity_needed: Number(quantityNeeded),
        min_grade: minGrade,
        max_budget: maxBudget ? Number(maxBudget) : null,
        max_distance_km: Number(maxDistance),
        location_lat: coordinates.lat,
        location_lng: coordinates.lng,
        needed_by: neededBy || null,
      };

      console.log("Sending requirement:", requirementData);

      const { error } = await supabase
        .from("requirements")
        .insert(requirementData);

      if (error) {
        console.error("Insert error:", error);
        setMessage(`Failed to publish requirement: ${error.message}`);
        return;
      }

      setMessage("Requirement published successfully!");

      // Clear form
      setQuantityNeeded("");
      setMaxBudget("");
      setMaxDistance("50");
      setNeededBy("");
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while publishing the requirement.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="create-page">
      <div className="page-header">
        <p className="eyebrow">MATERIAL MARKETPLACE</p>

        <h1>Create Requirement</h1>

        <p className="page-subtitle">
          Tell businesses what reusable material you need.
        </p>
      </div>

      <form className="listing-form" onSubmit={handleSubmit}>
        {/* Material */}

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

        {/* Quantity */}

        <div className="form-group">
          <label>Quantity Needed</label>

          <input
            type="number"
            min="1"
            placeholder="e.g. 400"
            value={quantityNeeded}
            onChange={(e) => setQuantityNeeded(e.target.value)}
          />
        </div>

        {/* Grade */}

        <div className="form-group">
          <label>Minimum Grade</label>

          <div className="grade-options">
            {["A", "B", "C"].map((option) => (
              <button
                type="button"
                key={option}
                className={`grade-option ${
                  minGrade === option ? "selected" : ""
                }`}
                onClick={() => setMinGrade(option)}
              >
                Grade {option}+
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}

        <div className="form-group">
          <label>Maximum Budget</label>

          <div className="input-with-prefix">
            <span>₹</span>

            <input
              type="number"
              min="0"
              placeholder="e.g. 10"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
            />
          </div>

          <small>Leave empty if there is no fixed budget.</small>
        </div>

        {/* Maximum Distance */}

        <div className="form-group">
          <label>Maximum Distance</label>

          <div className="input-with-prefix">
            <input
              type="number"
              min="1"
              placeholder="e.g. 50"
              value={maxDistance}
              onChange={(e) => setMaxDistance(e.target.value)}
            />

            <span>km</span>
          </div>

          <small>
            Maximum distance you are willing to source the material from.
          </small>
        </div>

        {/* Location */}

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

          <small>Used to calculate distance to available materials.</small>
        </div>

        {/* Needed By */}

        <div className="form-group">
          <label>Needed By</label>

          <input
            type="date"
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
          />
        </div>

        {message && <div className="form-message">{message}</div>}

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.history.back()}
          >
            Cancel
          </button>

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Publishing..." : "Publish Requirement"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateRequirement;
