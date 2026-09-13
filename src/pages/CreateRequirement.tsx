import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

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

    // ---------------------------------------------
    // VALIDATION
    // ---------------------------------------------

    if (!quantityNeeded || Number(quantityNeeded) <= 0) {
      setMessage("Please enter a valid quantity.");
      return;
    }

    if (!maxDistance || Number(maxDistance) <= 0) {
      setMessage("Please enter a valid maximum distance.");
      return;
    }

    if (maxBudget && Number(maxBudget) < 0) {
      setMessage("Please enter a valid maximum budget.");
      return;
    }

    const coordinates =
      cityCoordinates[location as keyof typeof cityCoordinates];

    if (!coordinates) {
      setMessage("Please select a valid location.");
      return;
    }

    setLoading(true);

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
        setMessage("Please log in before creating a requirement.");
        return;
      }

      // ---------------------------------------------
      // 2. CREATE REQUIREMENT
      // ---------------------------------------------

      const requirementData = {
        user_id: user.id,
        material_type: materialType,
        quantity: Number(quantityNeeded),
        quality_grade:
          minGrade === "A" ? "high" : minGrade === "B" ? "good" : "low",
        max_budget: maxBudget ? Number(maxBudget) : null,
        max_distance_km: Number(maxDistance),
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        needed_by: neededBy || null,
      };

      console.log("Creating requirement:", requirementData);

      const { data: createdRequirement, error: requirementError } =
        await supabase
          .from("requirements")
          .insert(requirementData)
          .select("id")
          .single();

      // ---------------------------------------------
      // 3. CHECK INSERT ERROR
      // ---------------------------------------------

      if (requirementError) {
        console.error("Requirement insert error:", requirementError);

        setMessage(
          `Failed to publish requirement: ${requirementError.message}`,
        );

        return;
      }

      if (!createdRequirement?.id) {
        setMessage("Requirement was created, but its ID could not be found.");
        return;
      }

      console.log("Requirement created successfully:", createdRequirement.id);

      // ---------------------------------------------
      // 4. GO TO MATCHES WITH NEW REQUIREMENT ID
      // ---------------------------------------------

      navigate(`/matches/${createdRequirement.id}`);
    } catch (error) {
      console.error("Create requirement error:", error);

      setMessage("Something went wrong while publishing the requirement.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="create-page">
      {/* ---------------------------------------------
          PAGE HEADER
      --------------------------------------------- */}

      <div className="page-header">
        <p className="eyebrow">MATERIAL MARKETPLACE</p>

        <h1>Create Requirement</h1>

        <p className="page-subtitle">
          Tell businesses what reusable material you need.
        </p>
      </div>

      {/* ---------------------------------------------
          FORM
      --------------------------------------------- */}

      <form className="listing-form" onSubmit={handleSubmit}>
        {/* MATERIAL TYPE */}

        <div className="form-group">
          <label htmlFor="material-type">Material Type</label>

          <select
            id="material-type"
            value={materialType}
            onChange={(event) => setMaterialType(event.target.value)}
          >
            <option value="cardboard">Cardboard</option>
            <option value="plastic">Plastic</option>
            <option value="pallet">Wooden Pallets</option>
          </select>
        </div>

        {/* QUANTITY */}

        <div className="form-group">
          <label htmlFor="quantity-needed">Quantity Needed</label>

          <input
            id="quantity-needed"
            type="number"
            min="1"
            placeholder="e.g. 400"
            value={quantityNeeded}
            onChange={(event) => setQuantityNeeded(event.target.value)}
          />
        </div>

        {/* MINIMUM GRADE */}

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

        {/* MAXIMUM BUDGET */}

        <div className="form-group">
          <label htmlFor="max-budget">Maximum Budget</label>

          <div className="input-with-prefix">
            <span>₹</span>

            <input
              id="max-budget"
              type="number"
              min="0"
              placeholder="e.g. 10"
              value={maxBudget}
              onChange={(event) => setMaxBudget(event.target.value)}
            />
          </div>

          <small>Leave empty if there is no fixed budget.</small>
        </div>

        {/* MAXIMUM DISTANCE */}

        <div className="form-group">
          <label htmlFor="max-distance">Maximum Distance</label>

          <div className="input-with-prefix">
            <input
              id="max-distance"
              type="number"
              min="1"
              placeholder="e.g. 50"
              value={maxDistance}
              onChange={(event) => setMaxDistance(event.target.value)}
            />

            <span>km</span>
          </div>

          <small>
            Maximum distance you are willing to source the material from.
          </small>
        </div>

        {/* LOCATION */}

        <div className="form-group">
          <label htmlFor="location">Location</label>

          <select
            id="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          >
            <option value="Ahmedabad">Ahmedabad</option>
            <option value="Vadodara">Vadodara</option>
            <option value="Surat">Surat</option>
            <option value="Rajkot">Rajkot</option>
          </select>

          <small>Used to calculate distance to available materials.</small>
        </div>

        {/* NEEDED BY */}

        <div className="form-group">
          <label htmlFor="needed-by">Needed By</label>

          <input
            id="needed-by"
            type="date"
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
          />
        </div>

        {/* MESSAGE */}

        {message && <div className="form-message">{message}</div>}

        {/* ACTIONS */}

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.history.back()}
            disabled={loading}
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
