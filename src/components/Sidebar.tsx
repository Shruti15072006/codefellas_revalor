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

import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className="sidebar-link">
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <div className="sidebar-section">
          <p className="sidebar-title">Materials</p>

          <NavLink to="/listings" className="sidebar-link">
            <Package size={18} />
            <span>Browse Listings</span>
          </NavLink>

          <NavLink to="/listings/new" className="sidebar-link">
            <PlusCircle size={18} />
            <span>Create Listing</span>
          </NavLink>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-title">Requirements</p>

          <NavLink to="/requirements/new" className="sidebar-link">
            <ClipboardList size={18} />
            <span>Post Requirement</span>
          </NavLink>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-title">Matching</p>

          <NavLink to="/matches" className="sidebar-link">
            <Sparkles size={18} />
            <span>Matches</span>
          </NavLink>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-title">Transactions</p>

          <NavLink to="/transactions" className="sidebar-link">
            <ArrowLeftRight size={18} />
            <span>My Transactions</span>
          </NavLink>
          <NavLink to="/logistics" className="sidebar-link">
            <Truck size={18} />
            <span>Logistics</span>
          </NavLink>

          <NavLink to="/transaction-requests" className="sidebar-link">
            <Handshake size={18} />
            <span>Transaction Requests</span>
          </NavLink>
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
