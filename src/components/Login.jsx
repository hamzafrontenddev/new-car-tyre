import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: "", password: "" };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Invalid email format";
      isValid = false;
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (!passwordRegex.test(password)) {
      newErrors.password = "Password must be at least 6 characters with a letter and a number";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };
  const handleLogin = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Dummy authentication logic
    const validEmail = "hamza@gmail.com";
    const validPassword = "hamza7811";

    try {
      if (email === validEmail && password === validPassword) {
        // Save auth state to localStorage
        localStorage.setItem("isAuthenticated", "true");
        toast.success("Login successful!");
        navigate("/");
      } else {
        toast.error("Invalid email or password.");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred: " + error.message);
    }
  };

  return (
    <div className="flex justify-center">
      <div className="bg-white shadow-2xl rounded-2xl p-8 max-w-md w-full transform transition-all duration-300 hover:scale-105">
        <div className="flex justify-center mb-6">
          <h2 className="text-3xl font-extrabold text-gray-800 text-center">
            Sarhad Tyres
          </h2>
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-6 text-center">🔒 Secure Login</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full border-2 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.email
                  ? "border-red-500 focus:ring-red-400"
                  : "border-gray-300 focus:ring-indigo-400"
              }`}
              placeholder="Enter your email"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1 animate-pulse">{errors.email}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full border-2 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.password
                  ? "border-red-500 focus:ring-red-400"
                  : "border-gray-300 focus:ring-indigo-400"
              }`}
              placeholder="Enter your password"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1 animate-pulse">{errors.password}</p>
            )}
          </div>
          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all duration-300 font-semibold shadow-md hover:shadow-lg"
          >
            Sign In
          </button>
        </div>
        <p className="text-center text-sm text-gray-500 mt-6">
          © 2025 Sarhad Traders. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;