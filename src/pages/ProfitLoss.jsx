import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

const filterByDateRange = (data, start, end) => {
  if (!start || !end) return data; // Return all data if either date is null
  return data.filter((item) => {
    const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
};

const ProfitLoss = () => {
  const [buyData, setBuyData] = useState([]);
  const [sellData, setSellData] = useState([]);
  const [returnData, setReturnData] = useState([]);
  const today = new Date("2025-05-19");
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(today.getDate() - 30); // 30 days ago
  const [startDate, setStartDate] = useState(null); // Changed to null for initial full data
  const [endDate, setEndDate] = useState(null); // Changed to null for initial full data
  const [searchQuery, setSearchQuery] = useState(""); // State for search bar
  const [currentPage, setCurrentPage] = useState(1); // State for current page
  const [rowsPerPage] = useState(5); // Number of rows per page

  useEffect(() => {
    const unsubscribeBuy = onSnapshot(
      collection(db, "purchasedTyres"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            date: docData.date?.toDate
              ? docData.date.toDate()
              : new Date(docData.date || Date.now()),
          };
        });
        console.log("Buy Data Updated:", data);
        setBuyData(data);
        if (data.length === 0) {
          console.warn("No data found in purchasedTyres collection");
          toast.warn("No purchased tyres data found");
        }
      },
      (error) => {
        console.error("Error fetching purchasedTyres:", error);
        toast.error(`Failed to fetch purchased tyres: ${error.message}`);
      }
    );

    const unsubscribeSell = onSnapshot(
      collection(db, "soldTyres"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            date: docData.date?.toDate
              ? docData.date.toDate()
              : new Date(docData.date || Date.now()),
          };
        });
        console.log("Sell Data Updated:", data);
        setSellData(data);
        if (data.length === 0) {
          console.warn("No data found in soldTyres collection");
          toast.warn("No sold tyres data found");
        }
      },
      (error) => {
        console.error("Error fetching soldTyres:", error);
        toast.error(`Failed to fetch sold tyres: ${error.message}`);
      }
    );

    const unsubscribeReturn = onSnapshot(
      collection(db, "returnedTyres"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            date: docData.date?.toDate
              ? docData.date.toDate()
              : new Date(docData.date || Date.now()),
          };
        });
        console.log("Return Data Updated:", data);
        setReturnData(data);
        if (data.length === 0) {
          console.warn("No data found in returnedTyres collection");
          toast.warn("No returned tyres data found");
        }
      },
      (error) => {
        console.error("Error fetching returnedTyres:", error);
        toast.error(`Failed to fetch returned tyres: ${error.message}`);
      }
    );

    return () => {
      unsubscribeBuy();
      unsubscribeSell();
      unsubscribeReturn();
    };
  }, []);

  const filteredBuyData = filterByDateRange(buyData, startDate, endDate);
  const filteredSellData = filterByDateRange(sellData, startDate, endDate);
  const filteredReturnData = filterByDateRange(returnData, startDate, endDate);

  console.log("Filtered Buy Data:", filteredBuyData);
  console.log("Filtered Sell Data:", filteredSellData);
  console.log("Filtered Return Data:", filteredReturnData);

  const totalPurchaseCost = filteredBuyData.reduce(
    (sum, item) => sum + (parseFloat(item.price || 0) * parseInt(item.quantity || 0, 10) || 0),
    0
  );
  const totalSalesRevenue = filteredSellData.reduce(
    (sum, item) => sum + (parseFloat(item.price || 0) * parseInt(item.quantity || 0, 10) || 0),
    0
  );
  const totalReturnAmount = filteredReturnData.reduce(
    (sum, item) =>
      sum + (parseFloat(item.returnPrice || 0) * parseInt(item.returnQuantity || 0, 10) || 0),
    0
  );
  const netSales = totalSalesRevenue - totalReturnAmount;
  const grossProfit = netSales - totalPurchaseCost;
  const profitMargin = totalPurchaseCost
    ? ((grossProfit / totalPurchaseCost) * 100).toFixed(2)
    : 0;

  const brandBreakdown = {};
  filteredBuyData.forEach((item) => {
    if (!brandBreakdown[item.brand]) {
      brandBreakdown[item.brand] = { soldQty: 0, revenue: 0, cost: 0, returns: 0 };
    }
    brandBreakdown[item.brand].cost +=
      parseFloat(item.price || 0) * parseInt(item.quantity || 0, 10) || 0;
  });
  filteredSellData.forEach((item) => {
    if (!brandBreakdown[item.brand]) {
      brandBreakdown[item.brand] = { soldQty: 0, revenue: 0, cost: 0, returns: 0 };
    }
    brandBreakdown[item.brand].soldQty += parseInt(item.quantity || 0, 10) || 0;
    brandBreakdown[item.brand].revenue +=
      parseFloat(item.price || 0) * parseInt(item.quantity || 0, 10) || 0;
  });
  filteredReturnData.forEach((item) => {
    if (!brandBreakdown[item.brand]) {
      brandBreakdown[item.brand] = { soldQty: 0, revenue: 0, cost: 0, returns: 0 };
    }
    brandBreakdown[item.brand].returns +=
      parseFloat(item.returnPrice || 0) * parseInt(item.returnQuantity || 0, 10) || 0;
  });

  const brandBreakdownArray = Object.keys(brandBreakdown).map((brand) => {
    const data = brandBreakdown[brand];
    const profit = data.revenue - data.returns - data.cost;
    const margin = data.cost ? ((profit / data.cost) * 100).toFixed(2) : 0;
    return { brand, ...data, profit, margin };
  });

  // Filter brandBreakdownArray based on search query
  const filteredBrandBreakdownArray = brandBreakdownArray.filter((row) =>
    row.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination logic
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredBrandBreakdownArray.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredBrandBreakdownArray.length / rowsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const tyreProfit = filteredSellData
    .map((item) => {
      const buyItem = filteredBuyData.find(
        (b) => b.brand === item.brand && b.model === item.model && b.size === item.size
      );
      const returnItems = filteredReturnData.filter(
        (r) => r.brand === item.brand && r.model === item.model && r.size === item.size
      );
      const cost = buyItem
        ? parseFloat(buyItem.price || 0) * parseInt(item.quantity || 0, 10)
        : 0;
      const revenue = parseFloat(item.price || 0) * parseInt(item.quantity || 0, 10) || 0;
      const returns = returnItems.reduce(
        (sum, r) =>
          sum + (parseFloat(r.returnPrice || 0) * parseInt(r.returnQuantity || 0, 10) || 0),
        0
      );
      const profit = revenue - returns - cost;
      return {
        brand: item.brand,
        model: item.model,
        size: item.size,
        unitsSold: parseInt(item.quantity || 0, 10) || 0,
        profit,
      };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3);

  const totalReturnedQty = filteredReturnData.reduce(
    (sum, item) => sum + parseInt(item.returnQuantity || 0, 10) || 0,
    0
  );
  const returnByBrand = {};
  filteredReturnData.forEach((item) => {
    if (!returnByBrand[item.brand]) returnByBrand[item.brand] = 0;
    returnByBrand[item.brand] += parseInt(item.returnQuantity || 0, 10) || 0;
  });
  const mostReturnedBrand = Object.keys(returnByBrand).reduce(
    (a, b) => (returnByBrand[a] > returnByBrand[b] ? a : b),
    "N/A"
  );

  const totalBought = filteredBuyData.reduce(
    (sum, item) => sum + parseInt(item.quantity || 0, 10) || 0,
    0
  );
  const totalSold = filteredSellData.reduce(
    (sum, item) => sum + parseInt(item.quantity || 0, 10) || 0,
    0
  );
  const inStock = totalBought - totalSold + totalReturnedQty;

  const stockTurnoverRate = totalBought ? ((totalSold / totalBought) * 100).toFixed(2) : 0;
  const returnRate = totalSold ? ((totalReturnedQty / totalSold) * 100).toFixed(2) : 0;
  const avgProfitPerTyre = totalSold ? (grossProfit / totalSold).toFixed(2) : 0;
  const bestBrand = brandBreakdownArray.reduce(
    (a, b) => (parseFloat(a.margin) > parseFloat(b.margin) ? a : b),
    { brand: "N/A", margin: 0 }
  );

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 flex items-center">
          <span className="mr-2">📈</span> Profit & Loss Summary
        </h2>
        <div className="flex gap-3">
          <div className="relative">
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              placeholderText="Start Date"
              className="border pl-10 pr-3 py-2 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
              dateFormat="dd/MM/yyyy"
              isClearable
            />
            <CalendarIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          <div className="relative">
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              placeholderText="End Date"
              className="border pl-10 pr-3 py-2 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
              dateFormat="dd/MM/yyyy"
              isClearable
            />
            <CalendarIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Overall Financial Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-600">💸 Total Purchase Cost</p>
            <p className="text-lg font-bold text-blue-700">Rs. {totalPurchaseCost.toLocaleString()}</p>
            <p className="text-xs text-gray-500">All tyres bought in range</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-600">🛍️ Total Sales Revenue</p>
            <p className="text-lg font-bold text-green-700">Rs. {totalSalesRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Excludes returned sales</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-600">🔄 Total Return Amount</p>
            <p className="text-lg font-bold text-red-700">Rs. {totalReturnAmount.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Customer returns</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-600">💼 Net Sales</p>
            <p className="text-lg font-bold text-yellow-700">Rs. {netSales.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Sales Revenue - Returns</p>
          </div>
          <div className="p-4 bg-teal-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-600">📊 Gross Profit</p>
            <p className="text-lg font-bold text-teal-700">Rs. {grossProfit.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Net Sales - Purchase Cost</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-600">📈 Profit Margin</p>
            <p className="text-lg font-bold text-purple-700">{profitMargin}%</p>
            <p className="text-xs text-gray-500">(Gross Profit ÷ Purchase Cost) × 100</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Brand-wise Profit Breakdown</h3>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by brand..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className="border pl-3 pr-3 py-2 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 w-full max-w-md"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-200 text-gray-700">
              <tr>
                <th className="p-4 text-left font-semibold">Brand</th>
                <th className="p-4 text-left font-semibold">Sold Qty</th>
                <th className="p-4 text-left font-semibold">Revenue</th>
                <th className="p-4 text-left font-semibold">Cost</th>
                <th className="p-4 text-left font-semibold">Returns</th>
                <th className="p-4 text-left font-semibold">Profit</th>
                <th className="p-4 text-left font-semibold">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.map((row, idx) => (
                <tr
                  key={row.brand}
                  className={`border-b ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-gray-100 transition-colors`}
                >
                  <td className="p-4">{row.brand}</td>
                  <td className="p-4">{row.soldQty}</td>
                  <td className="p-4">Rs. {row.revenue.toLocaleString()}</td>
                  <td className="p-4">Rs. {row.cost.toLocaleString()}</td>
                  <td className="p-4">Rs. {row.returns.toLocaleString()}</td>
                  <td className="p-4 font-semibold text-green-600">Rs. {row.profit.toLocaleString()}</td>
                  <td className="p-4">{row.margin}%</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-200">
                <td className="p-4">Total</td>
                <td className="p-4">{totalSold}</td>
                <td className="p-4">Rs. {totalSalesRevenue.toLocaleString()}</td>
                <td className="p-4">Rs. {totalPurchaseCost.toLocaleString()}</td>
                <td className="p-4">Rs. {totalReturnAmount.toLocaleString()}</td>
                <td className="p-4 text-green-600">Rs. {grossProfit.toLocaleString()}</td>
                <td className="p-4">{profitMargin}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-lg ${currentPage === 1 ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-white"}`}
          >
            Previous
          </button>
          <p className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </p>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-lg ${currentPage === totalPages ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-white"}`}
          >
            Next
          </button>
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Top Performing Tyres (By Profit)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tyreProfit.map((tyre, idx) => (
            <div
              key={idx}
              className="p-4 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
            >
              <p className="text-sm font-semibold text-gray-800">
                {tyre.brand} - {tyre.model}
              </p>
              <p className="text-xs text-gray-600">Size: {tyre.size}</p>
              <p className="text-xs text-gray-600">Units Sold: {tyre.unitsSold}</p>
              <p className="text-lg font-bold text-green-600 mt-2">
                Profit: Rs. {tyre.profit.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Return Impact Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-red-50 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Total Returned Qty</p>
            <p className="text-lg font-bold text-red-700">{totalReturnedQty}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Most Returned Brand</p>
            <p className="text-lg font-bold text-red-700">{mostReturnedBrand}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Financial Impact</p>
            <p className="text-lg font-bold text-red-700">Rs. {totalReturnAmount.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Loss recovered through return deduction</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitLoss;