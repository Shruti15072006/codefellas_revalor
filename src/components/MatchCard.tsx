import type { Match } from "../mock/matches";

type MatchCardProps = {
  match: Match;
  onClaim: (match: Match) => void;
  claiming?: boolean;
};

function MatchCard({ match, onClaim, claiming = false }: MatchCardProps) {
  const isRecycling = match.pathway === "recycling";

  return (
    <article className="match-card">
      {/* =====================================================
          TOP SECTION
      ===================================================== */}
      <div className="match-card-top">
        <div className="match-material">
          <div className="match-material-icon">
            {match.materialType.charAt(0).toUpperCase()}
          </div>

          <div>
            <h3>{match.materialType}</h3>

            <p>
              {match.quantity} {match.unit} available
            </p>
          </div>
        </div>

        <div className="match-score-box">
          <span>Match Score</span>

          <strong>{match.match_score}%</strong>
        </div>
      </div>

      {/* =====================================================
          MATCH DETAILS
      ===================================================== */}
      <div className="match-details">
        <div className="match-detail">
          <span>GRADE</span>
          <strong>Grade {match.grade}</strong>
        </div>

        <div className="match-detail">
          <span>DISTANCE</span>
          <strong>{match.distance_km} km</strong>
        </div>

        <div className="match-detail">
          <span>CO₂ SAVED</span>
          <strong>{match.carbon_saved_kg} kg</strong>
        </div>

        <div className="match-detail">
          <span>PRICE</span>
          <strong>{match.price === 0 ? "Free" : `₹${match.price}/kg`}</strong>
        </div>
      </div>

      {/* =====================================================
          WHY THIS MATCH
      ===================================================== */}
      <div className="match-reasons">
        <div className="match-reasons-header">
          <h4>Why this match?</h4>

          <span>{match.reasons.length} factors</span>
        </div>

        <ul>
          {match.reasons.map((reason, index) => (
            <li key={index}>
              <span className="reason-check">✓</span>

              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* =====================================================
          PATHWAY
      ===================================================== */}
      <div
        className={`pathway-message ${
          isRecycling ? "recycling-pathway" : "direct-reuse-pathway"
        }`}
      >
        <div className="pathway-indicator">{isRecycling ? "R" : "D"}</div>

        <div className="pathway-content">
          <strong>
            {isRecycling
              ? "Not suitable for direct reuse"
              : "Suitable for direct reuse"}
          </strong>

          <p>
            {isRecycling
              ? "Recommended pathway: recycling"
              : "This material can be reused directly."}
          </p>
        </div>
      </div>

      {/* =====================================================
          ACTION
      ===================================================== */}
      {!isRecycling && (
        <div className="match-card-action">
          <button
            type="button"
            className="primary-button match-claim-button"
            disabled={claiming}
            onClick={() => onClaim(match)}
          >
            {claiming ? "Claiming..." : "Claim Match"}
          </button>
        </div>
      )}

      {isRecycling && (
        <div className="match-card-action">
          <span className="recycling-note">Recycling pathway recommended</span>
        </div>
      )}
    </article>
  );
}

export default MatchCard;
