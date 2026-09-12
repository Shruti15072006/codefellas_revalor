import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import BrowseListings from "./pages/BrowseListings";
import CreateListing from "./pages/CreateListing";
import CreateRequirement from "./pages/CreateRequirement";
import Matches from "./pages/Matches";
import Transactions from "./pages/Transactions";
import TransactionRequests from "./pages/TransactionRequests";
import Logistics from "./pages/Logistics";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login / Signup */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Main application */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/listings" element={<BrowseListings />} />
          <Route path="/listings/new" element={<CreateListing />} />
          <Route path="/requirements/new" element={<CreateRequirement />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route
            path="/transaction-requests"
            element={<TransactionRequests />}
          />
          <Route path="/logistics" element={<Logistics />} />
        </Route>

        {/* Default */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
