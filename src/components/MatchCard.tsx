import type { Match } from "../mock/matches";

type MatchCardProps = {
  match: Match;
  onClaim: (match: Match) => void;
  claiming?: boolean;
};

function MatchCard({ match, onClaim, claiming = false }: MatchCardProps) {
  const isRecycling = match.pathway === "recycling";

  return (
    <div className="match-card">
      {/* Header */}
      <div className="match-card-header">
        <div>
          <p className="listing-material">{match.materialType}</p>

          <p className="match-quantity">
            {match.quantity} {match.unit}
          </p>
        </div>

        <div className="match-score">
          <span>Match Score</span>
          <strong>{match.match_score}%</strong>
        </div>
      </div>

      {/* Details */}
      <div className="match-details">
        <div>
          <span>Grade</span>
          <strong>Grade {match.grade}</strong>
        </div>

        <div>
          <span>Distance</span>
          <strong>{match.distance_km} km</strong>
        </div>

        <div>
          <span>CO₂ Saved</span>
          <strong>{match.carbon_saved_kg} kg</strong>
        </div>

        <div>
          <span>Price</span>

          <strong>{match.price === 0 ? "Free" : `₹${match.price}/kg`}</strong>
        </div>
      </div>

      {/* Why this match */}
      <div className="match-reasons">
        <p>Why this match?</p>

        <ul>
          {match.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </div>

      {/* Pathway */}
      <div className="pathway-message">
        {isRecycling ? (
          <>
            <strong>Not suitable for direct reuse</strong>

            <p>Recommended pathway: recycling</p>
          </>
        ) : (
          <>
            <strong>Suitable for direct reuse</strong>

            <p>This material can be reused directly.</p>
          </>
        )}
      </div>

      {/* Claim button */}
      {!isRecycling && (
        <button
          type="button"
          className="primary-button"
          disabled={claiming}
          onClick={() => onClaim(match)}
        >
          {claiming ? "Claiming..." : "Claim Match"}
        </button>
      )}
    </div>
  );
}

export default MatchCard;
