import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import BuyTyre from "./pages/BuyTyre";
import Inventory from "./pages/Inventory";
import Sell from "./pages/Sell";
import Additem from "./pages/Additem";
import Return from "./pages/Return";
import CompanyLeaders from "./pages/CompanyLeaders";
import ProfitLoss from "./pages/ProfitLoss";
import Transfer from "./pages/Transfer";
import PendingDues from "./pages/PendingDues";
import CustomerLedger from "./pages/CustomerLedger";
import Login from "./components/Login";

// PrivateRoute component to protect routes
const PrivateRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if this is a new session (new tab or browser reopen)
    const isNewSession = !sessionStorage.getItem("sessionActive");
    if (isNewSession) {
      // Clear auth state for new sessions
      localStorage.removeItem("isAuthenticated");
      sessionStorage.setItem("sessionActive", "true");
    }

    // Check localStorage for auth state
    const loggedIn = localStorage.getItem("isAuthenticated") === "true";
    setIsAuthenticated(loggedIn);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Navigation component (top navbar)
const Navigation = ({ toggleSidebar }) => {
  const location = useLocation();
  // Hide navbar on login page
  if (location.pathname === "/login") return null;

  return (
    <nav className="bg-white shadow-md fixed top-0 left-0 right-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onClick={toggleSidebar}
          className="text-gray-600 hover:text-blue-500 focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex gap-8">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `font-semibold transition duration-200 ${
                isActive ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-blue-500"
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/sell"
            className={({ isActive }) =>
              `font-semibold transition duration-200 ${
                isActive ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-blue-500"
              }`
            }
          >
            Sell Tyre
          </NavLink>
          <NavLink
            to="/return"
            className={({ isActive }) =>
              `font-semibold transition duration-200 ${
                isActive ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-blue-500"
              }`
            }
          >
            Return
          </NavLink>
          <NavLink
            to="/pending-dues"
            className={({ isActive }) =>
              `font-semibold transition duration-200 ${
                isActive ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-blue-500"
              }`
            }
          >
            Pending Dues
          </NavLink>
        </div>
      </div>
    </nav>
  );
};

// Sidebar component
const Sidebar = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  // Hide sidebar on login page
  if (location.pathname === "/login") return null;

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("sessionActive");
    window.location.href = "/login";
  };

  return (
    <div
      className={`bg-white shadow-md w-64 h-screen fixed top-0 left-0 z-20 transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } transition-transform duration-300 ease-in-out`}
    >
      <div className="flex flex-col p-4 h-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">Menu</h2>
          <button
            onClick={toggleSidebar}
            className="text-gray-600 hover:text-blue-500 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-4 flex-grow">
          <NavLink
            to="/buy"
            className={({ isActive }) =>
              `font-semibold transition duration-200 px-4 py-2 rounded ${
                isActive ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-blue-100 hover:text-blue-500"
              }`
            }
            onClick={toggleSidebar}
          >
            Add Inventory
          </NavLink>
          <NavLink
            to="/item"
            className={({ isActive }) =>
              `font-semibold transition duration-200 px-4 py-2 rounded ${
                isActive ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-blue-100 hover:text-blue-500"
              }`
            }
            onClick={toggleSidebar}
          >
            Add Item
          </NavLink>
          <NavLink
            to="/companies"
            className={({ isActive }) =>
              `font-semibold transition duration-200 px-4 py-2 rounded ${
                isActive ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-blue-100 hover:text-blue-500"
              }`
            }
            onClick={toggleSidebar}
          >
            Companies
          </NavLink>
          <NavLink
            to="/customer-ledger"
            className={({ isActive }) =>
              `font-semibold transition duration-200 px-4 py-2 rounded ${
                isActive ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-blue-100 hover:text-blue-500"
              }`
            }
            onClick={toggleSidebar}
          >
            Customer Ledger
          </NavLink>
          <NavLink
            to="/profit-loss"
            className={({ isActive }) =>
              `font-semibold transition duration-200 px-4 py-2 rounded ${
                isActive ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-blue-100 hover:text-blue-500"
              }`
            }
            onClick={toggleSidebar}
          >
            Profit & Loss
          </NavLink>
          <NavLink
            to="/transfor-data"
            className={({ isActive }) =>
              `font-semibold transition duration-200 px-4 py-2 rounded ${
                isActive ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-blue-100 hover:text-blue-500"
              }`
            }
            onClick={toggleSidebar}
          >
            Transfer Data
          </NavLink>
          <button
            onClick={handleLogout}
            className="font-semibold text-gray-600 hover:bg-blue-100 hover:text-blue-500 px-4 py-2 rounded text-left"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col">
        <Navigation toggleSidebar={toggleSidebar} />
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        <div className={`flex-grow p-4 ${isSidebarOpen ? "ml-64" : "ml-0"} mt-16 transition-all duration-300`}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Inventory />
                </PrivateRoute>
              }
            />
            <Route
              path="/buy"
              element={
                <PrivateRoute>
                  <BuyTyre />
                </PrivateRoute>
              }
            />
            <Route
              path="/item"
              element={
                <PrivateRoute>
                  <Additem />
                </PrivateRoute>
              }
            />
            <Route
              path="/sell"
              element={
                <PrivateRoute>
                  <Sell />
                </PrivateRoute>
              }
            />
            <Route
              path="/return"
              element={
                <PrivateRoute>
                  <Return />
                </PrivateRoute>
              }
            />
            <Route
              path="/companies"
              element={
                <PrivateRoute>
                  <CompanyLeaders />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer-ledger"
              element={
                <PrivateRoute>
                  <CustomerLedger />
                </PrivateRoute>
              }
            />
            <Route
              path="/profit-loss"
              element={
                <PrivateRoute>
                  <ProfitLoss />
                </PrivateRoute>
              }
            />
            <Route
              path="/transfor-data"
              element={
                <PrivateRoute>
                  <Transfer />
                </PrivateRoute>
              }
            />
            <Route
              path="/pending-dues"
              element={
                <PrivateRoute>
                  <PendingDues />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </div>
        <ToastContainer />
      </div>
    </Router>
  );
}

export default App;