import {
  LayoutDashboard,
  Package,
  PlusCircle,
  ClipboardList,
  Sparkles,
  ArrowLeftRight,
  Truck,
  Handshake,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { UserRole } from "../types/roles";

function Sidebar() {
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestRequirementId, setLatestRequirementId] = useState<string | null>(
    null,
  );
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    async function loadSidebarData() {
      try {
        /* ---------------------------------------------
           1. GET CURRENT USER
        --------------------------------------------- */

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("Could not get current user:", userError);
          return;
        }

        if (!user) {
          return;
        }

        /* ---------------------------------------------
           2. GET USER ROLE
        --------------------------------------------- */

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Could not load user role:", profileError);
        } else {
          setRole(profile?.role as UserRole);
        }

        /* ---------------------------------------------
           3. GET LATEST REQUIREMENT
        --------------------------------------------- */

        const { data: requirement, error: requirementError } = await supabase
          .from("requirements")
          .select("id")
          .eq("buyer_id", user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (requirementError) {
          console.error("Could not load latest requirement:", requirementError);
        } else {
          setLatestRequirementId(requirement?.id ?? null);
        }
      } catch (error) {
        console.error("Sidebar loading error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSidebarData();
  }, []);

  /* ---------------------------------------------
     MATCHES CLICK
  --------------------------------------------- */

  function handleMatchesClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    if (loadingMatches) {
      return;
    }

    if (!latestRequirementId) {
      navigate("/requirements/new");
      return;
    }

    setLoadingMatches(true);

    navigate(`/matches/${latestRequirementId}`);

    setLoadingMatches(false);
  }

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {/* ==========================================
            DASHBOARD - EVERYONE
        ========================================== */}

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        {/* ==========================================
            BUSINESS USERS
        ========================================== */}

        {!loading && role !== "logistics" && role !== null && (
          <>
            {/* ======================================
                MATERIALS
            ====================================== */}

            <div className="sidebar-section">
              <p className="sidebar-title">Materials</p>

              <NavLink
                to="/listings"
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <Package size={18} />
                <span>Browse Listings</span>
              </NavLink>

              <NavLink
                to="/listings/new"
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <PlusCircle size={18} />
                <span>Create Listing</span>
              </NavLink>
            </div>

            {/* ======================================
                REQUIREMENTS
            ====================================== */}

            <div className="sidebar-section">
              <p className="sidebar-title">Requirements</p>

              <NavLink
                to="/requirements/new"
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <ClipboardList size={18} />
                <span>Post Requirement</span>
              </NavLink>
            </div>

            {/* ======================================
                MATCHING
            ====================================== */}

            <div className="sidebar-section">
              <p className="sidebar-title">Matching</p>

              <a
                href={
                  latestRequirementId
                    ? `/matches/${latestRequirementId}`
                    : "/requirements/new"
                }
                className="sidebar-link"
                onClick={handleMatchesClick}
              >
                <Sparkles size={18} />

                <span>{loadingMatches ? "Loading Matches..." : "Matches"}</span>
              </a>
            </div>

            {/* ======================================
                TRANSACTIONS
            ====================================== */}

            <div className="sidebar-section">
              <p className="sidebar-title">Transactions</p>

              <NavLink
                to="/transactions"
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <ArrowLeftRight size={18} />
                <span>My Transactions</span>
              </NavLink>

              <NavLink
                to="/transaction-requests"
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <Handshake size={18} />
                <span>Transaction Requests</span>
              </NavLink>
            </div>
          </>
        )}

        {/* ==========================================
            LOGISTICS USERS
        ========================================== */}

        {!loading && role === "logistics" && (
          <div className="sidebar-section">
            <p className="sidebar-title">Logistics</p>

            <NavLink
              to="/logistics"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Truck size={18} />
              <span>Pickup Assignments</span>
            </NavLink>
          </div>
        )}
      </nav>
    </aside>
  );
}

export default Sidebar;
