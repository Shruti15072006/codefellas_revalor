import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

function Layout() {
  return (
    <div className="app">
      <Navbar />

      <div className="main-container">
        <Sidebar />

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
